import { GoogleGenerativeAI } from "@google/generative-ai";
import DrugValidationService, { ValidationResult } from "./drug-validation";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_TEXT_MODEL = "gemini-1.5-flash"; // Use Flash model instead of Pro

// Response types
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

const MASTER_PROMPT = `You are a pharmaceutical AI assistant specialized in bioactivity and molecular analysis.

When the user provides a MEDICINE NAME, perform comprehensive compound analysis and return a JSON response following this exact structure:

{
  "medicineName": "string - the medicine name provided",
  "activeCompound": {
    "name": "string - main active pharmaceutical ingredient",
    "molecularFormula": "string - chemical formula (e.g., C8H9NO2)",
    "smiles": "string - SMILES notation",
    "molecularWeight": number
  },
  "chemicalProperties": {
    "logP": number,
    "tpsa": number,
    "hBondDonors": number,
    "hBondAcceptors": number,
    "rotatableBonds": number,
    "lipinskiViolations": number
  },
  "drugLikeness": {
    "passesRuleOfFive": boolean,
    "bioactivityScore": number (pIC50, scale 0-10),
    "bioactivityLevel": "high" | "moderate" | "low",
    "therapeuticAreas": ["string array"],
    "pharmacologicalClasses": ["string array"]
  },
  "toxicity": {
    "hepatotoxicity": {
      "probability": number (0-1),
      "risk": "LOW" | "MEDIUM" | "HIGH"
    },
    "cardiotoxicity": {
      "probability": number (0-1),
      "risk": "LOW" | "MEDIUM" | "HIGH"
    },
    "mutagenicity": {
      "probability": number (0-1),
      "risk": "LOW" | "MEDIUM" | "HIGH"
    },
    "overallSafety": "string - brief safety summary"
  },
  "mechanismOfAction": {
    "molecularTargets": ["string array - e.g., COX-1, COX-2"],
    "biologicalMechanism": "string - detailed mechanism description",
    "pathwayDescription": "string - affected biological pathways"
  },
  "clinicalInfo": {
    "diseasesTreated": ["string array"],
    "primaryIndications": ["string array"],
    "commonSideEffects": ["string array"],
    "contraindications": ["string array"],
    "dosageForm": "string - e.g., tablet, capsule, syrup",
    "routeOfAdministration": "string - e.g., oral, intravenous"
  },
  "relatedCompounds": [
    {
      "name": "string - similar compound name",
      "similarity": "string - brief description of similarity"
    }
  ],
  "imageData": {
    "description": "string - visual description of the medicine",
    "suggestedSearchTerm": "string - optimized term for image search"
  },
  "confidence": number (0-1),
  "analysisTimestamp": "ISO 8601 timestamp"
}

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown, no code blocks, no prose.
2. Use scientifically accurate data. If uncertain, use conservative estimates with lower confidence.
3. For bioactivityScore, estimate pIC50 based on known pharmacological data.
4. All numerical values must be finite numbers, not strings.
5. Ensure all arrays have at least one element (use "Unknown" if necessary).
6. The imageData.suggestedSearchTerm should be optimized for finding pharmaceutical images (e.g., "Paracetamol 500mg tablet blister pack").

Now analyze the following medicine:`;

// Utility functions
function parseGeminiResponse(text: string): any {
  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1].trim() : text.trim();
  
  // Find JSON object boundaries
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in response");
  }
  
  const extracted = jsonText.slice(start, end + 1);
  return JSON.parse(extracted);
}

function validateAndNormalize(raw: any): CompoundAnalysis {
  const now = new Date().toISOString();
  
  return {
    medicineName: String(raw.medicineName || "Unknown"),
    activeCompound: {
      name: String(raw.activeCompound?.name || "Unknown"),
      molecularFormula: String(raw.activeCompound?.molecularFormula || ""),
      smiles: String(raw.activeCompound?.smiles || ""),
      molecularWeight: Number(raw.activeCompound?.molecularWeight) || 0,
    },
    chemicalProperties: {
      logP: Number(raw.chemicalProperties?.logP) || 0,
      tpsa: Number(raw.chemicalProperties?.tpsa) || 0,
      hBondDonors: Number(raw.chemicalProperties?.hBondDonors) || 0,
      hBondAcceptors: Number(raw.chemicalProperties?.hBondAcceptors) || 0,
      rotatableBonds: Number(raw.chemicalProperties?.rotatableBonds) || 0,
      lipinskiViolations: Number(raw.chemicalProperties?.lipinskiViolations) || 0,
    },
    drugLikeness: {
      passesRuleOfFive: Boolean(raw.drugLikeness?.passesRuleOfFive),
      bioactivityScore: Number(raw.drugLikeness?.bioactivityScore) || 0,
      bioactivityLevel: raw.drugLikeness?.bioactivityLevel || "low",
      therapeuticAreas: Array.isArray(raw.drugLikeness?.therapeuticAreas)
        ? raw.drugLikeness.therapeuticAreas
        : ["Unknown"],
      pharmacologicalClasses: Array.isArray(raw.drugLikeness?.pharmacologicalClasses)
        ? raw.drugLikeness.pharmacologicalClasses
        : ["Unknown"],
    },
    toxicity: {
      hepatotoxicity: {
        probability: Number(raw.toxicity?.hepatotoxicity?.probability) || 0,
        risk: raw.toxicity?.hepatotoxicity?.risk || "UNKNOWN",
      },
      cardiotoxicity: {
        probability: Number(raw.toxicity?.cardiotoxicity?.probability) || 0,
        risk: raw.toxicity?.cardiotoxicity?.risk || "UNKNOWN",
      },
      mutagenicity: {
        probability: Number(raw.toxicity?.mutagenicity?.probability) || 0,
        risk: raw.toxicity?.mutagenicity?.risk || "UNKNOWN",
      },
      overallSafety: String(raw.toxicity?.overallSafety || "Unknown safety profile"),
    },
    mechanismOfAction: {
      molecularTargets: Array.isArray(raw.mechanismOfAction?.molecularTargets)
        ? raw.mechanismOfAction.molecularTargets
        : ["Unknown"],
      biologicalMechanism: String(raw.mechanismOfAction?.biologicalMechanism || "Unknown mechanism"),
      pathwayDescription: String(raw.mechanismOfAction?.pathwayDescription || "Unknown pathway"),
    },
    clinicalInfo: {
      diseasesTeated: Array.isArray(raw.clinicalInfo?.diseasesTreated)
        ? raw.clinicalInfo.diseasesTreated
        : ["Unknown"],
      primaryIndications: Array.isArray(raw.clinicalInfo?.primaryIndications)
        ? raw.clinicalInfo.primaryIndications
        : ["Unknown"],
      commonSideEffects: Array.isArray(raw.clinicalInfo?.commonSideEffects)
        ? raw.clinicalInfo.commonSideEffects
        : ["Unknown"],
      contraindications: Array.isArray(raw.clinicalInfo?.contraindications)
        ? raw.clinicalInfo.contraindications
        : [],
      dosageForm: String(raw.clinicalInfo?.dosageForm || "Unknown"),
      routeOfAdministration: String(raw.clinicalInfo?.routeOfAdministration || "Unknown"),
    },
    relatedCompounds: Array.isArray(raw.relatedCompounds)
      ? raw.relatedCompounds.map((c: any) => ({
          name: String(c.name || "Unknown"),
          similarity: String(c.similarity || "Similar structure"),
        }))
      : [],
    imageData: raw.imageData
      ? {
          description: String(raw.imageData.description || ""),
          suggestedSearchTerm: String(raw.imageData.suggestedSearchTerm || ""),
        }
      : undefined,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0.5)),
    analysisTimestamp: raw.analysisTimestamp || now,
  };
}

export class GeminiTextAnalysisService {
  static async analyzeMedicineByName(medicineName: string): Promise<CompoundAnalysis> {
    if (!medicineName || typeof medicineName !== "string" || !medicineName.trim()) {
      throw new Error("Medicine name is required");
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    try {
      const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
      const fullPrompt = `${MASTER_PROMPT}\n\nMedicine Name: ${medicineName.trim()}`;

      console.log(`Analyzing medicine: ${medicineName}`);
      
      const result = await model.generateContent(fullPrompt);
      const responseText = result.response.text();
      
      console.log("Gemini response received, parsing...");
      
      const parsedData = parseGeminiResponse(responseText);
      const validated = validateAndNormalize(parsedData);
      
      // Validate against authoritative sources
      console.log(`Validating against RxNorm and openFDA...`);
      const validation = await DrugValidationService.validateMedicine(medicineName, {
        activeCompound: validated.activeCompound,
        drugLikeness: validated.drugLikeness,
      });
      
      validated.validation = validation;
      validated.confidence = (validated.confidence + validation.confidence) / 2; // Blend confidences
      
      console.log(`Analysis complete for ${medicineName} (final confidence: ${validated.confidence})`);
      
      return validated;
    } catch (error) {
      console.error("Gemini text analysis error:", error);
      throw new Error(
        error instanceof Error
          ? `Analysis failed: ${error.message}`
          : "Failed to analyze medicine"
      );
    }
  }
}
