import { type ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalysisResult, SafetyAssessment } from "@/types/molecular";
import { cn } from "@/lib/utils";
import { AlertTriangle, HeartPulse, ShieldCheck, Zap } from "lucide-react";

interface SafetyOverviewProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
}

const riskPalette: Record<SafetyAssessment["overallRisk"], { label: string; badge: string; track: string; fill: string }> = {
  LOW: {
    label: "Low",
    badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    track: "bg-emerald-500/10",
    fill: "from-emerald-400 via-emerald-500 to-emerald-600",
  },
  MEDIUM: {
    label: "Moderate",
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    track: "bg-amber-500/10",
    fill: "from-amber-400 via-amber-500 to-orange-500",
  },
  HIGH: {
    label: "High",
    badge: "bg-rose-500/15 text-rose-500 border-rose-500/30",
    track: "bg-rose-500/10",
    fill: "from-rose-400 via-rose-500 to-red-600",
  },
};

type ToxicityKey = keyof Pick<
  SafetyAssessment,
  "hepatotoxicity" | "cardiotoxicity" | "mutagenicity" | "hergInhibition"
>;

const metrics: Array<{ key: ToxicityKey; label: string; icon: ElementType }> = [
  { key: "hepatotoxicity", label: "Hepatotoxicity", icon: ShieldCheck },
  { key: "cardiotoxicity", label: "Cardiotoxicity", icon: HeartPulse },
  { key: "mutagenicity", label: "Mutagenicity", icon: Zap },
  { key: "hergInhibition", label: "hERG Inhibition", icon: AlertTriangle },
];

export function SafetyOverview({ analysis, isAnalyzing }: SafetyOverviewProps) {
  const assessment = analysis?.prediction?.safetyAssessment ?? null;

  return (
    <Card className="border-border/60 bg-background/85 backdrop-blur" data-testid="card-safety-overview">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Safety Envelope</CardTitle>
        <p className="text-sm text-muted-foreground">
          Instant risk profiling across toxicology endpoints and ensemble model consensus.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {isAnalyzing ? (
          <div className="animate-pulse space-y-4">
            <div className="h-7 w-32 rounded-full bg-muted/40" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="space-y-2">
                  <div className="h-4 w-24 rounded-full bg-muted/30" />
                  <div className="h-2 w-full rounded-full bg-muted/40" />
                </div>
              ))}
            </div>
          </div>
        ) : assessment ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Overall profile</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {assessment.overallScore.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ensemble safety score · out of 10
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "border px-3 py-1 text-xs font-medium",
                  riskPalette[assessment.overallRisk].badge
                )}
              >
                {riskPalette[assessment.overallRisk].label} risk
              </Badge>
            </div>

            <div className="space-y-4">
              {metrics.map(({ key, label, icon: Icon }) => {
                const metric = assessment[key];
                const palette = riskPalette[metric.risk];
                const percentage = Math.round(metric.probability * 100);

                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <div className="flex items-center gap-2 text-foreground">
                        <span className={cn("grid h-8 w-8 place-items-center rounded-xl border", palette.badge)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>{label}</span>
                      </div>
                      <span className={cn("rounded-full border px-2 py-0.5", palette.badge)}>
                        {palette.label}
                      </span>
                    </div>
                    <div className={cn("h-2 w-full overflow-hidden rounded-full", palette.track)}>
                      <span
                        className={cn(
                          "block h-full rounded-full bg-gradient-to-r",
                          palette.fill
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Probability {percentage}% · risk category {palette.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
            Submit a molecule to unlock the AI-guided toxicology envelope and endpoint probabilities.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SafetyOverview;
