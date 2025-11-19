export interface MedicineSearchResult {
  drugbankId: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface MedicineDetails extends MedicineSearchResult {
  synonyms: string[];
  categories: string[];
  indications: string[];
  mechanisms: string[];
  smiles?: string;
  molecularFormula?: string;
  molecularWeight?: number;
  atcCodes: string[];
  routes: string[];
  dosageForms: string[];
  toxicity?: string;
  fdaWarnings: string[];
}
