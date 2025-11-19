/**
 * Drug Validation Service
 * Integrates RxNorm, openFDA, and DrugBank APIs to validate AI predictions
 * and enrich medicine data with authoritative sources
 */

export interface RxNormData {
  rxcui: string;
  name: string;
  ingredients: Array<{
    rxcui: string;
    name: string;
    strength?: string;
  }>;
  tty?: string; // Term Type (SBD, SCD, etc.)
}

export interface OpenFDADrugData {
  brand_name?: string[];
  generic_name?: string[];
  dosage_form?: string[];
  route?: string[];
  active_ingredients?: Array<{
    name: string;
    strength: string;
  }>;
  indications_and_usage?: string;
  warnings?: string;
  adverse_reactions?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1
  source: 'rxnorm' | 'openfda' | 'combined' | 'none';
  molecularFormula?: string;
  smiles?: string;
  warnings: string[];
  sourceData: {
    rxnorm?: RxNormData;
    openfda?: OpenFDADrugData;
  };
}

class DrugValidationService {
  private static readonly RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';
  private static readonly OPENFDA_BASE = 'https://api.fda.gov/drug/label.json';

  /**
   * Search medicine in RxNorm database
   */
  static async searchRxNorm(medicineName: string): Promise<RxNormData | null> {
    try {
      const url = `${this.RXNORM_BASE}/rxcui.json?name=${encodeURIComponent(medicineName)}`;
      const response = await fetch(url);

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.idGroup?.rxList?.[0]) return null;

      const rxcui = data.idGroup.rxList[0].rxcui;
      const name = data.idGroup.rxList[0].name;

      // Fetch ingredient info
      const ingredientsUrl = `${this.RXNORM_BASE}/rxcui/${rxcui}/ingredients.json`;
      const ingredientsResponse = await fetch(ingredientsUrl);
      const ingredientsData = await ingredientsResponse.json();

      const ingredients = ingredientsData.rxcinfoList?.rxcinfoListItem?.map((item: any) => ({
        rxcui: item.rxcui,
        name: item.name,
        strength: item.strength,
      })) || [];

      return {
        rxcui,
        name,
        ingredients,
        tty: data.idGroup.rxList[0].tty,
      };
    } catch (error) {
      console.error('RxNorm search error:', error);
      return null;
    }
  }

  /**
   * Fetch drug information from openFDA
   */
  static async searchOpenFDA(medicineName: string): Promise<OpenFDADrugData | null> {
    try {
      const query = encodeURIComponent(`generic_name:"${medicineName}" OR brand_name:"${medicineName}"`);
      const url = `${this.OPENFDA_BASE}?search=${query}&limit=1`;
      const response = await fetch(url);

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.results?.[0]) return null;

      const result = data.results[0];
      return {
        brand_name: result.brand_name,
        generic_name: result.generic_name,
        dosage_form: result.dosage_form,
        route: result.route,
        active_ingredients: result.active_ingredient?.map((ing: any) => ({
          name: ing.active_ingredient,
          strength: ing.strength,
        })),
        indications_and_usage: result.indications_and_usage?.[0],
        warnings: result.warnings,
        adverse_reactions: result.adverse_reactions,
      };
    } catch (error) {
      console.error('openFDA search error:', error);
      return null;
    }
  }

  /**
   * Validate AI-predicted SMILES against RxNorm data
   * (Note: Full SMILES validation would require additional structure lookup)
   */
  static validateSmiles(aiSmiles: string, medicineName: string): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (!aiSmiles || aiSmiles.length === 0) {
      warnings.push('AI could not generate valid SMILES notation');
      return { isValid: false, warnings };
    }

    // Basic SMILES validation (check for common atoms and syntax)
    const smilesPattern = /^[A-Za-z0-9\[\]()%#=\-+\\\/\@:.]*$/;
    if (!smilesPattern.test(aiSmiles)) {
      warnings.push('Generated SMILES contains invalid characters');
      return { isValid: false, warnings };
    }

    return { isValid: true, warnings };
  }

  /**
   * Validate molecular formula (basic check)
   */
  static validateFormula(formula: string): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (!formula || formula.length === 0) {
      warnings.push('No molecular formula provided');
      return { isValid: false, warnings };
    }

    // Check for common elements in valid formulas
    const elementPattern = /^[A-Z][a-z]?(\d+)?([A-Z][a-z]?(\d+)?)*$/;
    if (!elementPattern.test(formula)) {
      warnings.push('Molecular formula format appears incorrect');
      return { isValid: false, warnings };
    }

    return { isValid: true, warnings };
  }

  /**
   * Comprehensive medicine validation
   * Compares AI predictions with authoritative sources
   */
  static async validateMedicine(
    medicineName: string,
    aiPrediction: {
      activeCompound: { name: string; molecularFormula: string; smiles: string };
      drugLikeness: { passesRuleOfFive: boolean; bioactivityLevel: string };
    }
  ): Promise<ValidationResult> {
    const warnings: string[] = [];
    const sourceData: ValidationResult['sourceData'] = {};
    let confidence = 0;
    let source: ValidationResult['source'] = 'none';

    // Try RxNorm first
    const rxnormData = await this.searchRxNorm(medicineName);
    if (rxnormData) {
      sourceData.rxnorm = rxnormData;
      confidence += 0.4;
      source = 'rxnorm';

      // Validate against RxNorm data
      if (rxnormData.ingredients.length === 0 && aiPrediction.activeCompound.name) {
        warnings.push('RxNorm did not find known ingredients; relying on AI prediction');
      }
    }

    // Try openFDA
    const openfdaData = await this.searchOpenFDA(medicineName);
    if (openfdaData) {
      sourceData.openfda = openfdaData;
      confidence += 0.3;
      if (source === 'rxnorm') source = 'combined';
      else source = 'openfda';

      // Validate against openFDA
      if (openfdaData.active_ingredients) {
        const fdaIngredients = openfdaData.active_ingredients.map((i) => i.name.toLowerCase());
        if (!fdaIngredients.some((ing) => ing.includes(aiPrediction.activeCompound.name.toLowerCase()))) {
          warnings.push('AI-predicted active compound not found in FDA labeling');
          confidence -= 0.1;
        }
      }
    }

    // Validate SMILES
    const smilesValidation = this.validateSmiles(aiPrediction.activeCompound.smiles, medicineName);
    if (!smilesValidation.isValid) {
      warnings.push(...smilesValidation.warnings);
      confidence -= 0.2;
    }

    // Validate formula
    const formulaValidation = this.validateFormula(aiPrediction.activeCompound.molecularFormula);
    if (!formulaValidation.isValid) {
      warnings.push(...formulaValidation.warnings);
      confidence -= 0.15;
    }

    // Lipinski's Rule is a good sign
    if (aiPrediction.drugLikeness.passesRuleOfFive) {
      confidence += 0.15;
    }

    // Clamp confidence to 0-1
    confidence = Math.max(0, Math.min(1, confidence));

    return {
      isValid: confidence >= 0.5,
      confidence,
      source,
      molecularFormula: aiPrediction.activeCompound.molecularFormula,
      smiles: aiPrediction.activeCompound.smiles,
      warnings,
      sourceData,
    };
  }

  /**
   * Extract FDA warnings from openFDA data
   */
  static extractFDAWarnings(medicineName: string): Promise<string[]> {
    return this.searchOpenFDA(medicineName).then((data) => {
      if (!data) return [];
      const warnings: string[] = [];

      if (data.warnings && Array.isArray(data.warnings)) {
        warnings.push(...data.warnings.filter((w) => typeof w === 'string'));
      }

      if (data.adverse_reactions && Array.isArray(data.adverse_reactions)) {
        warnings.push(
          ...data.adverse_reactions
            .filter((r) => typeof r === 'string')
            .map((r) => `Adverse Reaction: ${r}`)
        );
      }

      return warnings.slice(0, 5); // Limit to 5 most important
    });
  }

  /**
   * Get RxNorm ingredient breakdown
   */
  static async getIngredientBreakdown(medicineName: string): Promise<RxNormData['ingredients'] | null> {
    const rxnormData = await this.searchRxNorm(medicineName);
    return rxnormData?.ingredients || null;
  }
}

export default DrugValidationService;
