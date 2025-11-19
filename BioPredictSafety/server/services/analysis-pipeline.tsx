import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalysisResult } from "@/types/molecular";
import { cn } from "@/lib/utils";
import {
  ActivitySquare,
  Atom,
  Beaker,
  Cpu,
  Sparkles,
  TimerReset,
} from "lucide-react";

const pipelineStages = [
  {
    id: "analyzing" as const,
    title: "Molecular Intake",
    description: "Normalizing SMILES and validating stoichiometry",
    icon: Atom,
  },
  {
    id: "generating" as const,
    title: "Feature Synthesis",
    description: "Building quantum descriptors and fingerprints",
    icon: Beaker,
  },
  {
    id: "calculating" as const,
    title: "Model Calibration",
    description: "Running ensemble simulations across inference nodes",
    icon: Cpu,
  },
  {
    id: "predicting" as const,
    title: "Safety Projection",
    description: "Scoring bioactivity and risk envelopes",
    icon: ActivitySquare,
  },
];

interface AnalysisPipelineProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  activePhase: "analyzing" | "generating" | "calculating" | "predicting";
}

export function AnalysisPipeline({ analysis, isAnalyzing, activePhase }: AnalysisPipelineProps) {
  const activeIndex = useMemo(() => {
    const idx = pipelineStages.findIndex((stage) => stage.id === activePhase);
    if (idx === -1) return 0;
    return idx;
  }, [activePhase]);

  const statusForIndex = (index: number) => {
    if (isAnalyzing) {
      if (index < activeIndex) return "done";
      if (index === activeIndex) return "active";
      return "pending";
    }

    if (analysis) return "done";
    return "idle";
  };

  const latestConfidence = analysis?.prediction?.confidence ?? null;
  const formattedConfidence =
    typeof latestConfidence === "number" ? (latestConfidence * 100).toFixed(1) : null;
  const latestRisk = analysis?.prediction?.safetyAssessment?.overallRisk ?? null;
  const predictionTimestamp = analysis?.prediction?.createdAt
    ? new Date(analysis.prediction.createdAt)
    : null;

  const formatRiskLabel = (risk: typeof latestRisk) => {
    if (!risk) return "unknown";
    return risk.charAt(0) + risk.slice(1).toLowerCase();
  };

  return (
    <Card className="border-border/60 bg-background/80 backdrop-blur" data-testid="card-analysis-pipeline">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Analysis Pipeline
          </CardTitle>
          {isAnalyzing ? (
            <Badge variant="outline" className="border-primary/40 text-primary">Processing</Badge>
          ) : analysis ? (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">Completed</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Idle</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Follow each computational stage while the compound moves from raw structure to full bioactivity insight.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="space-y-4">
          {pipelineStages.map((stage, index) => {
            const state = statusForIndex(index);
            const Icon = stage.icon;

            return (
              <li
                key={stage.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border px-4 py-3 transition-colors",
                  state === "active" && "border-primary/50 bg-primary/10",
                  state === "done" && "border-emerald-500/30 bg-emerald-500/5",
                  state === "pending" && "border-border/40 bg-muted/20",
                  state === "idle" && "border-border/30 bg-muted/10"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-sm transition-colors",
                      state === "active" && "border-primary/50 bg-primary/15 text-primary",
                      state === "done" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-500",
                      state === "pending" && "border-border/40 bg-background/70 text-muted-foreground",
                      state === "idle" && "border-border/30 bg-background/60 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{stage.title}</p>
                      {state === "done" && (
                        <span className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-500">Done</span>
                      )}
                      {state === "active" && (
                        <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Now</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{stage.description}</p>
                  </div>
                </div>
                {index < pipelineStages.length - 1 && (
                  <span
                    className={cn(
                      "absolute left-[1.75rem] top-[3.75rem] h-8 w-px",
                      state === "done" ? "bg-emerald-500/40" : "bg-border/40"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <TimerReset className="h-4 w-4 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {analysis ? "Latest analysis synchronized" : "Ready for next compound"}
              </p>
              <p>
                {analysis ? (
                  <>
                    Confidence score {formattedConfidence ? `${formattedConfidence}%` : "n/a"} · Risk level{' '}
                    <span className="font-medium text-foreground">{formatRiskLabel(latestRisk)}</span>
                    {predictionTimestamp && (
                      <>
                        {' '}• {predictionTimestamp.toLocaleDateString()} {predictionTimestamp.toLocaleTimeString()}
                      </>
                    )}
                  </>
                ) : (
                  "Load a compound to activate the telemetry timeline."
                )}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AnalysisPipeline;
