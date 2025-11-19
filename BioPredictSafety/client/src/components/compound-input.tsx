import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { validateSMILES } from "@/lib/molecular-utils";
import { AnalysisResult } from "@/types/molecular";
import ChemicalDrawer from "@/components/chemical-drawer";
import { 
  FlaskConical, Search, Eraser, Upload, History, Star, 
  Database, Beaker, Paintbrush, Play, FileCheck, 
  CheckCircle, Loader, Download, Info, AlertCircle
} from "lucide-react";

interface CompoundInputProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onAnalysisStart: () => void;
  onAnalysisError: () => void;
  isAnalyzing: boolean;
}

export default function CompoundInput({ 
  onAnalysisComplete, 
  onAnalysisStart, 
  onAnalysisError, 
  isAnalyzing 
}: CompoundInputProps) {
  const [activeTab, setActiveTab] = useState<'smiles' | 'draw' | 'upload'>('smiles');
  const [smiles, setSmiles] = useState('');
  const [compoundName, setCompoundName] = useState('');
  const [uploadedCompounds, setUploadedCompounds] = useState<Array<{smiles: string; name?: string}>>([]);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<any | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showBatchResults, setShowBatchResults] = useState(false);
  const [showChemicalDrawer, setShowChemicalDrawer] = useState(false);
  const { toast } = useToast();

  // Demo steps for tutorial
  const demoSteps = [
    {
      title: "Step 1: Enter SMILES or Compound Name",
      description: "Start by entering either a SMILES string or a compound name in the input field.",
      example: "Examples: CCO, Aspirin, C1=CC=CC=C1, Caffeine",
      image: "🧪"
    },
    {
      title: "Step 2: Add Custom Name (Optional)",
      description: "If you entered SMILES notation, you can optionally provide a custom compound name.",
      example: "Example: Ethanol, Aspirin, Caffeine",
      image: "📝"
    },
    {
      title: "Step 3: Run Analysis",
      description: "Click the 'Analyze' button to start the bioactivity prediction.",
      example: "Processing time: ~2-5 seconds per compound",
      image: "⚡"
    },
    {
      title: "Step 4: View Results",
      description: "Review the 3D structure, bioactivity scores, drug-likeness and safety assessment.",
      example: "Navigate to Safety and Export pages for detailed analysis",
      image: "📊"
    },
    {
      title: "Batch Processing",
      description: "Upload CSV files with multiple compounds to analyze them all at once.",
      example: "Supports: .csv, .txt, .smi files",
      image: "📦"
    }
  ];

  // Fetch recent compounds
  const { data: recentCompounds } = useQuery({
    queryKey: ['/api/compounds/recent'],
  });

  const { data: savedCompounds } = useQuery({
    queryKey: ['/api/predictions/saved'],
  });

  // Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: async ({ smiles, name }: { smiles: string; name?: string }) => {
      const response = await apiRequest('POST', '/api/compounds/analyze', { smiles, name });
      return response.json();
    },
    onSuccess: (data) => {
      onAnalysisComplete(data);
      queryClient.invalidateQueries({ queryKey: ['/api/compounds/recent'] });
      toast({
        title: "Analysis Complete",
        description: "Compound analysis and prediction completed successfully.",
      });
    },
    onError: (error) => {
      onAnalysisError();
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze compound",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (!smiles.trim()) {
      toast({
        title: "Missing Input",
        description: "Please enter a SMILES notation or compound name",
        variant: "destructive",
      });
      return;
    }

    onAnalysisStart();
    analysisMutation.mutate({ 
      smiles: smiles.trim(), 
      name: compoundName.trim() || undefined 
    });
  };

  const handleClear = () => {
    setSmiles('');
    setCompoundName('');
  };

  const handleDrawerAnalyze = (data: { smiles: string; molfile: string; inchi?: string }) => {
    const drawnSmiles = data.smiles;
    if (!drawnSmiles) {
      toast({
        title: "Invalid Drawing",
        description: "Please complete the structure before analyzing.",
        variant: "destructive",
      });
      return;
    }

    setSmiles(drawnSmiles);
    setCompoundName('');
    setShowChemicalDrawer(false);
    onAnalysisStart();
    setTimeout(() => {
      analysisMutation.mutate({
        smiles: drawnSmiles,
        name: undefined,
      });
    }, 250);
  };

  const handleRecentCompoundSelect = (compound: any) => {
    setSmiles(compound.smiles);
    setCompoundName(compound.name || '');
  };

  // Upload handlers with validation
  function parseCSV(text: string): Array<{smiles: string; name?: string}> {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const hasHeader = /smiles/i.test(lines[0]);
    const rows = hasHeader ? lines.slice(1) : lines;
    
    const parsed: Array<{smiles: string; name?: string}> = [];
    
    rows.forEach((line, idx) => {
      const parts = line.split(/,|;|\t/);
      const s = (parts[0] || '').trim();
      const n = (parts[1] || '').trim();
      
      if (s && validateSMILES(s)) {
        parsed.push({ smiles: s, name: n || undefined });
      } else if (s) {
        console.warn(`Invalid SMILES at line ${idx + (hasHeader ? 2 : 1)}: ${s}`);
      }
    });
    
    return parsed;
  }

  async function handleFileSelected(file: File) {
    setUploadError(null);
    
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const error = `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 5MB.`;
      setUploadError(error);
      toast({ title: 'Upload failed', description: error, variant: 'destructive' });
      return;
    }
    
    try {
      const text = await file.text();
      let items: Array<{smiles: string; name?: string}> = [];
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'csv' || ext === 'txt' || ext === 'smi') {
        items = parseCSV(text);
      } else if (ext === 'sdf') {
        toast({ 
          title: 'SDF not fully supported', 
          description: 'Please upload CSV, TXT, or SMI files with SMILES notation.', 
          variant: 'destructive' 
        });
        return;
      } else {
        const error = `Unsupported file type: .${ext}`;
        setUploadError(error);
        toast({ title: 'Unsupported file', description: error, variant: 'destructive' });
        return;
      }
      
      if (items.length === 0) {
        const error = 'No valid compounds found in file. Ensure SMILES are in the first column.';
        setUploadError(error);
        toast({ title: 'No compounds found', description: error, variant: 'destructive' });
        return;
      }
      
      setUploadedCompounds(items);
      toast({ 
        title: 'File uploaded successfully', 
        description: `${items.length} compounds loaded and ready for processing.` 
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Could not read file';
      setUploadError(error);
      toast({ title: 'Upload failed', description: error, variant: 'destructive' });
    }
  }

  const batchMutation = useMutation({
    mutationFn: async (compounds: Array<{smiles: string; name?: string}>) => {
      const res = await apiRequest('POST', '/api/batch/process', { compounds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Batch started', description: `Batch Job ID: ${data.batchJobId}` });
      setBatchJobId(data.batchJobId);
      setBatchInfo({ status: 'processing', processedCompounds: 0, totalCompounds: uploadedCompounds.length });
    },
    onError: (error) => {
      toast({ title: 'Batch failed', description: error instanceof Error ? error.message : 'Failed to start batch', variant: 'destructive' });
    }
  });

  // Poll batch status
  useEffect(() => {
    if (!batchJobId) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest('GET', `/api/batch/${batchJobId}`);
        const data = await res.json();
        if (!cancelled) setBatchInfo(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [batchJobId]);

  return (
    <>
      {/* Watch Demo Modal */}
      <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-xl">
              <Play className="mr-2 h-5 w-5 text-primary" />
              Bioactivity Analysis Tutorial
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                {demoSteps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all ${
                      idx === demoStep ? 'w-8 bg-primary' : 'w-2 bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                Step {demoStep + 1} of {demoSteps.length}
              </span>
            </div>

            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">{demoSteps[demoStep].image}</div>
              <h3 className="text-2xl font-bold">{demoSteps[demoStep].title}</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {demoSteps[demoStep].description}
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <code className="text-primary">{demoSteps[demoStep].example}</code>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setDemoStep(Math.max(0, demoStep - 1))}
                disabled={demoStep === 0}
              >
                Previous
              </Button>
              {demoStep < demoSteps.length - 1 ? (
                <Button onClick={() => setDemoStep(demoStep + 1)}>
                  Next
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setShowDemoModal(false);
                    setDemoStep(0);
                    toast({
                      title: "Ready to start!",
                      description: "You can now begin analyzing compounds."
                    });
                  }}
                >
                  Start Analyzing
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Results Modal */}
      <Dialog open={showBatchResults} onOpenChange={setShowBatchResults}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <FileCheck className="mr-2 h-5 w-5 text-primary" />
                Batch Processing Results
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (batchInfo?.results) {
                    const csvContent = [
                      ['SMILES', 'Name', 'pIC50', 'Safety Score'].join(','),
                      ...batchInfo.results.map((r: any) => [
                        r.compound?.smiles || '',
                        r.compound?.name || '',
                        r.prediction?.activityScore?.toFixed(2) || '',
                        r.prediction?.safetyAssessment?.overallScore?.toFixed(2) || ''
                      ].join(','))
                    ].join('\n');
                    
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `batch_results_${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                disabled={!batchInfo?.results?.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {batchInfo && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {batchInfo.totalCompounds || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {batchInfo.processedCompounds || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary capitalize">
                    {batchInfo.status || 'Unknown'}
                  </div>
                  <div className="text-sm text-muted-foreground">Status</div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Input Card */}
      <Card data-testid="card-compound-input">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Compound Input</h3>
            <Button 
              variant="outline" 
              size="sm"
              aria-label="Open demo"
              onClick={() => setShowDemoModal(true)}
            >
              <Play className="h-4 w-4 mr-2" />
              Demo
            </Button>
          </div>
          
          {/* Input Method Tabs */}
          <div className="flex space-x-1 bg-muted rounded-lg p-1 mb-4" data-testid="tabs-input-method">
            <button
              className={`flex-1 text-sm py-2 px-3 rounded-md font-medium transition-colors ${
                activeTab === 'smiles' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('smiles')}
              data-testid="tab-smiles"
            >
              SMILES
            </button>
            <button
              className={`flex-1 text-sm py-2 px-3 rounded-md font-medium transition-colors ${
                activeTab === 'draw' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('draw')}
              data-testid="tab-draw"
            >
              Draw
            </button>
            <button
              className={`flex-1 text-sm py-2 px-3 rounded-md font-medium transition-colors ${
                activeTab === 'upload' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('upload')}
              data-testid="tab-upload"
            >
              Upload
            </button>
          </div>

          {/* SMILES Input */}
          {activeTab === 'smiles' && (
            <div className="space-y-4" data-testid="panel-smiles-input">
              <div>
                <Label htmlFor="smiles-input" className="block text-sm font-medium text-foreground mb-2">
                  SMILES Notation or Compound Name
                </Label>
                <Textarea
                  id="smiles-input"
                  value={smiles}
                  onChange={(e) => setSmiles(e.target.value)}
                  className="w-full resize-none"
                  rows={3}
                  placeholder="Enter SMILES notation (e.g., CCO) or compound name (e.g., Aspirin, Caffeine)"
                  data-testid="input-smiles"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 You can enter either a SMILES notation or a compound name
                </p>
              </div>
              <div>
                <Label htmlFor="compound-name" className="block text-sm font-medium text-foreground mb-2">
                  Compound Name (Optional)
                </Label>
                <Input
                  id="compound-name"
                  value={compoundName}
                  onChange={(e) => setCompoundName(e.target.value)}
                  placeholder="Enter compound name (only if SMILES notation above)"
                  data-testid="input-compound-name"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || analysisMutation.isPending}
                  className="flex-1"
                  data-testid="button-analyze"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {isAnalyzing || analysisMutation.isPending ? 'Analyzing...' : 'Analyze'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={isAnalyzing || analysisMutation.isPending}
                  data-testid="button-clear"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Drawing Interface */}
          {activeTab === 'draw' && (
            <div className="space-y-4" data-testid="panel-draw-input">
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 bg-gradient-to-br from-primary/5 to-purple/5 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Paintbrush className="h-12 w-12 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Professional Chemical Structure Drawer</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Use our advanced molecular sketching tool powered by PubChem to draw any chemical structure with professional-grade precision
                    </p>
                  </div>
                  <Button 
                    size="lg" 
                    onClick={() => setShowChemicalDrawer(true)}
                    className="mt-2"
                  >
                    <Paintbrush className="h-5 w-5 mr-2" />
                    Open Structure Drawer
                  </Button>
                </div>
              </div>

              <div className="border border-border rounded-lg p-4 bg-muted/30">
                <div className="mb-3 text-sm text-muted-foreground flex items-center">
                  <Star className="h-4 w-4 mr-2"/>
                  Quick Templates
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { name: 'Benzene', smiles: 'c1ccccc1' },
                    { name: 'Ethanol', smiles: 'CCO' },
                    { name: 'Aspirin', smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O' },
                    { name: 'Caffeine', smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C' },
                  ].map((tpl) => (
                    <button
                      key={tpl.name}
                      onClick={() => { setSmiles(tpl.smiles); setCompoundName(tpl.name); }}
                      className="p-3 border rounded-md hover:bg-accent text-left transition-colors"
                    >
                      <div className="text-sm font-medium">{tpl.name}</div>
                      <div className="text-xs text-muted-foreground font-mono break-all">{tpl.smiles}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => setActiveTab('smiles')}>
                    <Beaker className="h-4 w-4 mr-2" /> Use in SMILES tab
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setSmiles(''); setCompoundName(''); }}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4" data-testid="panel-upload-input">
              {uploadError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}

              {uploadedCompounds.length > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-semibold text-foreground">
                        {uploadedCompounds.length} compounds loaded
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        setUploadedCompounds([]);
                        setUploadError(null);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  
                  <div className="max-h-48 overflow-auto space-y-2 bg-white/50 dark:bg-black/20 rounded p-3">
                    {uploadedCompounds.slice(0, 10).map((c, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between text-xs p-2 rounded bg-white dark:bg-slate-800/50 hover:bg-accent transition-colors"
                      >
                        <div className="flex-1 flex items-center gap-3">
                          <span className="text-muted-foreground font-medium w-6">{idx + 1}.</span>
                          <code className="flex-1 truncate font-mono text-primary">{c.smiles}</code>
                          {c.name && (
                            <span className="truncate text-muted-foreground max-w-xs">{c.name}</span>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => { 
                            setSmiles(c.smiles); 
                            setCompoundName(c.name || ''); 
                            setActiveTab('smiles'); 
                          }}
                          className="ml-2"
                        >
                          Use
                        </Button>
                      </div>
                    ))}
                    {uploadedCompounds.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        + {uploadedCompounds.length - 10} more...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Processing Card */}
      <Card data-testid="card-batch-processing">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Batch Processing
          </h3>
          
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                const file = e.dataTransfer.files?.[0]; 
                if (file) handleFileSelected(file); 
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                Upload Multiple Compounds
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                CSV, TXT, or SMI files
              </p>
              
              <input
                ref={batchFileInputRef}
                type="file"
                accept=".csv,.txt,.smi"
                className="hidden"
                onChange={(e) => { 
                  const file = e.target.files?.[0]; 
                  if (file) handleFileSelected(file); 
                }}
              />
              
              <div className="flex justify-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => batchFileInputRef.current?.click()}
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Select File
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => batchMutation.mutate(uploadedCompounds)} 
                  disabled={uploadedCompounds.length === 0 || batchMutation.isPending}
                  data-testid="button-process-batch"
                >
                  {batchMutation.isPending ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin mr-2" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Process Batch
                    </>
                  )}
                </Button>
              </div>
            </div>

            {batchInfo && (
              <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-lg border">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{batchInfo.status}</span>
                  <span className="text-muted-foreground">
                    {batchInfo.processedCompounds ?? 0} / {batchInfo.totalCompounds ?? 0}
                  </span>
                </div>
                
                <Progress 
                  value={Math.round(
                    ((batchInfo.processedCompounds || 0) / (batchInfo.totalCompounds || 1)) * 100
                  )} 
                  className="h-3"
                />

                {Array.isArray(batchInfo.results) && batchInfo.results.length > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowBatchResults(true)}
                  >
                    <FileCheck className="h-4 w-4 mr-2" />
                    View {batchInfo.results.length} Results
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card data-testid="card-quick-actions">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button 
              className="w-full text-left py-2 px-3 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <History className="inline mr-2 h-4 w-4 text-muted-foreground" />
              Recent Compounds
            </button>
            <button 
              className="w-full text-left py-2 px-3 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <Star className="inline mr-2 h-4 w-4 text-muted-foreground" />
              Saved Predictions
            </button>
            
            {Array.isArray(recentCompounds) && recentCompounds.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Recent:</p>
                {(recentCompounds as any[]).slice(0, 3).map((compound: any) => (
                  <button
                    key={compound.id}
                    onClick={() => handleRecentCompoundSelect(compound)}
                    className="w-full text-left py-1 px-2 text-xs rounded hover:bg-accent transition-colors"
                  >
                    <div className="truncate font-mono">{compound.smiles}</div>
                    {compound.name && (
                      <div className="truncate text-muted-foreground">{compound.name}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            <button 
              className="w-full text-left py-2 px-3 text-sm rounded-md hover:bg-accent transition-colors"
              onClick={() => {
                setSmiles('C1=CC=CC=C1');
                setCompoundName('Benzene');
              }}
            >
              <Database className="inline mr-2 h-4 w-4 text-muted-foreground" />
              Example Compounds
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Chemical Structure Drawer Dialog */}
      <ChemicalDrawer 
        open={showChemicalDrawer}
        onOpenChange={setShowChemicalDrawer}
        onAnalyze={handleDrawerAnalyze}
      />
    </>
  );
}
