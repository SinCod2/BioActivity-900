import { Button } from "@/components/ui/button";
import { Brain, Save, Share } from "lucide-react";
import { AnalysisResult } from "@/types/molecular";
import { formatPIC50, formatConfidence } from "@/lib/molecular-utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PredictionResultsProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
}

export default function PredictionResults({ analysis, isAnalyzing }: PredictionResultsProps) {
  const prediction = analysis?.prediction;
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!analysis) throw new Error("No analysis to save");
      const res = await apiRequest('POST', '/api/predictions/save', { compoundId: analysis.compound.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/saved'] });
      toast({ title: 'Saved', description: 'Prediction saved successfully.' });
    },
    onError: (e) => toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Failed to save', variant: 'destructive' })
  });

  async function handleShare() {
    if (!analysis) return;
    const url = `${window.location.origin}/?compoundId=${analysis.compound.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BioPredict Result', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: 'Shareable link copied to clipboard.' });
      }
    } catch {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Shareable link copied to clipboard.' });
    }
  }

  return (
    <>
      <div
        data-testid="card-prediction-results"
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-background/85 via-primary/5 to-background/65 p-[1px] shadow-[0_40px_120px_-70px_rgba(59,130,246,0.75)] backdrop-blur-2xl"
      >
        <div className="absolute -top-48 -left-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-32 -right-10 h-64 w-64 rounded-full bg-purple-500/30 blur-3xl" />
        <div className="absolute inset-0 opacity-35 [mask-image:radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_70%)]">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(59,130,246,0.14),transparent_65%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)] bg-[length:44px_44px] opacity-40" />
        </div>

        <div className="relative z-10 rounded-[27px] bg-card/80 p-6 pb-7">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-primary/70">Bioactivity Prediction</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/35 bg-primary/10 text-primary shadow-[0_0_32px_-12px_rgba(59,130,246,0.8)]">
                  <Brain className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">ML Prediction</h2>
                  <p className="text-xs text-muted-foreground">
                    Intelligent inference powered by BioPredict models
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur">
                Random Forest · 15,247 compounds
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur">
                {prediction
                  ? `Confidence ${formatConfidence(prediction.confidence)}`
                  : isAnalyzing
                    ? "Running inference…"
                    : "Awaiting analysis"}
              </span>
            </div>
          </header>

          <div className="mt-8 space-y-8">
            {isAnalyzing ? (
              <div className="space-y-8">
                <div className="relative mx-auto h-48 w-48">
                  <div className="absolute inset-0 rounded-full border border-white/10" />
                  <div className="absolute inset-6 rounded-full border border-primary/30" />
                  <div className="absolute inset-3 animate-spin-slow rounded-full border border-primary/20" />
                  <div className="absolute inset-0 animate-spin-slow">
                    <span className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_14px_rgba(59,130,246,0.8)]" />
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
                    <span className="text-xs uppercase tracking-[0.4em] text-primary/70">pIC50</span>
                    <span className="text-3xl font-semibold text-primary">…</span>
                    <span className="text-[11px] text-muted-foreground">Synthesizing response</span>
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5" data-testid="container-model-info">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    Model Diagnostics
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
                    <div className="rounded-xl border border-white/5 bg-background/60 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70">Training</p>
                      <p className="mt-1 text-sm font-medium text-foreground">15,247 compounds</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-background/60 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70">Algorithm</p>
                      <p className="mt-1 text-sm font-medium text-foreground">Random Forest</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-background/60 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70">Status</p>
                      <p className="mt-1 text-sm font-medium text-foreground">Running…</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-background/60 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70">Output</p>
                      <p className="mt-1 text-sm font-medium text-foreground">Calibrating</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : prediction ? (
              <>
                <div className="relative mx-auto flex h-52 w-52 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-primary/25" />
                  <div className="absolute inset-4 rounded-full border border-primary/30" />
                  <div className="absolute inset-8 rounded-full border border-primary/20" />
                  <div className="absolute inset-2 animate-spin-slow rounded-full border border-primary/20" />
                  <div className="absolute inset-0 animate-spin-slow-reverse">
                    <span className="absolute top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_20px_rgba(59,130,246,0.75)]" />
                    <span className="absolute bottom-4 right-6 h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.6)]" />
                  </div>
                  <div className="relative flex flex-col items-center justify-center gap-2 text-center">
                    <span className="text-xs uppercase tracking-[0.4em] text-primary/70">pIC50</span>
                    <span className="text-5xl font-semibold text-primary" data-testid="value-pic50">
                      {formatPIC50(prediction.pic50)}
                    </span>
                    <span className="text-xs text-muted-foreground" data-testid="text-confidence">
                      Confidence {formatConfidence(prediction.confidence)}
                    </span>
                  </div>
                </div>

                <div
                  className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
                  data-testid="container-model-info"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    Model Diagnostics
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
                    <div className="rounded-xl border border-white/5 bg-background/70 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70">Algorithm</p>
                      <p className="mt-1 text-sm font-medium text-foreground">Random Forest</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-background/70 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70">Training Set</p>
                      <p className="mt-1 text-sm font-medium text-foreground">15,247 compounds</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-background/70 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70">Performance</p>
                      <p className="mt-1 text-sm font-medium text-foreground">R² 0.82 · RMSE 0.65</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-background/70 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70">Updated</p>
                      <p className="mt-1 text-sm font-medium text-foreground">2024-01-15</p>
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-2xl border border-white/10 bg-gradient-to-r from-primary/10 via-background/80 to-purple-500/10 p-5"
                  data-testid="container-prediction-range"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="uppercase tracking-[0.3em]">Confidence band</span>
                    <span className="font-semibold text-foreground">
                      {(prediction.pic50 - 0.36).toFixed(2)} - {(prediction.pic50 + 0.36).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-4 h-3 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-primary via-blue-400 to-purple-500 shadow-[0_0_20px_rgba(59,130,246,0.45)]"
                      style={{
                        width: `${Math.max(12, Math.min(92, ((prediction.pic50 - 4) / 5) * 100))}%`,
                        marginLeft: `${Math.max(0, Math.min(80, ((prediction.pic50 - 4.5) / 5) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                    <span>Low activity (4.0)</span>
                    <span>High activity (9.0)</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <Brain className="h-5 w-5" />
                </div>
                <p className="text-sm">
                  Run a molecular analysis to unlock high-fidelity bioactivity predictions and confidence metrics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Button
          className="relative w-full overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/80 via-primary to-indigo-500 text-primary-foreground shadow-[0_24px_48px_-32px_rgba(59,130,246,0.85)] transition-transform duration-500 hover:-translate-y-0.5"
          disabled={!analysis || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          data-testid="button-save-prediction"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save Prediction"}
        </Button>
        <Button
          variant="outline"
          className="w-full rounded-2xl border border-white/15 bg-white/10 text-foreground backdrop-blur transition-transform duration-500 hover:-translate-y-0.5"
          disabled={!analysis}
          onClick={handleShare}
          data-testid="button-share-results"
        >
          <Share className="mr-2 h-4 w-4" />
          Share Results
        </Button>
      </div>
    </>
  );
}
