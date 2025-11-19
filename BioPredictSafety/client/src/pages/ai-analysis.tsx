import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Loader, Info, Sparkles } from "lucide-react";
import TextCompoundAnalysis, { type CompoundAnalysis } from "@/components/text-compound-analysis";

export default function AIAnalysisPage() {
  const [medicineName, setMedicineName] = useState('');
  const [analysis, setAnalysis] = useState<CompoundAnalysis | null>(null);
  const { toast } = useToast();

  const textAnalysisMutation = useMutation({
    mutationFn: async ({ medicineName }: { medicineName: string }) => {
      const response = await apiRequest('POST', '/api/compounds/analyze-text', { medicineName });
      return response.json();
    },
    onSuccess: (data) => {
      if (data?.success && data?.analysis) {
        setAnalysis(data.analysis);
        toast({
          title: "AI Analysis Complete",
          description: `${data.analysis.medicineName} analyzed successfully with ${Math.round(data.analysis.confidence * 100)}% confidence.`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze medicine by name",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (!medicineName.trim()) {
      toast({
        title: "Missing Input",
        description: "Please enter a medicine name",
        variant: "destructive",
      });
      return;
    }
    textAnalysisMutation.mutate({ medicineName: medicineName.trim() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-purple-600" />
            AI-Powered Medicine Analysis
          </h1>
          <p className="text-muted-foreground text-lg">
            Get comprehensive pharmaceutical predictions powered by Google Gemini AI
          </p>
        </div>

        {/* Input Card */}
        <Card className="mb-8 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Enter Medicine Name
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-white/60 dark:bg-black/20">
              <Info className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-sm">
                <strong>AI generates complete pharmaceutical data including:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Molecular structure (SMILES, formula, molecular weight)</li>
                  <li>Chemical properties (LogP, TPSA, H-bonds, rotatable bonds)</li>
                  <li>Drug-likeness assessment and bioactivity predictions (pIC50)</li>
                  <li>Toxicity risk analysis (hepatotoxicity, cardiotoxicity, mutagenicity)</li>
                  <li>Mechanism of action and molecular targets</li>
                  <li>Clinical information, indications, side effects, and contraindications</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="medicine-name" className="text-base">
                Medicine Name
              </Label>
              <Input
                id="medicine-name"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                className="mt-2"
                placeholder="e.g., Paracetamol, Ibuprofen, Metformin, Aspirin, Lisinopril"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && medicineName.trim() && !textAnalysisMutation.isPending) {
                    handleAnalyze();
                  }
                }}
              />
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={textAnalysisMutation.isPending || !medicineName.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {textAnalysisMutation.isPending ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Analyze with AI
                </>
              )}
            </Button>

            {/* Example suggestions */}
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Try these examples:</p>
              <div className="flex flex-wrap gap-2">
                {['Paracetamol', 'Ibuprofen', 'Metformin', 'Aspirin', 'Lisinopril', 'Atorvastatin'].map((name) => (
                  <button
                    key={name}
                    onClick={() => setMedicineName(name)}
                    className="px-3 py-1 text-xs bg-white dark:bg-slate-800 border rounded-full hover:bg-accent transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {analysis && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TextCompoundAnalysis analysis={analysis} />
          </div>
        )}

        {/* Loading State */}
        {textAnalysisMutation.isPending && (
          <Card className="animate-pulse">
            <CardContent className="py-12 text-center">
              <Loader className="h-12 w-12 animate-spin mx-auto mb-4 text-purple-600" />
              <p className="text-lg font-medium">Analyzing {medicineName}...</p>
              <p className="text-sm text-muted-foreground mt-2">
                This may take 5-15 seconds as AI generates comprehensive pharmaceutical data
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
