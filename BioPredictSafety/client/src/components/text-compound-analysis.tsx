import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Pill, 
  Target, 
  TrendingUp,
  Shield,
  AlertTriangle,
  Info,
  Beaker,
  Dna,
  CheckSquare,
  Database
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  source: 'rxnorm' | 'openfda' | 'combined' | 'none';
  molecularFormula?: string;
  smiles?: string;
  warnings: string[];
  sourceData: {
    rxnorm?: any;
    openfda?: any;
  };
}

export interface CompoundAnalysis {
  medicineName: string;
  activeCompound: {
    name: string;
    molecularFormula: string;
    smiles: string;
    molecularWeight: number;
  };
  chemicalProperties: {
    logP: number;
    tpsa: number;
    hBondDonors: number;
    hBondAcceptors: number;
    rotatableBonds: number;
    lipinskiViolations: number;
  };
  drugLikeness: {
    passesRuleOfFive: boolean;
    bioactivityScore: number;
    bioactivityLevel: "high" | "moderate" | "low";
    therapeuticAreas: string[];
    pharmacologicalClasses: string[];
  };
  toxicity: {
    hepatotoxicity: { probability: number; risk: string };
    cardiotoxicity: { probability: number; risk: string };
    mutagenicity: { probability: number; risk: string };
    overallSafety: string;
  };
  mechanismOfAction: {
    molecularTargets: string[];
    biologicalMechanism: string;
    pathwayDescription: string;
  };
  clinicalInfo: {
    diseasesTeated: string[];
    primaryIndications: string[];
    commonSideEffects: string[];
    contraindications: string[];
    dosageForm: string;
    routeOfAdministration: string;
  };
  relatedCompounds: Array<{ name: string; similarity: string }>;
  imageData?: {
    description: string;
    suggestedSearchTerm: string;
  };
  validation?: ValidationResult;
  confidence: number;
  analysisTimestamp: string;
}

interface Props {
  analysis: CompoundAnalysis;
}

function getToxicityColor(risk: string): string {
  switch (risk.toUpperCase()) {
    case "LOW": return "bg-green-500";
    case "MEDIUM": return "bg-yellow-500";
    case "HIGH": return "bg-red-500";
    default: return "bg-gray-500";
  }
}

function getBioactivityColor(level: string): string {
  switch (level.toLowerCase()) {
    case "high": return "text-green-600";
    case "moderate": return "text-yellow-600";
    case "low": return "text-red-600";
    default: return "text-gray-600";
  }
}

export default function TextCompoundAnalysis({ analysis }: Props) {
  const confidencePercent = Math.round(analysis.confidence * 100);
  
  return (
    <div className="space-y-6 w-full">
      {/* Header with confidence */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">{analysis.medicineName}</CardTitle>
              <CardDescription className="text-lg mt-1">
                {analysis.activeCompound.name}
              </CardDescription>
            </div>
            <Badge variant={confidencePercent >= 70 ? "default" : "secondary"} className="text-lg px-4 py-2">
              {confidencePercent}% Confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Validation Alert */}
          {analysis.validation && (
            <Alert variant={analysis.validation.isValid ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {analysis.validation.isValid ? (
                  <CheckSquare className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <div className="flex-1">
                  <AlertTitle className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    {analysis.validation.source === 'combined' ? 'Validated (RxNorm + FDA)' :
                     analysis.validation.source === 'rxnorm' ? 'Verified via RxNorm' :
                     analysis.validation.source === 'openfda' ? 'Verified via FDA' :
                     'No external verification available'}
                  </AlertTitle>
                  <AlertDescription className="mt-1 text-sm">
                    {analysis.validation.warnings.length === 0 ? (
                      <span className="text-green-700 dark:text-green-300">
                        ✓ Data matches authoritative sources
                      </span>
                    ) : (
                      <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-300">
                        {analysis.validation.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Molecular Formula</p>
              <p className="font-mono font-semibold">{analysis.activeCompound.molecularFormula}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Molecular Weight</p>
              <p className="font-semibold">{analysis.activeCompound.molecularWeight.toFixed(2)} g/mol</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SMILES Notation</p>
              <p className="font-mono text-sm truncate" title={analysis.activeCompound.smiles}>
                {analysis.activeCompound.smiles}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drug-Likeness & Bioactivity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Drug-Likeness & Bioactivity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Lipinski's Rule of Five</span>
            {analysis.drugLikeness.passesRuleOfFive ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                PASS
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-4 w-4" />
                FAIL ({analysis.chemicalProperties.lipinskiViolations} violations)
              </Badge>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Bioactivity Score (pIC50)</span>
              <span className={`font-bold ${getBioactivityColor(analysis.drugLikeness.bioactivityLevel)}`}>
                {analysis.drugLikeness.bioactivityScore.toFixed(2)} ({analysis.drugLikeness.bioactivityLevel.toUpperCase()})
              </span>
            </div>
            <Progress value={analysis.drugLikeness.bioactivityScore * 10} className="h-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Therapeutic Areas</p>
              <div className="flex flex-wrap gap-1">
                {analysis.drugLikeness.therapeuticAreas.map((area, idx) => (
                  <Badge key={idx} variant="outline">{area}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Pharmacological Classes</p>
              <div className="flex flex-wrap gap-1">
                {analysis.drugLikeness.pharmacologicalClasses.map((cls, idx) => (
                  <Badge key={idx} variant="secondary">{cls}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chemical Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Chemical Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">LogP (Lipophilicity)</p>
              <p className="font-semibold text-lg">{analysis.chemicalProperties.logP.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">TPSA</p>
              <p className="font-semibold text-lg">{analysis.chemicalProperties.tpsa.toFixed(2)} Ų</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">H-Bond Donors</p>
              <p className="font-semibold text-lg">{analysis.chemicalProperties.hBondDonors}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">H-Bond Acceptors</p>
              <p className="font-semibold text-lg">{analysis.chemicalProperties.hBondAcceptors}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rotatable Bonds</p>
              <p className="font-semibold text-lg">{analysis.chemicalProperties.rotatableBonds}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lipinski Violations</p>
              <p className="font-semibold text-lg">{analysis.chemicalProperties.lipinskiViolations}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toxicity Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Toxicity Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Overall Safety</AlertTitle>
            <AlertDescription>{analysis.toxicity.overallSafety}</AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Hepatotoxicity (Liver)</span>
                <Badge className={getToxicityColor(analysis.toxicity.hepatotoxicity.risk)}>
                  {analysis.toxicity.hepatotoxicity.risk}
                </Badge>
              </div>
              <Progress value={analysis.toxicity.hepatotoxicity.probability * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {(analysis.toxicity.hepatotoxicity.probability * 100).toFixed(1)}% probability
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Cardiotoxicity (Heart)</span>
                <Badge className={getToxicityColor(analysis.toxicity.cardiotoxicity.risk)}>
                  {analysis.toxicity.cardiotoxicity.risk}
                </Badge>
              </div>
              <Progress value={analysis.toxicity.cardiotoxicity.probability * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {(analysis.toxicity.cardiotoxicity.probability * 100).toFixed(1)}% probability
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Mutagenicity (DNA)</span>
                <Badge className={getToxicityColor(analysis.toxicity.mutagenicity.risk)}>
                  {analysis.toxicity.mutagenicity.risk}
                </Badge>
              </div>
              <Progress value={analysis.toxicity.mutagenicity.probability * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {(analysis.toxicity.mutagenicity.probability * 100).toFixed(1)}% probability
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mechanism of Action */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Mechanism of Action
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Molecular Targets</p>
            <div className="flex flex-wrap gap-1">
              {analysis.mechanismOfAction.molecularTargets.map((target, idx) => (
                <Badge key={idx} variant="default">{target}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Biological Mechanism</p>
            <p className="text-sm">{analysis.mechanismOfAction.biologicalMechanism}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Affected Pathways</p>
            <p className="text-sm">{analysis.mechanismOfAction.pathwayDescription}</p>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Clinical Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Dosage Form</p>
              <p className="font-semibold">{analysis.clinicalInfo.dosageForm}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Route of Administration</p>
              <p className="font-semibold">{analysis.clinicalInfo.routeOfAdministration}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Diseases Treated</p>
            <div className="flex flex-wrap gap-1">
              {analysis.clinicalInfo.diseasesTeated.map((disease, idx) => (
                <Badge key={idx} variant="outline">{disease}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Primary Indications</p>
            <div className="flex flex-wrap gap-1">
              {analysis.clinicalInfo.primaryIndications.map((indication, idx) => (
                <Badge key={idx} variant="secondary">{indication}</Badge>
              ))}
            </div>
          </div>

          {analysis.clinicalInfo.commonSideEffects.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Common Side Effects</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm">
                  {analysis.clinicalInfo.commonSideEffects.map((effect, idx) => (
                    <li key={idx}>{effect}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {analysis.clinicalInfo.contraindications.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Contraindications</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm">
                  {analysis.clinicalInfo.contraindications.map((contra, idx) => (
                    <li key={idx}>{contra}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Related Compounds */}
      {analysis.relatedCompounds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dna className="h-5 w-5" />
              Related Compounds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.relatedCompounds.map((compound, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <span className="font-medium">{compound.name}</span>
                  <span className="text-sm text-muted-foreground">{compound.similarity}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Data (if available) */}
      {analysis.imageData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Visual Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-sm">{analysis.imageData.description}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Suggested Image Search</p>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {analysis.imageData.suggestedSearchTerm}
              </code>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
