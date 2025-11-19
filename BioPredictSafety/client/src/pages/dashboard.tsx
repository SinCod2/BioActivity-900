import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import CompoundInput from "@/components/compound-input";
import MolecularVisualization from "@/components/molecular-visualization";
import PredictionResults from "@/components/prediction-results";
import { LoadingOverlay } from "@/components/loading-animation";
import AnalysisPipeline from "@/components/analysis-pipeline";
import SafetyOverview from "@/components/safety-overview";
import { AnalysisResult } from "@/types/molecular";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'analyzing' | 'generating' | 'calculating' | 'predicting'>('analyzing');
  const queryClient = useQueryClient();

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setCurrentAnalysis(result);
    setIsAnalyzing(false);
    // Store in sessionStorage for access in other pages
    sessionStorage.setItem('currentAnalysis', JSON.stringify(result));
    // Invalidate history to refresh immediately
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['history'] }), 500);
  };

  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
    // Simulate loading phases
    setLoadingPhase('analyzing');
    setTimeout(() => setLoadingPhase('generating'), 1500);
    setTimeout(() => setLoadingPhase('calculating'), 3000);
    setTimeout(() => setLoadingPhase('predicting'), 4500);
  };

  const handleAnalysisError = () => {
    setIsAnalyzing(false);
  };

  // If route has ?compoundId=... or ?input=... load that analysis initially
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('compoundId');
    const input = params.get('input'); // For history re-run
    
    // Check if there's a pending compound from IoT analysis
    const pendingCompound = sessionStorage.getItem('pendingCompound');
    
    if (pendingCompound) {
      try {
        const { smiles, name } = JSON.parse(pendingCompound);
        // Clear the pending compound
        sessionStorage.removeItem('pendingCompound');
        
        // Auto-trigger analysis with the compound data
        setIsAnalyzing(true);
        setLoadingPhase('analyzing');
        
        apiRequest('POST', '/api/compounds/analyze', { smiles, name })
          .then(res => res.json())
          .then((data) => {
            setCurrentAnalysis(data);
            sessionStorage.setItem('currentAnalysis', JSON.stringify(data));
          })
          .catch(() => {})
          .finally(() => setIsAnalyzing(false));
      } catch (error) {
        console.error('Failed to parse pending compound:', error);
      }
    } else if (input) {
      // Re-run from history
      setIsAnalyzing(true);
      setLoadingPhase('analyzing');
      
      apiRequest('POST', '/api/compounds/analyze', { smiles: input, name: input })
        .then(res => res.json())
        .then((data) => {
          setCurrentAnalysis(data);
          sessionStorage.setItem('currentAnalysis', JSON.stringify(data));
        })
        .catch(() => {})
        .finally(() => setIsAnalyzing(false));
    } else if (id) {
      setIsAnalyzing(true);
      apiRequest('GET', `/api/compounds/${id}`)
        .then(res => res.json())
        .then((data) => setCurrentAnalysis(data))
        .catch(() => {})
        .finally(() => setIsAnalyzing(false));
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <LoadingOverlay 
        isLoading={isAnalyzing} 
        phase={loadingPhase}
        message="Please wait while we analyze your compound..."
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Molecular Analysis</h1>
          <p className="text-muted-foreground">
            Enter a compound to analyze its molecular properties and safety profile
          </p>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-4 space-y-6">
            <CompoundInput
              onAnalysisComplete={handleAnalysisComplete}
              onAnalysisStart={handleAnalysisStart}
              onAnalysisError={handleAnalysisError}
              isAnalyzing={isAnalyzing}
            />
            <AnalysisPipeline
              analysis={currentAnalysis}
              isAnalyzing={isAnalyzing}
              activePhase={loadingPhase}
            />
          </div>

          {/* Visualization Panel */}
          <div className="lg:col-span-5 space-y-6">
            <MolecularVisualization 
              analysis={currentAnalysis}
              isAnalyzing={isAnalyzing}
            />
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-6">
            <PredictionResults 
              analysis={currentAnalysis}
              isAnalyzing={isAnalyzing}
            />
            <SafetyOverview
              analysis={currentAnalysis}
              isAnalyzing={isAnalyzing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
