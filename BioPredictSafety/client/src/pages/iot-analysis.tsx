import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Camera, 
  Upload, 
  X, 
  Image as ImageIcon,
  Loader2,
  Check,
  AlertCircle,
  Atom,
  Activity,
  Shield,
  FileText,
  Sparkles,
  Scan
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LoadingAnimation from "@/components/loading-animation";
import { cn } from "@/lib/utils";
import MedicineInsightsDisplay from "@/components/medicine-insights";
import type { ImageAnalysisResult, MedicineInsights } from "@/types/molecular";

interface CompoundPrediction {
  name: string;
  smiles: string;
  confidence: number;
  molecularWeight: number;
  molecularFormula: string;
  bioactivityScore?: number;
  safetyRating?: 'safe' | 'moderate' | 'high-risk';
  properties: {
    logP: number;
    tpsa: number;
    hBondDonors: number;
    hBondAcceptors: number;
    rotatableBonds: number;
  };
  drugLikeness: {
    lipinskiViolations: number;
    passesRuleOfFive: boolean;
  };
  toxicityPrediction: {
    hepatotoxicity: { probability: number; risk: string };
    cardiotoxicity: { probability: number; risk: string };
    mutagenicity: { probability: number; risk: string };
  };
  therapeuticAreas: string[];
  similarCompounds: string[];
  analysisDetails: string;
  medicalUse?: {
    primaryIndication: string;
    commonUses: string[];
    mechanismOfAction: string;
    safetyNotes: string;
  };
}

export default function IotAnalysisPage() {
  const [, setLocation] = useLocation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [prediction, setPrediction] = useState<CompoundPrediction | null>(null);
  const [medicineInsights, setMedicineInsights] = useState<MedicineInsights | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();

  const safeNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  };

  const clamp01 = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  };

  const normalizeLabel = (risk?: string | null): string => {
    if (!risk) return "Unknown";
    const lower = risk.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  const mapSafetyRating = (risk?: string | null): CompoundPrediction['safetyRating'] => {
    switch (risk) {
      case "LOW":
        return "safe";
      case "MEDIUM":
        return "moderate";
      case "HIGH":
        return "high-risk";
      default:
        return undefined;
    }
  };

  const isValidSmiles = (value?: string | null) => {
    if (!value) return false;
    const trimmed = value.trim();
    return trimmed.length > 0 && !["N/A", "Unknown", "Unavailable"].includes(trimmed);
  };

  const buildPredictionFromAnalysis = (result: ImageAnalysisResult | null): CompoundPrediction | null => {
    if (!result) return null;

    const { compound, prediction: modeledPrediction, lipinskiRules, medicineInsights: insights } = result;
    const candidateWithSmiles = insights?.compoundCandidates?.find((candidate) => Boolean(candidate.smiles));
    const fallbackCandidate = candidateWithSmiles || insights?.compoundCandidates?.[0];

    const fallbackName = compound?.name
      || fallbackCandidate?.name
      || insights?.ingredients.active?.[0]?.name
      || "Unknown compound";

    const fallbackSmiles = compound?.smiles
      || fallbackCandidate?.smiles
      || fallbackCandidate?.name
      || "N/A";

    const descriptors = (modeledPrediction?.descriptors || {}) as Record<string, unknown>;
    const safetyAssessment = modeledPrediction?.safetyAssessment as any;

    const therapeuticAreasSet = new Set<string>();
    insights?.ingredients?.active?.forEach((active) => {
      if (active?.name) therapeuticAreasSet.add(active.name);
    });

    const similarCompoundsSet = new Set<string>();
    insights?.compoundCandidates?.forEach((candidate) => {
      if (candidate?.name) {
        similarCompoundsSet.add(candidate.name);
      }
    });

    const commonUsesSet = new Set<string>();
    if (insights?.usageGuidelines?.instructions) {
      commonUsesSet.add(insights.usageGuidelines.instructions);
    }
    if (insights?.usageGuidelines?.dosage) {
      commonUsesSet.add(`Dosage: ${insights.usageGuidelines.dosage}`);
    }
    if (insights?.usageGuidelines?.timing) {
      commonUsesSet.add(`Timing: ${insights.usageGuidelines.timing}`);
    }

    const safetyNotesParts: string[] = [];
    if (insights?.safety?.prescriptionStatus) {
      safetyNotesParts.push(`Status: ${insights.safety.prescriptionStatus}`);
    }
    insights?.safety?.warnings?.forEach((warning) => {
      if (warning) safetyNotesParts.push(`Warning: ${warning}`);
    });
    insights?.safety?.contraindications?.forEach((contra) => {
      if (contra) safetyNotesParts.push(`Contraindication: ${contra}`);
    });

    const confidence = clamp01(
      typeof modeledPrediction?.confidence === "number"
        ? modeledPrediction.confidence
        : safeNumber(insights?.confidence?.score, 0)
    );

    const molecularWeight = safeNumber(descriptors.molecularWeight, 0);
    const logP = safeNumber(descriptors.logP, 0);
    const tpsa = safeNumber(descriptors.tpsa, 0);
    const hBondDonors = safeNumber((descriptors as any).hbdCount, 0);
    const hBondAcceptors = safeNumber((descriptors as any).hbaCount, 0);
    const rotatableBonds = safeNumber((descriptors as any).rotatableBonds, 0);

    const violations = lipinskiRules
      ? Math.max(0, lipinskiRules.total - lipinskiRules.passed)
      : 0;

    const probabilityFor = (value: any) => clamp01(safeNumber(value?.probability, 0.3));

    return {
      name: fallbackName,
      smiles: fallbackSmiles,
      confidence,
      molecularWeight,
      molecularFormula: compound?.smiles || fallbackCandidate?.smiles || "Unavailable",
      bioactivityScore: typeof modeledPrediction?.pic50 === "number" ? modeledPrediction.pic50 : undefined,
      safetyRating: mapSafetyRating(safetyAssessment?.overallRisk),
      properties: {
        logP,
        tpsa,
        hBondDonors,
        hBondAcceptors,
        rotatableBonds,
      },
      drugLikeness: {
        lipinskiViolations: violations,
        passesRuleOfFive: lipinskiRules ? lipinskiRules.passed === lipinskiRules.total : true,
      },
      toxicityPrediction: {
        hepatotoxicity: {
          risk: normalizeLabel(safetyAssessment?.hepatotoxicity?.risk),
          probability: probabilityFor(safetyAssessment?.hepatotoxicity),
        },
        cardiotoxicity: {
          risk: normalizeLabel(safetyAssessment?.cardiotoxicity?.risk),
          probability: probabilityFor(safetyAssessment?.cardiotoxicity),
        },
        mutagenicity: {
          risk: normalizeLabel(safetyAssessment?.mutagenicity?.risk),
          probability: probabilityFor(safetyAssessment?.mutagenicity),
        },
      },
      therapeuticAreas: Array.from(therapeuticAreasSet),
      similarCompounds: Array.from(similarCompoundsSet),
      analysisDetails: insights?.summary || "No analysis summary available.",
      medicalUse: insights
        ? {
            primaryIndication: insights.summary,
            commonUses: Array.from(commonUsesSet),
            mechanismOfAction: insights.usageGuidelines.route || "Route not specified",
            safetyNotes: safetyNotesParts.join(" • ") || "No additional safety notes",
          }
        : undefined,
    };
  };

  // Navigate to dashboard with compound data
  const handleViewInDashboard = () => {
    const verifiedSmiles = analysisResult?.compound?.smiles
      || medicineInsights?.compoundCandidates?.find((candidate) => isValidSmiles(candidate.smiles))?.smiles
      || (isValidSmiles(prediction?.smiles) ? prediction?.smiles : undefined);

    const verifiedName = analysisResult?.compound?.name
      || medicineInsights?.compoundCandidates?.[0]?.name
      || prediction?.name;

    if (!isValidSmiles(verifiedSmiles) || !verifiedName) {
      toast({
        title: "Compound not verified",
        description: "Upload a clearer photo or enter the compound manually before opening the dashboard.",
        variant: "destructive",
      });
      return;
    }
    
    sessionStorage.setItem('pendingCompound', JSON.stringify({
      smiles: verifiedSmiles,
      name: verifiedName,
    }));
    
    toast({
      title: "Navigating to Dashboard",
      description: `Analyzing ${verifiedName} in detail...`,
    });
    
    setLocation('/');
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, JPEG, etc.)",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedImage(result);
      setPrediction(null);
      setMedicineInsights(null);
      setAnalysisResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // File input handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/png');
        setSelectedImage(imageData);
        setPrediction(null);
        setMedicineInsights(null);
        setAnalysisResult(null);
        setError(null);
        stopCamera();
      }
    }
  };

  // Mock AI analysis (replace with actual API call)
  const analyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress(0);

    try {
      // Progress updates
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 300);

      // Call the real Gemini API
      const response = await fetch('/api/compounds/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: selectedImage,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to analyze image');
      }

      const result = await response.json() as ImageAnalysisResult;
      setAnalysisProgress(100);
      setAnalysisResult(result);
      setMedicineInsights(result.medicineInsights || null);

      const derivedPrediction = buildPredictionFromAnalysis(result);
      setPrediction(derivedPrediction);

      if (derivedPrediction) {
        toast({
          title: "Analysis Complete",
          description: `${derivedPrediction.name} identified with ${(derivedPrediction.confidence * 100).toFixed(0)}% confidence`,
        });
      } else if (result.medicineInsights) {
        toast({
          title: "Insights Extracted",
          description: "Gemini analyzed the photo and produced medicine insights. Compound verification is optional.",
        });
      } else {
        toast({
          title: "Analysis Complete",
          description: "Image processed successfully, but no compound information was found.",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to analyze image. Please try again.";
      setPrediction(null);
      setAnalysisResult(null);
      setMedicineInsights(null);
      setError(errorMessage);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Clear selection
  const clearImage = () => {
    setSelectedImage(null);
    setPrediction(null);
    setMedicineInsights(null);
    setAnalysisResult(null);
    setError(null);
    setAnalysisProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Compound Analysis</h1>
              <p className="text-muted-foreground">
                AI-powered compound recognition from images
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-primary" />
                Image Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Camera View */}
              {isCameraActive && (
                <div className="space-y-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg border-2 border-primary/50"
                  />
                  <div className="flex gap-2">
                    <Button onClick={capturePhoto} className="flex-1">
                      <Camera className="w-4 h-4 mr-2" />
                      Capture Photo
                    </Button>
                    <Button onClick={stopCamera} variant="outline">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {selectedImage && !isCameraActive && (
                <div className="space-y-3">
                  <div className="relative group">
                    <img
                      src={selectedImage}
                      alt="Selected compound"
                      className="w-full rounded-lg border-2 border-primary/50"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={clearImage}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {isAnalyzing && (
                    <div className="space-y-2">
                      <Progress value={analysisProgress} className="h-2" />
                      <p className="text-sm text-center text-muted-foreground">
                        Analyzing image... {analysisProgress}%
                      </p>
                    </div>
                  )}
                  
                  {!isAnalyzing && !prediction && (
                    <Button onClick={analyzeImage} className="w-full" size="lg">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze with AI
                    </Button>
                  )}
                  
                  {prediction && (
                    <Button onClick={clearImage} variant="outline" className="w-full">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload New Image
                    </Button>
                  )}
                </div>
              )}

              {/* Upload Options */}
              {!selectedImage && !isCameraActive && (
                <div className="space-y-4">
                  {/* Drag & Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-all",
                      isDragging
                        ? "border-primary bg-primary/5 scale-105"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">
                      Drop image here
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse files
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </Button>
                  </div>

                  {/* Camera Button */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={startCamera}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Open Camera
                  </Button>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Prediction Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAnalyzing && (
                <LoadingAnimation 
                  isLoading={true} 
                  phase="analyzing"
                  progress={analysisProgress}
                />
              )}

              {!isAnalyzing && !prediction && !selectedImage && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <Atom className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    No Image Selected
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Upload an image or capture a photo to begin AI analysis
                  </p>
                </div>
              )}

              {!isAnalyzing && medicineInsights && (
                <div className="mb-6">
                  <MedicineInsightsDisplay insights={medicineInsights} isAnalyzing={false} />
                </div>
              )}

              {!isAnalyzing && medicineInsights && !prediction && (
                <p className="text-xs text-muted-foreground mb-6">
                  A compound could not be auto-verified from this photo, but Gemini provided detailed medicine insights above.
                  You can try another angle or run manual analysis from the dashboard.
                </p>
              )}

              {prediction && !isAnalyzing && (
                <div className="space-y-6">
                  {/* Confidence Badge */}
                  <div className="flex items-center justify-between">
                    <Badge variant="default" className="text-lg px-4 py-2">
                      <Check className="w-4 h-4 mr-2" />
                      {(prediction.confidence * 100).toFixed(0)}% Confidence
                    </Badge>
                    <Badge 
                      variant={
                        prediction.safetyRating === 'safe' ? 'default' :
                        prediction.safetyRating === 'moderate' ? 'secondary' :
                        prediction.safetyRating === 'high-risk' ? 'destructive' :
                        'outline'
                      }
                    >
                      {prediction.safetyRating ? prediction.safetyRating.toUpperCase() : 'UNKNOWN'}
                    </Badge>
                  </div>

                  {/* Compound Info */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Compound Name</p>
                      <p className="text-xl font-bold">{prediction.name}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Molecular Formula</p>
                      <p className="text-lg font-semibold">{prediction.molecularFormula}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">SMILES Notation</p>
                      <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                        {prediction.smiles}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Molecular Weight</p>
                      <p className="text-lg font-semibold">
                        {prediction.molecularWeight.toFixed(2)} g/mol
                      </p>
                    </div>
                  </div>

                  {/* Molecular Properties */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Atom className="w-4 h-4 text-primary" />
                      Molecular Properties
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">LogP</p>
                        <p className="text-lg font-bold">{prediction.properties.logP.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Lipophilicity</p>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-950 border border-purple-200 dark:border-purple-900">
                        <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">TPSA</p>
                        <p className="text-lg font-bold">{prediction.properties.tpsa.toFixed(1)} Ų</p>
                        <p className="text-xs text-muted-foreground">Polar surface</p>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950 border border-green-200 dark:border-green-900">
                        <p className="text-xs text-green-600 dark:text-green-400 mb-1">H-Donors</p>
                        <p className="text-lg font-bold">{prediction.properties.hBondDonors}</p>
                        <p className="text-xs text-muted-foreground">Hydrogen bonds</p>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-950 border border-orange-200 dark:border-orange-900">
                        <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">H-Acceptors</p>
                        <p className="text-lg font-bold">{prediction.properties.hBondAcceptors}</p>
                        <p className="text-xs text-muted-foreground">Hydrogen bonds</p>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-900">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Rotatable Bonds</p>
                        <p className="text-lg font-bold">{prediction.properties.rotatableBonds}</p>
                        <p className="text-xs text-muted-foreground">Flexibility</p>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-900">
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Lipinski</p>
                        <p className="text-lg font-bold">{prediction.drugLikeness.lipinskiViolations}</p>
                        <p className="text-xs text-muted-foreground">Violations</p>
                      </div>
                    </div>
                  </div>

                  {/* Drug-Likeness */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium">Drug-Likeness Assessment</span>
                      </div>
                      <Badge variant={prediction.drugLikeness.passesRuleOfFive ? "default" : "destructive"}>
                        {prediction.drugLikeness.passesRuleOfFive ? "Passes" : "Fails"} Lipinski's Rule
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {prediction.drugLikeness.lipinskiViolations === 0 
                        ? "Compound shows excellent drug-like properties with no Lipinski violations"
                        : `Compound has ${prediction.drugLikeness.lipinskiViolations} Lipinski violation(s)`}
                    </p>
                  </div>

                  {/* Toxicity Prediction */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      Toxicity Prediction
                    </h4>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Hepatotoxicity</span>
                          <Badge variant="secondary" className="text-xs">
                            {prediction.toxicityPrediction.hepatotoxicity.risk}
                          </Badge>
                        </div>
                        <Progress value={prediction.toxicityPrediction.hepatotoxicity.probability * 100} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {(prediction.toxicityPrediction.hepatotoxicity.probability * 100).toFixed(1)}% probability
                        </p>
                      </div>
                      
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Cardiotoxicity</span>
                          <Badge variant="secondary" className="text-xs">
                            {prediction.toxicityPrediction.cardiotoxicity.risk}
                          </Badge>
                        </div>
                        <Progress value={prediction.toxicityPrediction.cardiotoxicity.probability * 100} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {(prediction.toxicityPrediction.cardiotoxicity.probability * 100).toFixed(1)}% probability
                        </p>
                      </div>
                      
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Mutagenicity</span>
                          <Badge variant="secondary" className="text-xs">
                            {prediction.toxicityPrediction.mutagenicity.risk}
                          </Badge>
                        </div>
                        <Progress value={prediction.toxicityPrediction.mutagenicity.probability * 100} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {(prediction.toxicityPrediction.mutagenicity.probability * 100).toFixed(1)}% probability
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bioactivity Score */}
                  {prediction.bioactivityScore && (
                    <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Bioactivity Score (pIC50)</span>
                        </div>
                        <span className="text-2xl font-bold">{prediction.bioactivityScore.toFixed(1)}</span>
                      </div>
                      <Progress 
                        value={(prediction.bioactivityScore / 10) * 100} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {prediction.bioactivityScore > 6 
                          ? "High bioactivity - compound shows strong potential" 
                          : prediction.bioactivityScore > 4 
                          ? "Moderate bioactivity - further optimization recommended"
                          : "Low bioactivity - significant modifications needed"}
                      </p>
                    </div>
                  )}

                  {/* Therapeutic Areas */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Potential Therapeutic Areas</h4>
                    <div className="flex flex-wrap gap-2">
                      {prediction.therapeuticAreas.map((area, index) => (
                        <Badge key={index} variant="outline">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Similar Compounds */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Similar Known Compounds</h4>
                    <div className="flex flex-wrap gap-2">
                      {prediction.similarCompounds.map((compound, index) => (
                        <Badge key={index} variant="secondary">
                          {compound}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Analysis Details */}
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      AI Analysis Summary
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {prediction.analysisDetails}
                    </p>
                  </div>

                  {/* Medical Use Information */}
                  {prediction.medicalUse && (
                    <div className="p-4 rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Why This Medicine Is Used
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Primary Indication</p>
                          <p className="text-sm leading-relaxed">
                            {prediction.medicalUse.primaryIndication}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Common Medical Uses</p>
                          <ul className="space-y-1 text-sm">
                            {prediction.medicalUse.commonUses.map((use, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                <span>{use}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Mechanism of Action</p>
                          <p className="text-sm leading-relaxed">
                            {prediction.medicalUse.mechanismOfAction}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Safety & Administration</p>
                          <p className="text-sm leading-relaxed">
                            {prediction.medicalUse.safetyNotes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
