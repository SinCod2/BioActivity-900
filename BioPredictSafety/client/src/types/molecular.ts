import type { MolecularDescriptors, SafetyAssessment } from "@shared/schema";

export type { MolecularDescriptors, SafetyAssessment } from "@shared/schema";

export interface Compound {
  id: string;
  smiles: string;
  name?: string;
  createdAt: Date;
}

export interface Prediction {
  id: string;
  compoundId: string;
  pic50: number;
  confidence: number;
  descriptors: MolecularDescriptors;
  safetyAssessment: SafetyAssessment;
  createdAt: Date;
}

export interface StructureImages {
  image2d?: string | null;
  image3d?: string | null;
}

export interface StructureCoordinates {
  atoms: Array<{ element: string; x: number; y: number; z: number }>;
  bonds: Array<{ from: number; to: number; order: number }>;
}

export interface CompoundStructure {
  source: 'pubchem' | 'gemini';
  smiles: string;
  cid?: number;
  fetchedAt: string;
  images: StructureImages;
  coordinates3d?: StructureCoordinates | null;
}

export interface LipinskiRules {
  passed: number;
  total: number;
  rules: Array<{
    name: string;
    value: number;
    limit: number;
    operator: string;
    passed: boolean;
  }>;
}

export interface AnalysisResult {
  compound: Compound;
  prediction: Prediction;
  lipinskiRules: LipinskiRules;
  structure?: CompoundStructure | null;
}

// Image analysis (medicine photo) types
export interface CompoundCandidate {
  name: string;
  smiles?: string;
  confidence: number;
  rationale?: string;
}

export interface MedicineUsageGuidelines {
  dosage: string;
  timing: string;
  route: string;
  instructions: string;
}

export interface MedicineSafety {
  prescriptionStatus: string;
  warnings: string[];
  contraindications: string[];
  sideEffects: string[];
}

export interface MedicineIngredients {
  active: Array<{ name: string; strength?: string; smiles?: string }>;
  inactive: string[];
  formulation: string;
}

export interface MedicineConfidence {
  score: number;
  labelReadable: boolean;
  rationale: string;
}

export interface MedicineInsights {
  summary: string;
  usageGuidelines: MedicineUsageGuidelines;
  ingredients: MedicineIngredients;
  safety: MedicineSafety;
  confidence: MedicineConfidence;
  compoundCandidates: CompoundCandidate[];
  isFallback?: boolean;
  rxNorm?: { rxcui?: string; name?: string };
  openFDALabel?: { brand?: string; warnings?: string[] };
}

export interface ImageAnalysisResult {
  medicineInsights: MedicineInsights;
  compound?: Compound;
  prediction?: Prediction;
  lipinskiRules?: LipinskiRules;
  structure?: CompoundStructure | null;
}

export interface BatchJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalCompounds: number;
  processedCompounds: number;
  results?: any[];
  createdAt: Date;
  completedAt?: Date;
}
