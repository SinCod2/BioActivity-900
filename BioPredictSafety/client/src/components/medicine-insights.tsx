import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Pill, 
  Clock, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  XCircle,
  Beaker,
  ShieldAlert,
  Activity
} from "lucide-react";
import { MedicineInsights } from "@/types/molecular";

interface MedicineInsightsProps {
  insights: MedicineInsights | null;
  isAnalyzing: boolean;
}

export default function MedicineInsightsDisplay({ 
  insights, 
  isAnalyzing 
}: MedicineInsightsProps) {
  if (isAnalyzing) {
    return (
      <Card data-testid="card-medicine-insights-loading">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
            <Pill className="mr-2 text-primary" />
            Medicine Photo Analysis
          </h2>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return null;
  }

  const confidenceColor = 
    insights.confidence.score >= 0.7 ? 'text-green-600' :
    insights.confidence.score >= 0.5 ? 'text-yellow-600' :
    'text-orange-600';

  const prescriptionBadgeVariant = 
    insights.safety.prescriptionStatus.toLowerCase().includes('prescription') ? 'destructive' : 'default';

  return (
    <div className="space-y-4">
      {/* Main Summary Card */}
      <Card data-testid="card-medicine-insights">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center">
              <Pill className="mr-2 text-primary" />
              Medicine Photo Analysis
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant={prescriptionBadgeVariant} className="text-xs">
                {insights.safety.prescriptionStatus}
              </Badge>
              <div className={`flex items-center gap-1 text-sm ${confidenceColor}`}>
                {insights.confidence.labelReadable ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {(insights.confidence.score * 100).toFixed(0)}% confidence
                </span>
              </div>
            </div>
          </div>

          {/* AI Disclaimer */}
          <Alert className="mb-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-900 dark:text-blue-100">
              <strong>Informational Only:</strong> This analysis is AI-generated and should not replace professional medical advice. 
              Always consult a healthcare provider before using any medication.
            </AlertDescription>
          </Alert>

          {insights.isFallback && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Gemini could not extract reliable details from this photo. Please retake a clear picture of the medicine label for more accurate results.
              </AlertDescription>
            </Alert>
          )}

          {/* Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center">
              <Activity className="h-4 w-4 mr-2 text-primary" />
              Summary
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {insights.summary}
            </p>
            {insights.confidence.rationale && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                {insights.confidence.rationale}
              </p>
            )}
          </div>

          {/* Ingredients */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center">
              <Beaker className="h-4 w-4 mr-2 text-primary" />
              Active Ingredients
            </h3>
            <div className="space-y-2">
              {insights.ingredients.active.map((ingredient, idx) => (
                <div 
                  key={idx}
                  className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm text-foreground">
                      {ingredient.name}
                    </div>
                    {ingredient.strength && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Strength: {ingredient.strength}
                      </div>
                    )}
                    {ingredient.smiles && (
                      <div className="text-xs font-mono text-muted-foreground mt-1 truncate">
                        SMILES: {ingredient.smiles}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {insights.ingredients.formulation && (
              <div className="mt-2 text-xs text-muted-foreground">
                <strong>Formulation:</strong> {insights.ingredients.formulation}
              </div>
            )}
            {insights.ingredients.inactive.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                <strong>Inactive ingredients:</strong> {insights.ingredients.inactive.join(', ')}
              </div>
            )}
          </div>

          {/* Usage Guidelines */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center">
              <Clock className="h-4 w-4 mr-2 text-primary" />
              Usage Guidelines
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground mb-1">Dosage</div>
                <div className="text-sm text-foreground">{insights.usageGuidelines.dosage}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground mb-1">Timing</div>
                <div className="text-sm text-foreground">{insights.usageGuidelines.timing}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground mb-1">Route</div>
                <div className="text-sm text-foreground">{insights.usageGuidelines.route}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg col-span-1 md:col-span-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">Instructions</div>
                <div className="text-sm text-foreground">{insights.usageGuidelines.instructions}</div>
              </div>
            </div>
          </div>

          {/* Safety Information */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center">
              <ShieldAlert className="h-4 w-4 mr-2 text-primary" />
              Safety Information
            </h3>
            
            {/* Warnings */}
            {insights.safety.warnings.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-foreground mb-2">Warnings</div>
                <ul className="space-y-1">
                  {insights.safety.warnings.map((warning, idx) => (
                    <li key={idx} className="flex items-start text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 mr-2 mt-0.5 text-yellow-600 flex-shrink-0" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contraindications */}
            {insights.safety.contraindications.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-foreground mb-2">Contraindications</div>
                <ul className="space-y-1">
                  {insights.safety.contraindications.map((contra, idx) => (
                    <li key={idx} className="flex items-start text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3 mr-2 mt-0.5 text-red-600 flex-shrink-0" />
                      <span>{contra}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Side Effects */}
            {insights.safety.sideEffects.length > 0 && (
              <div>
                <div className="text-xs font-medium text-foreground mb-2">Common Side Effects</div>
                <div className="flex flex-wrap gap-1">
                  {insights.safety.sideEffects.map((effect, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {effect}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* External Data Enrichments */}
          {(insights.rxNorm || insights.openFDALabel) && (
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">External References</h3>
              <div className="space-y-2 text-xs">
                {insights.rxNorm?.rxcui && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">RxNorm</Badge>
                    <span className="text-muted-foreground">
                      RXCUI: {insights.rxNorm.rxcui} ({insights.rxNorm.name})
                    </span>
                  </div>
                )}
                {insights.openFDALabel?.brand && (
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-xs">OpenFDA</Badge>
                    <div className="flex-1">
                      <div className="text-muted-foreground">Brand: {insights.openFDALabel.brand}</div>
                      {insights.openFDALabel.warnings && insights.openFDALabel.warnings.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {insights.openFDALabel.warnings.length} additional warning(s) from FDA label
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compound Candidates */}
          {insights.compoundCandidates.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                Identified Compounds ({insights.compoundCandidates.length})
              </h3>
              <div className="space-y-2">
                {insights.compoundCandidates.slice(0, 3).map((candidate, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{candidate.name}</div>
                      {candidate.smiles && (
                        <div className="font-mono text-muted-foreground truncate mt-1">
                          {candidate.smiles}
                        </div>
                      )}
                      {candidate.rationale && (
                        <div className="text-muted-foreground italic mt-1">
                          {candidate.rationale}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {(candidate.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
