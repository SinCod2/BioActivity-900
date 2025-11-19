// OpenFDA Drug Label API (Free)
const OPENFDA_BASE_URL = "https://api.fda.gov/drug";

export interface DrugSearchResult {
  drugbankId: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface DrugDetails extends DrugSearchResult {
  // Basic Info
  brandNames: string[];
  genericName?: string;
  manufacturer?: string;
  
  // Chemical Info
  activeIngredients?: string[];
  molecularFormula?: string;
  molecularWeight?: number;
  smiles?: string;
  
  // Pharmacology
  mechanisms: string[];
  categories: string[];
  routes: string[];
  dosageForms: string[];
  
  // Medical Use
  indications: string[];
  purpose?: string[];
  sideEffects?: string[];
  adverseReactions?: string[];
  
  // Safety & Warnings
  warnings?: string[];
  contraindications?: string[];
  boxedWarnings?: string[];
  pregnancyWarnings?: string[];
  overdosageInfo?: string;
  
  // Additional
  dosageAndAdministration?: string[];
  atcCodes: string[];
  fdaApplicationNumber?: string;
  
  // Aliases for backwards compatibility
  synonyms: string[];
  toxicity?: string;
  fdaWarnings: string[];
}

export class DrugBankService {
  static async searchByName(query: string): Promise<DrugSearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const originalQuery = query.trim();
      const qLower = originalQuery.toLowerCase();
      const SYNONYM_MAP: Record<string, string> = {
        'paracetamol': 'acetaminophen',
        'tylenol': 'acetaminophen',
        'panadol': 'acetaminophen',
        'advil': 'ibuprofen',
        'motrin': 'ibuprofen',
        'nsaid': 'ibuprofen',
        'asa': 'aspirin',
      };

      const attemptedQueries: string[] = [originalQuery];
      if (SYNONYM_MAP[qLower] && SYNONYM_MAP[qLower] !== originalQuery) {
        attemptedQueries.push(SYNONYM_MAP[qLower]);
      }

      // Collections
      const seenIds = new Set<string>();
      const results: DrugSearchResult[] = [];

      // Helper to process a response batch
      const processBatch = (data: any) => {
        if (!data.results) return;
        for (const item of data.results) {
          const openfda = item.openfda || {};
          const brandName = openfda.brand_name?.[0] || '';
            const genericName = openfda.generic_name?.[0] || '';
          const name = brandName || genericName || openfda.substance_name?.[0] || 'Unknown';
          const id = item.set_id || item.id || `FDA-${(name + '-' + (genericName || brandName)).replace(/[^a-zA-Z0-9]/g, '-')}`;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          const purpose = item.purpose?.[0] || item.indications_and_usage?.[0] || '';
          const description = purpose.length > 150 ? purpose.substring(0, 150) + '...' : purpose;
          results.push({
            drugbankId: id,
            name,
            description: description || `${openfda.manufacturer_name?.[0] || 'Manufacturer N/A'} - ${openfda.dosage_form?.[0] || 'Form N/A'}`,
            imageUrl: undefined,
          });
          if (results.length >= 10) break;
        }
      };

      // Field-specific iterative search (brand, generic, substance, non-proprietary)
      const FIELDS = ['openfda.brand_name', 'openfda.generic_name', 'openfda.substance_name', 'openfda.non_proprietary_name'];

      for (const term of attemptedQueries) {
        for (const field of FIELDS) {
          if (results.length >= 10) break;
          const url = `${OPENFDA_BASE_URL}/label.json?search=${field}:"${encodeURIComponent(term)}"&limit=15`;
          console.log('OpenFDA targeted search:', url);
          try {
            const r = await fetch(url);
            if (!r.ok) continue;
            const data = await r.json();
            processBatch(data);
          } catch (e) {
            console.warn('Targeted search error', e);
          }
        }
        if (results.length >= 3) break; // Stop early if we already have some hits
      }

      // Broad fallback if still empty
      if (results.length === 0) {
        for (const term of attemptedQueries) {
          const url = `${OPENFDA_BASE_URL}/label.json?search=${encodeURIComponent(term)}&limit=25`;
          console.log('OpenFDA broad fallback search:', url);
          try {
            const r = await fetch(url);
            if (!r.ok) continue;
            const data = await r.json();
            processBatch(data);
            if (results.length > 0) break;
          } catch (e) {
            console.warn('Broad fallback error', e);
          }
        }
      }

      return results;
    } catch (error) {
      console.error("OpenFDA search error:", error);
      return [];
    }
  }

  static async getDrugDetails(drugId: string): Promise<DrugDetails | null> {
    if (!drugId) return null;

    try {
      // Search by set_id or product label ID
      const url = `${OPENFDA_BASE_URL}/label.json?search=set_id:"${drugId}"+id:"${drugId}"&limit=1`;
      
      console.log('Fetching drug details from OpenFDA:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`OpenFDA details failed (${response.status})`);
        return null;
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return null;
      }

      const drug = data.results[0];
      const openfda = drug.openfda || {};
      
      // Basic Info
      const brandNames = openfda.brand_name || [];
      const genericName = openfda.generic_name?.[0] || '';
      const name = brandNames[0] || genericName || 'Unknown Drug';
      const manufacturer = openfda.manufacturer_name?.[0] || 'Unknown Manufacturer';
      
      // Chemical Info
      const activeIngredients = drug.active_ingredient || openfda.substance_name || [];
      const unii = openfda.unii?.[0];
      
      // Pharmacology
      const mechanisms = drug.mechanism_of_action || drug.clinical_pharmacology || [];
      const categories = openfda.pharm_class_epc || openfda.pharm_class_cs || [];
      const routes = openfda.route || [];
      const dosageForms = openfda.dosage_form || [];
      
      // Medical Use
      const indications = drug.indications_and_usage || [];
      const purpose = drug.purpose || [];
      const adverseReactions = drug.adverse_reactions || [];
      const sideEffects = drug.information_for_patients || [];
      
      // Safety & Warnings
      const warnings = drug.warnings || drug.warnings_and_cautions || [];
      const contraindications = drug.contraindications || [];
      const boxedWarnings = drug.boxed_warning || [];
      const pregnancyWarnings = drug.pregnancy || drug.use_in_specific_populations || [];
      const overdosageInfo = drug.overdosage?.[0];
      
      // Additional
      const dosageAndAdministration = drug.dosage_and_administration || [];
      const fdaApplicationNumber = openfda.application_number?.[0];
      
      return {
        drugbankId: drugId,
        name: name,
        description: indications[0]?.substring(0, 200) || purpose[0]?.substring(0, 200) || '',
        imageUrl: undefined,
        
        // Basic Info
        brandNames: brandNames,
        genericName: genericName,
        manufacturer: manufacturer,
        
        // Chemical Info
        activeIngredients: activeIngredients,
        molecularFormula: unii,
        molecularWeight: undefined,
        smiles: undefined,
        
        // Pharmacology
        mechanisms: mechanisms,
        categories: categories,
        routes: routes,
        dosageForms: dosageForms,
        
        // Medical Use
        indications: indications,
        purpose: purpose,
        sideEffects: sideEffects,
        adverseReactions: adverseReactions,
        
        // Safety & Warnings
        warnings: warnings,
        contraindications: contraindications,
        boxedWarnings: boxedWarnings,
        pregnancyWarnings: pregnancyWarnings,
        overdosageInfo: overdosageInfo,
        
        // Additional
        dosageAndAdministration: dosageAndAdministration,
        atcCodes: openfda.pharm_class_cs || [],
        fdaApplicationNumber: fdaApplicationNumber,
        
        // Backwards compatibility
        synonyms: [...brandNames, ...openfda.generic_name || [], ...openfda.substance_name || []].slice(0, 15),
        toxicity: overdosageInfo,
        fdaWarnings: [...boxedWarnings, ...warnings].slice(0, 5),
      };
    } catch (error) {
      console.error("OpenFDA details error:", error);
      return null;
    }
  }
}
