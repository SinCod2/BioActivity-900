import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, ChevronDown, AlertTriangle, Heart, Dna, Activity, Info } from "lucide-react";
import { SafetyAssessment } from "@/types/molecular";
import { getRiskColor, getRiskBgColor, getOverallRiskDisplay, formatProbability } from "@/lib/molecular-utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SafetyAssessmentProps {
  assessment: SafetyAssessment | null;
  isLoading: boolean;
}

// Detailed information for each toxicity type
const toxicityDetails = {
  hepatotoxicity: {
    icon: AlertTriangle,
    title: "Hepatotoxicity (Liver Toxicity)",
    description: "Assessment of potential liver damage or dysfunction caused by the compound.",
    details: {
      low: "The compound shows minimal risk of causing liver damage. The molecular structure and properties suggest good hepatic tolerance with low likelihood of adverse effects on liver function.",
      medium: "Moderate hepatotoxicity risk detected. The compound exhibits structural features or properties that may lead to liver stress under certain conditions. Monitoring liver enzymes during use is recommended.",
      high: "Significant hepatotoxicity risk identified. The compound contains structural alerts or properties strongly associated with liver damage. Careful evaluation and potential structural modifications are advised."
    },
    mechanisms: [
      "Metabolic activation to reactive intermediates",
      "Mitochondrial dysfunction",
      "Oxidative stress induction",
      "Bile acid transport disruption",
      "Inflammatory response activation"
    ],
    biomarkers: ["ALT", "AST", "ALP", "Bilirubin", "GGT"]
  },
  cardiotoxicity: {
    icon: Heart,
    title: "Cardiotoxicity (Heart Toxicity)",
    description: "Evaluation of potential adverse effects on cardiac function and structure.",
    details: {
      low: "Low cardiotoxicity risk profile. The compound is unlikely to cause significant cardiac dysfunction based on its molecular properties and structural features.",
      medium: "Moderate cardiac risk detected. Some structural features suggest potential for cardiovascular effects. ECG monitoring and cardiac function assessment may be warranted.",
      high: "High cardiotoxicity risk identified. The compound shows strong potential for cardiac adverse effects including arrhythmias, contractility changes, or structural damage."
    },
    mechanisms: [
      "Disruption of calcium homeostasis",
      "Mitochondrial damage in cardiomyocytes",
      "Oxidative stress",
      "Interference with contractile proteins",
      "Ion channel modulation"
    ],
    biomarkers: ["Troponin", "CK-MB", "BNP", "NT-proBNP", "ECG parameters"]
  },
  mutagenicity: {
    icon: Dna,
    title: "Mutagenicity (Genetic Toxicity)",
    description: "Prediction of potential to cause genetic mutations or DNA damage.",
    details: {
      low: "Minimal mutagenic potential. The compound structure suggests low probability of DNA damage or chromosomal aberrations based on established structure-activity relationships.",
      medium: "Moderate mutagenic concern. Some structural features indicate potential genotoxicity. Further Ames testing and chromosomal aberration studies are recommended.",
      high: "Significant mutagenic risk detected. The compound contains known genotoxic alerts or structural features strongly associated with DNA damage and mutations."
    },
    mechanisms: [
      "Direct DNA alkylation",
      "Formation of DNA adducts",
      "Oxidative DNA damage",
      "Intercalation between base pairs",
      "Inhibition of DNA repair mechanisms"
    ],
    assays: ["Ames test", "Micronucleus test", "Comet assay", "Chromosomal aberration test", "TK gene mutation assay"]
  },
  hergInhibition: {
    icon: Activity,
    title: "hERG K+ Channel Inhibition",
    description: "Assessment of potential to block cardiac hERG potassium channels, which can lead to QT prolongation and arrhythmias.",
    details: {
      low: "Low hERG inhibition risk. The compound is unlikely to significantly block cardiac potassium channels or cause QT interval prolongation.",
      medium: "Moderate hERG liability detected. The compound shows some structural features associated with hERG channel binding. ECG monitoring for QT prolongation is advisable.",
      high: "High hERG inhibition risk identified. Strong potential for blocking cardiac hERG channels, which may lead to QT prolongation and life-threatening arrhythmias (Torsades de Pointes)."
    },
    mechanisms: [
      "Direct channel pore blockade",
      "Interference with channel gating",
      "Disruption of channel trafficking",
      "Delayed repolarization kinetics"
    ],
    consequences: ["QT interval prolongation", "Torsades de Pointes arrhythmia", "Sudden cardiac death risk", "Drug interaction concerns"],
    mitigation: ["Structural modification to reduce basicity", "ECG monitoring", "Electrolyte management", "Dose adjustment"]
  }
};

export default function SafetyAssessmentComponent({ assessment, isLoading }: SafetyAssessmentProps) {
  const overallRiskDisplay = assessment ? getOverallRiskDisplay(assessment.overallRisk) : null;

  const getRiskDetail = (toxicityType: keyof typeof toxicityDetails, riskLevel: string) => {
    const details = toxicityDetails[toxicityType].details;
    return details[riskLevel.toLowerCase() as keyof typeof details] || details.medium;
  };

  return (
    <Card data-testid="card-safety-assessment">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Shield className="mr-2 text-primary" />
          Safety Assessment
        </h3>
        
        {isLoading ? (
          <div className="space-y-6">
            {/* AI Thinking Animation */}
            <div className="text-center mb-6 py-6">
              <div className="relative inline-flex items-center justify-center">
                {/* Pulsing circles */}
                <div className="absolute w-24 h-24 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }}></div>
                <div className="absolute w-20 h-20 rounded-full bg-primary/30 animate-pulse" style={{ animationDuration: '1.5s' }}></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center animate-pulse">
                  <Shield className="w-8 h-8 text-white animate-bounce" style={{ animationDuration: '1s' }} />
                </div>
              </div>
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-sm font-medium text-primary animate-pulse">AI is analyzing safety profile...</p>
                <p className="text-xs text-muted-foreground">Evaluating toxicity endpoints and molecular properties</p>
              </div>
            </div>

            {/* Shimmer effect for loading categories */}
            <div className="space-y-3">
              {[
                { icon: AlertTriangle, label: 'Hepatotoxicity', delay: '0ms' },
                { icon: Heart, label: 'Cardiotoxicity', delay: '200ms' },
                { icon: Dna, label: 'Mutagenicity', delay: '400ms' },
                { icon: Activity, label: 'hERG Inhibition', delay: '600ms' }
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={i} 
                    className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50 animate-pulse"
                    style={{ animationDelay: item.delay, animationDuration: '1.5s' }}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-slate-400 animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : assessment && overallRiskDisplay ? (
          <>
            {/* Risk Level - Enhanced Design */}
            <div className="text-center mb-6 relative">
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <div className="w-48 h-48 rounded-full bg-gradient-to-r from-primary to-purple-500 blur-3xl"></div>
              </div>
              <div className="relative">
                <div className={`inline-flex items-center gap-3 px-6 py-3 ${overallRiskDisplay.bgColor} ${overallRiskDisplay.color} border-2 rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-xl`}>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
                    <i className={`${overallRiskDisplay.icon}`}></i>
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-medium opacity-80">Overall Risk</div>
                    <span className="text-lg font-bold" data-testid="text-overall-risk">{overallRiskDisplay.text}</span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground font-medium">
                  💡 Click categories below for detailed analysis
                </div>
              </div>
            </div>

            {/* Visual Summary (probability bars) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {[
                {
                  key: "hepatotoxicity" as const,
                  label: "Hepatotoxicity",
                  icon: AlertTriangle,
                  probability: assessment.hepatotoxicity.probability,
                  risk: assessment.hepatotoxicity.risk,
                },
                {
                  key: "cardiotoxicity" as const,
                  label: "Cardiotoxicity",
                  icon: Heart,
                  probability: assessment.cardiotoxicity.probability,
                  risk: assessment.cardiotoxicity.risk,
                },
                {
                  key: "mutagenicity" as const,
                  label: "Mutagenicity",
                  icon: Dna,
                  probability: assessment.mutagenicity.probability,
                  risk: assessment.mutagenicity.risk,
                },
                {
                  key: "hergInhibition" as const,
                  label: "hERG Inhibition",
                  icon: Activity,
                  probability: assessment.hergInhibition.probability,
                  risk: assessment.hergInhibition.risk,
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                const value = Math.round(item.probability * 100);
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-slate-50 to-transparent dark:from-slate-900/40 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full ${getRiskBgColor(item.risk)} flex items-center justify-center`}>
                          <Icon className="w-4 h-4 text-foreground/80" />
                        </div>
                        <div className="text-sm font-semibold text-foreground">{item.label}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskBgColor(item.risk)} border font-medium`}>
                        {item.risk}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <Progress value={value} />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Probability</span>
                        <span className="font-medium">{formatProbability(item.probability)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Risk Accordion - Enhanced */}
            <Accordion type="multiple" className="w-full space-y-3">
              {/* Hepatotoxicity */}
              <AccordionItem value="hepatotoxicity" className="border-2 border-orange-200 dark:border-orange-900/30 rounded-xl overflow-hidden bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-950/20 hover:shadow-md transition-all duration-300">
                <AccordionTrigger className="hover:no-underline px-4 py-4 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-colors">
                  <div className="flex items-center space-x-3 w-full">
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full ${getRiskBgColor(assessment.hepatotoxicity.risk)} flex items-center justify-center ring-4 ring-orange-100 dark:ring-orange-900/30 shadow-sm`}>
                        <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getRiskBgColor(assessment.hepatotoxicity.risk)} border-2 border-white dark:border-slate-900`}></div>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        Hepatotoxicity
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskBgColor(assessment.hepatotoxicity.risk)} border font-medium`}>
                          {assessment.hepatotoxicity.risk}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                        Liver toxicity risk • {formatProbability(assessment.hepatotoxicity.probability)}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 pt-2">
                  <div className="space-y-4 text-sm bg-white/50 dark:bg-slate-950/50 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-start gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-900/30">
                      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Overview</h4>
                        <p className="text-xs text-blue-800/80 dark:text-blue-200/80 leading-relaxed">
                          {toxicityDetails.hepatotoxicity.description}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <span className="w-1 h-4 bg-gradient-to-b from-orange-500 to-orange-600 rounded"></span>
                        Risk Assessment
                      </h4>
                      <div className={`p-4 rounded-lg border-l-4 ${getRiskBgColor(assessment.hepatotoxicity.risk)} bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900/50`}>
                        <p className="text-xs leading-relaxed text-foreground/90">
                          {getRiskDetail('hepatotoxicity', assessment.hepatotoxicity.risk)}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Mechanisms</h4>
                        <ul className="text-xs space-y-1.5">
                          {toxicityDetails.hepatotoxicity.mechanisms.map((mechanism, idx) => (
                            <li key={idx} className="flex items-start gap-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                              <span className="text-orange-500 mt-0.5 flex-shrink-0">▸</span>
                              <span className="text-muted-foreground">{mechanism}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Biomarkers</h4>
                        <div className="flex flex-wrap gap-2">
                          {toxicityDetails.hepatotoxicity.biomarkers.map((marker, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs px-3 py-1 bg-muted/60 border border-border/50 text-foreground/90 hover:shadow-sm transition-shadow"
                            >
                              {marker}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Cardiotoxicity */}
              <AccordionItem value="cardiotoxicity" className="border-2 border-red-200 dark:border-red-900/30 rounded-xl overflow-hidden bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-950/20 hover:shadow-md transition-all duration-300">
                <AccordionTrigger className="hover:no-underline px-4 py-4 hover:bg-red-50/50 dark:hover:bg-red-950/30 transition-colors">
                  <div className="flex items-center space-x-3 w-full">
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full ${getRiskBgColor(assessment.cardiotoxicity.risk)} flex items-center justify-center ring-4 ring-red-100 dark:ring-red-900/30 shadow-sm`}>
                        <Heart className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getRiskBgColor(assessment.cardiotoxicity.risk)} border-2 border-white dark:border-slate-900`}></div>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        Cardiotoxicity
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskBgColor(assessment.cardiotoxicity.risk)} border font-medium`}>
                          {assessment.cardiotoxicity.risk}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                        Heart toxicity risk • {formatProbability(assessment.cardiotoxicity.probability)}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 pt-2">
                  <div className="space-y-4 text-sm bg-white/50 dark:bg-slate-950/50 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-start gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-900/30">
                      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Overview</h4>
                        <p className="text-xs text-blue-800/80 dark:text-blue-200/80 leading-relaxed">
                          {toxicityDetails.cardiotoxicity.description}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <span className="w-1 h-4 bg-gradient-to-b from-red-500 to-red-600 rounded"></span>
                        Risk Assessment
                      </h4>
                      <div className={`p-4 rounded-lg border-l-4 ${getRiskBgColor(assessment.cardiotoxicity.risk)} bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900/50`}>
                        <p className="text-xs leading-relaxed text-foreground/90">
                          {getRiskDetail('cardiotoxicity', assessment.cardiotoxicity.risk)}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Mechanisms</h4>
                        <ul className="text-xs space-y-1.5">
                          {toxicityDetails.cardiotoxicity.mechanisms.map((mechanism, idx) => (
                            <li key={idx} className="flex items-start gap-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                              <span className="text-red-500 mt-0.5 flex-shrink-0">▸</span>
                              <span className="text-muted-foreground">{mechanism}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Biomarkers</h4>
                        <div className="flex flex-wrap gap-2">
                          {toxicityDetails.cardiotoxicity.biomarkers.map((marker, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs px-3 py-1 bg-muted/60 border border-border/50 text-foreground/90 hover:shadow-sm transition-shadow"
                            >
                              {marker}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Mutagenicity */}
              <AccordionItem value="mutagenicity" className="border-2 border-purple-200 dark:border-purple-900/30 rounded-xl overflow-hidden bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20 hover:shadow-md transition-all duration-300">
                <AccordionTrigger className="hover:no-underline px-4 py-4 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-colors">
                  <div className="flex items-center space-x-3 w-full">
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full ${getRiskBgColor(assessment.mutagenicity.risk)} flex items-center justify-center ring-4 ring-purple-100 dark:ring-purple-900/30 shadow-sm`}>
                        <Dna className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getRiskBgColor(assessment.mutagenicity.risk)} border-2 border-white dark:border-slate-900`}></div>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        Mutagenicity
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskBgColor(assessment.mutagenicity.risk)} border font-medium`}>
                          {assessment.mutagenicity.risk}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                        Genetic toxicity risk • {formatProbability(assessment.mutagenicity.probability)}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 pt-2">
                  <div className="space-y-4 text-sm bg-white/50 dark:bg-slate-950/50 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-start gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-900/30">
                      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Overview</h4>
                        <p className="text-xs text-blue-800/80 dark:text-blue-200/80 leading-relaxed">
                          {toxicityDetails.mutagenicity.description}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <span className="w-1 h-4 bg-gradient-to-b from-purple-500 to-purple-600 rounded"></span>
                        Risk Assessment
                      </h4>
                      <div className={`p-4 rounded-lg border-l-4 ${getRiskBgColor(assessment.mutagenicity.risk)} bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900/50`}>
                        <p className="text-xs leading-relaxed text-foreground/90">
                          {getRiskDetail('mutagenicity', assessment.mutagenicity.risk)}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Mechanisms</h4>
                        <ul className="text-xs space-y-1.5">
                          {toxicityDetails.mutagenicity.mechanisms.map((mechanism, idx) => (
                            <li key={idx} className="flex items-start gap-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                              <span className="text-purple-500 mt-0.5 flex-shrink-0">▸</span>
                              <span className="text-muted-foreground">{mechanism}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Recommended Assays</h4>
                        <div className="flex flex-wrap gap-2">
                          {toxicityDetails.mutagenicity.assays.map((assay, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs px-3 py-1 bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-950/20 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-300 hover:shadow-sm transition-shadow">
                              {assay}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* hERG Inhibition */}
              <AccordionItem value="herg" className="border-2 border-blue-200 dark:border-blue-900/30 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20 hover:shadow-md transition-all duration-300">
                <AccordionTrigger className="hover:no-underline px-4 py-4 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors">
                  <div className="flex items-center space-x-3 w-full">
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full ${getRiskBgColor(assessment.hergInhibition.risk)} flex items-center justify-center ring-4 ring-blue-100 dark:ring-blue-900/30 shadow-sm`}>
                        <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getRiskBgColor(assessment.hergInhibition.risk)} border-2 border-white dark:border-slate-900`}></div>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        hERG Inhibition
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskBgColor(assessment.hergInhibition.risk)} border font-medium`}>
                          {assessment.hergInhibition.risk}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                        K+ channel blockade risk • {formatProbability(assessment.hergInhibition.probability)}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 pt-2">
                  <div className="space-y-4 text-sm bg-white/50 dark:bg-slate-950/50 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-start gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-900/30">
                      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Overview</h4>
                        <p className="text-xs text-blue-800/80 dark:text-blue-200/80 leading-relaxed">
                          {toxicityDetails.hergInhibition.description}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <span className="w-1 h-4 bg-gradient-to-b from-blue-500 to-blue-600 rounded"></span>
                        Risk Assessment
                      </h4>
                      <div className={`p-4 rounded-lg border-l-4 ${getRiskBgColor(assessment.hergInhibition.risk)} bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900/50`}>
                        <p className="text-xs leading-relaxed text-foreground/90">
                          {getRiskDetail('hergInhibition', assessment.hergInhibition.risk)}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Mechanisms</h4>
                          <ul className="text-xs space-y-1.5">
                            {toxicityDetails.hergInhibition.mechanisms.map((mechanism, idx) => (
                              <li key={idx} className="flex items-start gap-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                <span className="text-blue-500 mt-0.5 flex-shrink-0">▸</span>
                                <span className="text-muted-foreground">{mechanism}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Mitigation</h4>
                          <ul className="text-xs space-y-1.5">
                            {toxicityDetails.hergInhibition.mitigation.map((strategy, idx) => (
                              <li key={idx} className="flex items-start gap-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                                <span className="text-muted-foreground">{strategy}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Clinical Consequences</h4>
                        <div className="flex flex-wrap gap-2">
                          {toxicityDetails.hergInhibition.consequences.map((consequence, idx) => (
                            <Badge key={idx} variant="destructive" className="text-xs px-3 py-1 bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-950/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 hover:shadow-sm transition-shadow">
                              {consequence}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Overall Score - Enhanced */}
            <div className="mt-6 pt-6 border-t-2 border-dashed border-border/50">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-md">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Safety Score</p>
                    <p className="text-sm text-muted-foreground">Composite risk assessment</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${getRiskColor(assessment.overallRisk)} drop-shadow-sm`} data-testid="text-safety-score">
                    {assessment.overallScore.toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">out of 10</p>
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-3 leading-relaxed">
                📊 Higher scores indicate better safety profile • Calculated from all toxicity endpoints
              </p>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            <div className="text-4xl mb-2">🛡️</div>
            <p className="text-sm">Analyze a compound to view safety assessment</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
