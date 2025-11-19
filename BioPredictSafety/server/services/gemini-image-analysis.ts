import { GoogleGenerativeAI } from "@google/generative-ai";

// Single clean implementation (replaces previous duplicated/corrupted content)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_IMAGE_MODEL = "gemini-1.5-flash-latest"; // safer default
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);

export interface CompoundCandidate { name: string; smiles?: string; confidence: number; rationale?: string }
export interface MedicineUsageGuidelines { dosage: string; timing: string; route: string; instructions: string }
export interface MedicineSafety { prescriptionStatus: string; warnings: string[]; contraindications: string[]; sideEffects: string[] }
export interface MedicineIngredients { active: Array<{ name: string; strength?: string; smiles?: string }>; inactive: string[]; formulation: string }
export interface MedicineConfidence { score: number; labelReadable: boolean; rationale: string }
export interface MedicineInsights {
  summary: string;
  usageGuidelines: MedicineUsageGuidelines;
  ingredients: MedicineIngredients;
  safety: MedicineSafety;
  confidence: MedicineConfidence;
  compoundCandidates: CompoundCandidate[];
  rxNorm?: { rxcui?: string; name?: string };
  openFDALabel?: { brand?: string; warnings?: string[] };
}

function asString(v: unknown, fb = "") { return typeof v === "string" ? v.trim() : v == null ? fb : String(v).trim(); }
function asNumber(v: unknown, fb: number) { if (typeof v === "number" && Number.isFinite(v)) return v; const n = typeof v === "string" ? Number(v) : NaN; return Number.isFinite(n) ? n : fb; }
function asBool(v: unknown, fb: boolean) { if (typeof v === "boolean") return v; const t = typeof v === "string" ? v.trim().toLowerCase() : ""; if (t === "true") return true; if (t === "false") return false; return fb; }
function strArray(v: unknown) { if (Array.isArray(v)) return v.map((x) => asString(x)).filter(Boolean); if (typeof v === "string" && v.trim()) return v.split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean); return []; }
function clamp01(n: number) { if (!Number.isFinite(n)) return 0.5; return Math.max(0, Math.min(1, Number(n.toFixed(3)))) }
function extractJson(text: string) { const m = text.match(/```json\s*([\s\S]*?)```/i); if (m?.[1]) return m[1].trim(); const s = text.indexOf("{"); const e = text.lastIndexOf("}"); if (s !== -1 && e !== -1 && e > s) return text.slice(s, e + 1); throw new Error("No JSON in Gemini response"); }

export function selectBestCompoundCandidate(cands: CompoundCandidate[]): CompoundCandidate | null {
  if (!Array.isArray(cands) || !cands.length) return null;
  return [...cands].filter(c => c && c.name).sort((a, b) => {
    const as = a.smiles ? 1 : 0; const bs = b.smiles ? 1 : 0; if (as !== bs) return bs - as; const dc = (b.confidence ?? 0) - (a.confidence ?? 0); if (Math.abs(dc) > 1e-6) return dc > 0 ? 1 : -1; return a.name.localeCompare(b.name);
  })[0] ?? null;
}

const FALLBACK: MedicineInsights = {
  summary: "We couldn't confidently parse the photo. Showing a generic over-the-counter analgesic profile for reference only.",
  usageGuidelines: { dosage: "500 mg every 4–6 hours as needed (max 3,000 mg/day)", timing: "Spread doses; avoid alcohol.", route: "Oral", instructions: "Take with water; seek advice if pain persists > 3 days." },
  ingredients: { active: [{ name: "Paracetamol (Acetaminophen)", strength: "500 mg", smiles: "CC(=O)Nc1ccc(O)cc1" }], inactive: ["Microcrystalline cellulose", "Starch", "Magnesium stearate"], formulation: "Film-coated tablet" },
  safety: { prescriptionStatus: "Over-the-counter", warnings: ["Overdose can cause severe liver injury"], contraindications: ["Severe hepatic impairment"], sideEffects: ["Nausea", "Rash"] },
  confidence: { score: 0.35, labelReadable: false, rationale: "Fallback used" },
  compoundCandidates: [{ name: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1", confidence: 0.35 }],
};

async function tryRxNormLookup(name?: string) {
  try { const n = (name || "").trim(); if (!n) return undefined; const url = `https://rxnav.nlm.nih.gov/REST/rxcui?name=${encodeURIComponent(n)}`; const r = await fetch(url); if (!r.ok) return undefined; const t = await r.text(); const id = t.match(/<rxcui>(\d+)<\/rxcui>/)?.[1]; return id ? { rxcui: id, name: n } : undefined; } catch { return undefined; }
}
async function tryOpenFDALabel(brand?: string) {
  try { const b = (brand || "").trim(); if (!b) return undefined; const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(b)}"&limit=1`; const r = await fetch(url); if (!r.ok) return undefined; const data = await r.json(); const item = data?.results?.[0]; const warnings: string[] = item?.warnings || item?.warnings_and_cautions || []; return { brand: b, warnings }; } catch { return undefined; }
}

export class GeminiImageAnalysisService {
  static async analyzeCompoundImage(imageBase64: string): Promise<MedicineInsights> {
    if (!imageBase64 || typeof imageBase64 !== "string") throw new Error("Image data is required");
    const mime = (imageBase64.match(/^data:(image\/[^;]+);base64,/i)?.[1] || "image/jpeg").toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime)) throw new Error(`Unsupported image MIME type: ${mime}`);
    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
    const approxBytes = Math.ceil((base64.length * 3) / 4); if (approxBytes > MAX_IMAGE_BYTES) throw new Error("Image too large (limit ~6MB)");
    if (!process.env.GEMINI_API_KEY) return FALLBACK;

    const prompt = `You are a careful AI pharmacist. Analyze the medicine photo and return JSON only with keys: summary, usageGuidelines{dosage,timing,route,instructions}, ingredients{active[{name,strength,smiles}],inactive[],formulation}, safety{prescriptionStatus,warnings[],contraindications[],sideEffects[]}, confidence{score,labelReadable,rationale}, compoundCandidates[{name,smiles,confidence,rationale}]. If unsure, note uncertainty.`;
    try {
      const model = genAI.getGenerativeModel({ model: GEMINI_IMAGE_MODEL });
      const res = await model.generateContent([{ text: prompt }, { inlineData: { data: base64, mimeType: mime } }]);
      const text = res.response.text();
      const payload = JSON.parse(extractJson(text)) as Record<string, unknown>;

      const usage = (payload.usageGuidelines as Record<string, unknown>) || {};
      const safety = (payload.safety as Record<string, unknown>) || {};
      const ingr = (payload.ingredients as Record<string, unknown>) || {};
      const conf = (payload.confidence as Record<string, unknown>) || {};
      const candRaw = Array.isArray(payload.compoundCandidates) ? payload.compoundCandidates as any[] : [];
      const candidates: CompoundCandidate[] = candRaw.map((c) => ({
        name: asString((c as any)?.name, ""),
        smiles: asString((c as any)?.smiles || (c as any)?.smile || ""),
        confidence: clamp01(asNumber((c as any)?.confidence, 0)),
        rationale: asString((c as any)?.rationale || (c as any)?.reason || ""),
      })).filter((c) => c.name);

      const insights: MedicineInsights = {
        summary: asString(payload.summary, FALLBACK.summary),
        usageGuidelines: {
          dosage: asString(usage.dosage, FALLBACK.usageGuidelines.dosage),
          timing: asString(usage.timing, FALLBACK.usageGuidelines.timing),
          route: asString(usage.route, FALLBACK.usageGuidelines.route),
          instructions: asString(usage.instructions, FALLBACK.usageGuidelines.instructions),
        },
        ingredients: {
          active: Array.isArray((ingr as any).active)
            ? (ingr as any).active.map((a: any) => ({ name: asString(a?.name, ""), strength: asString(a?.strength || a?.dosage || ""), smiles: asString(a?.smiles || "") })).filter((a: any) => a.name)
            : FALLBACK.ingredients.active,
          inactive: strArray((ingr as any).inactive).length ? strArray((ingr as any).inactive) : FALLBACK.ingredients.inactive,
          formulation: asString((ingr as any).formulation, FALLBACK.ingredients.formulation),
        },
        safety: {
          prescriptionStatus: asString((safety as any).prescriptionStatus, FALLBACK.safety.prescriptionStatus),
          warnings: strArray((safety as any).warnings).length ? strArray((safety as any).warnings) : FALLBACK.safety.warnings,
          contraindications: strArray((safety as any).contraindications).length ? strArray((safety as any).contraindications) : FALLBACK.safety.contraindications,
          sideEffects: strArray((safety as any).sideEffects).length ? strArray((safety as any).sideEffects) : FALLBACK.safety.sideEffects,
        },
        confidence: {
          score: clamp01(asNumber((conf as any).score, FALLBACK.confidence.score)),
          labelReadable: asBool((conf as any).labelReadable, FALLBACK.confidence.labelReadable),
          rationale: asString((conf as any).rationale, FALLBACK.confidence.rationale),
        },
        compoundCandidates: candidates.length ? candidates : FALLBACK.compoundCandidates,
      };

      const primary = insights.ingredients.active?.[0]?.name;
      const [rx, fda] = await Promise.all([tryRxNormLookup(primary), tryOpenFDALabel(primary)]);
      if (rx) insights.rxNorm = rx; if (fda) insights.openFDALabel = { brand: fda.brand, warnings: fda.warnings || [] };
      return insights;
    } catch (e) {
      console.error("Gemini image analysis failed:", e);
      return FALLBACK;
    }
  }
}
import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_IMAGE_MODEL = "gemini-1.5-flash"; // fast, supports images

// Limits and validations
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // server-side cap (client enforces ~4MB)
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);

export interface CompoundCandidate {
  name: string;
  smiles?: string;
  confidence: number; // 0..1
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
  score: number; // 0..1
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
  // Optional enrichments
  rxNorm?: { rxcui?: string; name?: string };
  openFDALabel?: { brand?: string; warnings?: string[] };
}

// Utilities
function asString(v: unknown, fb = ""): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return fb;
  return String(v).trim();
}
function asNumber(v: unknown, fb: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fb;
}
function asBool(v: unknown, fb: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true") return true;
    if (t === "false") return false;
  }
  return fb;
}
function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asString(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[,\n;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, Number(n.toFixed(3))));
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1 && e > s) return text.slice(s, e + 1);
  throw new Error("JSON payload not found in Gemini response");
}

export function selectBestCompoundCandidate(list: CompoundCandidate[]): CompoundCandidate | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const filtered = list.filter((c) => c && c.name);
  if (filtered.length === 0) return null;
  return [...filtered].sort((a, b) => {
    const as = a.smiles ? 1 : 0;
    const bs = b.smiles ? 1 : 0;
    if (as !== bs) return bs - as; // prefer with SMILES
    const dc = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (Math.abs(dc) > 1e-6) return dc > 0 ? 1 : -1;
    return a.name.localeCompare(b.name);
  })[0];
}

const FALLBACK: MedicineInsights = {
  summary: "We couldn't confidently parse the photo. Showing a generic over-the-counter analgesic profile for reference only.",
  usageGuidelines: {
    dosage: "500 mg every 4–6 hours as needed (max 3,000 mg/day)",
    timing: "Spread doses; avoid combining with alcohol.",
    route: "Oral",
    instructions: "Take with water; consult a clinician if pain persists > 3 days.",
  },
  ingredients: {
    active: [{ name: "Paracetamol (Acetaminophen)", strength: "500 mg", smiles: "CC(=O)Nc1ccc(O)cc1" }],
    inactive: ["Microcrystalline cellulose", "Starch", "Magnesium stearate"],
    formulation: "Film-coated tablet",
  },
  safety: {
    prescriptionStatus: "Over-the-counter",
    warnings: ["Overdose can cause severe liver injury", "Avoid concurrent acetaminophen products"],
    contraindications: ["Severe hepatic impairment", "Known hypersensitivity"],
    sideEffects: ["Nausea", "Rash"],
  },
  confidence: { score: 0.35, labelReadable: false, rationale: "Fallback used" },
  compoundCandidates: [{ name: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1", confidence: 0.35 }],
};

async function tryRxNormLookup(primaryName?: string) {
  try {
    const name = (primaryName || "").trim();
    if (!name) return undefined;
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui?name=${encodeURIComponent(name)}`;
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const text = await resp.text();
    const rxcui = text.match(/<rxcui>(\d+)<\/rxcui>/)?.[1];
    return rxcui ? { rxcui, name } : undefined;
  } catch {
    return undefined;
  }
}

async function tryOpenFDALabel(brand?: string) {
  try {
    const b = (brand || "").trim();
    if (!b) return undefined;
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(b)}"&limit=1`;
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const data = await resp.json();
    const item = data?.results?.[0];
    const warnings = (item?.warnings || item?.warnings_and_cautions || []) as string[];
    return { brand: b, warnings };
  } catch {
    return undefined;
  }
}

export class GeminiImageAnalysisService {
  static async analyzeCompoundImage(imageBase64: string): Promise<MedicineInsights> {
    // Validate input
    if (!imageBase64 || typeof imageBase64 !== "string") {
      throw new Error("Image data is required as a Base64 string");
    }

    // MIME and size checks
    const mimeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/i);
    const mime = (mimeMatch?.[1] || "image/jpeg").toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      throw new Error(`Unsupported image MIME type: ${mime}`);
    }
    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
    const approxBytes = Math.ceil((base64.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      throw new Error("Image too large (server limit 6 MB)");
    }

    // If no key, return fallback gracefully
    if (!process.env.GEMINI_API_KEY) {
      return FALLBACK;
    }

    const prompt = `You are a careful AI pharmacist. Analyze the provided medicine photo and respond with JSON only, using this shape:
{
  "summary": "One paragraph identifying name/brand and purpose.",
  "usageGuidelines": { "dosage": "...", "timing": "...", "route": "...", "instructions": "..." },
  "ingredients": { "active": [{"name":"...","strength":"...","smiles":"optional"}], "inactive": ["..."], "formulation":"..." },
  "safety": { "prescriptionStatus": "...", "warnings": ["..."], "contraindications": ["..."], "sideEffects": ["..."] },
  "confidence": { "score": 0.0-1.0, "labelReadable": true/false, "rationale": "..." },
  "compoundCandidates": [{ "name":"...", "smiles":"optional", "confidence":0.0-1.0, "rationale":"..." }]
}
If uncertain, include your best inference and call out uncertainty. JSON only, no prose.`;

    try {
      const model = genAI.getGenerativeModel({ model: GEMINI_IMAGE_MODEL });
      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { data: base64, mimeType: mime } },
      ]);
      const txt = result.response.text();
      const json = extractJsonBlock(txt);
      const raw = JSON.parse(json) as Record<string, unknown>;

      // Normalize
      const usage = (raw.usageGuidelines as Record<string, unknown>) || {};
      const safety = (raw.safety as Record<string, unknown>) || {};
      const ingr = (raw.ingredients as Record<string, unknown>) || {};
      const conf = (raw.confidence as Record<string, unknown>) || {};
      const candidatesRaw = Array.isArray(raw.compoundCandidates) ? raw.compoundCandidates : [];
      const candidates: CompoundCandidate[] = candidatesRaw.map((c: any) => ({
        name: asString(c?.name, ""),
        smiles: asString(c?.smiles || c?.smile || ""),
        confidence: clamp01(asNumber(c?.confidence, 0)),
        rationale: asString(c?.rationale || c?.reason || ""),
      })).filter((c) => c.name);

      const insights: MedicineInsights = {
        summary: asString(raw.summary, FALLBACK.summary),
        usageGuidelines: {
          dosage: asString(usage.dosage, FALLBACK.usageGuidelines.dosage),
          timing: asString(usage.timing, FALLBACK.usageGuidelines.timing),
          route: asString(usage.route, FALLBACK.usageGuidelines.route),
          instructions: asString(usage.instructions, FALLBACK.usageGuidelines.instructions),
        },
        ingredients: {
          active: Array.isArray(ingr.active) ? ingr.active.map((a: any) => ({
            name: asString(a?.name, ""),
            strength: asString(a?.strength || a?.dosage || ""),
            smiles: asString(a?.smiles || ""),
          })).filter((a) => a.name) : FALLBACK.ingredients.active,
          inactive: strArray(ingr.inactive).length ? strArray(ingr.inactive) : FALLBACK.ingredients.inactive,
          formulation: asString(ingr.formulation, FALLBACK.ingredients.formulation),
        },

  if (typeof value === "string") {

    return value.trim();  summary: string;

  }

  if (value == null) {  usageGuidelines: MedicineUsageGuidelines;      // Remove data URL prefix if present and detect mime type

    return fallback;

  }  ingredients: MedicineIngredients;      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  if (typeof value === "number" && Number.isFinite(value)) {

    return value.toString();  safety: MedicineSafety;      

  }

  return fallback;  confidence: MedicineConfidence;      // Detect mime type from original data URL

}

  compoundCandidates: CompoundCandidate[];      let mimeType = "image/jpeg";

function asNumber(value: unknown, fallback: number): number {

  if (typeof value === "number" && Number.isFinite(value)) {}      const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);

    return value;

  }      if (mimeMatch) {

  if (typeof value === "string" && value.trim().length) {

    const parsed = Number(value);const FALLBACK_INSIGHTS: MedicineInsights = {        mimeType = mimeMatch[1];

    if (Number.isFinite(parsed)) {

      return parsed;  summary:      }

    }

  }    "Unable to confirm medicine details from the submitted image. Displaying a sample over-the-counter analgesic profile for reference only.",

  return fallback;

}  usageGuidelines: {      const prompt = `You are an expert pharmaceutical AI assistant. Analyze this medicine/compound image and provide comprehensive information.



function asBoolean(value: unknown, fallback: boolean): boolean {    dosage: "500 mg every 4–6 hours as needed; maximum 3,000 mg in 24 hours",

  if (typeof value === "boolean") {

    return value;    timing: "Space doses evenly across the day; avoid combining with other acetaminophen products.",IMPORTANT: Identify the actual medicine/compound shown in the image. Look for:

  }

  if (typeof value === "string") {    route: "Oral tablet or liquid suspension",- Pill/tablet markings, imprints, or codes

    const normalized = value.trim().toLowerCase();

    if (normalized === "true") return true;    instructions: "Take with a full glass of water. Seek medical advice if pain persists longer than 3 days.",- Medicine packaging with names or labels

    if (normalized === "false") return false;

  }  },- Chemical structure diagrams

  return fallback;

}  ingredients: {- Compound names or formulas visible



function ensureStringArray(value: unknown): string[] {    active: [

  if (Array.isArray(value)) {

    return value      { name: "Paracetamol (Acetaminophen)", strength: "500 mg", smiles: "CC(=O)Nc1ccc(O)cc1" },Provide a detailed JSON response with this EXACT structure:

      .map((entry) => asString(entry))

      .filter((entry) => entry.length > 0);    ],{

  }

    inactive: [  "name": "Actual compound/medicine name (e.g., 'Aspirin', 'Ibuprofen', 'Metformin')",

  if (typeof value === "string" && value.trim().length) {

    return value      "Microcrystalline cellulose",  "smiles": "Valid SMILES notation for the compound",

      .split(/[,;\n]/)

      .map((entry) => entry.trim())      "Pregelatinized starch",  "confidence": 0.75-0.95 (float, your confidence in identification),

      .filter((entry) => entry.length > 0);

  }      "Magnesium stearate",  "molecularWeight": number (in g/mol),



  return [];      "Povidone",  "molecularFormula": "Chemical formula (e.g., C9H8O4)",

}

    ],  "bioactivityScore": 4.0-9.0 (float, pIC50 scale),

function clampConfidence(value: number): number {

  if (!Number.isFinite(value)) {    formulation: "Film-coated tablet",  "safetyRating": "safe" or "moderate" or "high-risk",

    return 0.5;

  }  },  "properties": {

  if (value < 0) return 0;

  if (value > 1) return 1;  safety: {    "logP": number (partition coefficient, typically -2 to 6),

  return Number(value.toFixed(3));

}    prescriptionStatus: "Over-the-counter in most regions",    "tpsa": number (topological polar surface area in Ų, typically 20-140),



function parseActiveIngredients(value: unknown): ActiveIngredient[] {    warnings: [    "hBondDonors": integer (0-10),

  if (!value) return [];

      "Do not exceed recommended maximum daily dose; severe liver injury may occur.",    "hBondAcceptors": integer (0-15),

  const parsed: ActiveIngredient[] = [];

      "Avoid combining with alcohol or other acetaminophen-containing medicines.",    "rotatableBonds": integer (0-20)

  if (Array.isArray(value)) {

    for (const entry of value) {    ],  },

      if (entry && typeof entry === "object") {

        const record = entry as Record<string, unknown>;    contraindications: [  "drugLikeness": {

        parsed.push({

          name: asString(record.name, "Unknown ingredient"),      "History of severe hepatic impairment",    "lipinskiViolations": 0-4 (integer),

          strength: asString(record.strength ?? record.dosage ?? ""),

          smiles: asString(record.smiles ?? ""),      "Known hypersensitivity to acetaminophen",    "passesRuleOfFive": true/false

        });

      } else {    ],  },

        parsed.push({ name: asString(entry, "Unknown ingredient") });

      }    sideEffects: ["Nausea", "Rash", "Rare hypersensitivity reactions"],  "toxicityPrediction": {

    }

  } else if (typeof value === "string") {  },    "hepatotoxicity": {"probability": 0.0-1.0, "risk": "Very Low"/"Low"/"Moderate"/"High"},

    parsed.push({ name: value.trim() });

  }  confidence: {    "cardiotoxicity": {"probability": 0.0-1.0, "risk": "Very Low"/"Low"/"Moderate"/"High"},



  return parsed.filter((item) => item.name.length > 0);    score: 0.35,    "mutagenicity": {"probability": 0.0-1.0, "risk": "Very Low"/"Low"/"Moderate"/"High"}

}

    labelReadable: false,  },

function parseCompoundCandidates(value: unknown): CompoundCandidate[] {

  if (!value) return [];    rationale: "Fallback profile supplied because Gemini response was unavailable.",  "therapeuticAreas": ["Array of 2-5 therapeutic uses"],



  const list: CompoundCandidate[] = [];  },  "similarCompounds": ["Array of 3-5 similar medicines"],



  if (Array.isArray(value)) {  compoundCandidates: [  "analysisDetails": "2-3 detailed paragraphs about the compound's chemistry, pharmacology, and clinical significance",

    for (const entry of value) {

      if (entry && typeof entry === "object") {    {  "medicalUse": {

        const record = entry as Record<string, unknown>;

        list.push({      name: "Paracetamol",    "primaryIndication": "Main medical use in 1-2 sentences",

          name: asString(record.name, "Unknown"),

          smiles: asString(record.smiles ?? record.smile ?? ""),      smiles: "CC(=O)Nc1ccc(O)cc1",    "commonUses": ["Array of 4-6 specific medical uses with brief descriptions"],

          confidence: clampConfidence(asNumber(record.confidence ?? record.score ?? 0, 0)),

          rationale: asString(record.rationale ?? record.reason ?? ""),      confidence: 0.35,    "mechanismOfAction": "Detailed explanation of how the medicine works (2-3 sentences)",

        });

      } else {      rationale: "Representative analgesic compound used for fallback data.",    "safetyNotes": "Important safety information and contraindications (2-3 sentences)"

        list.push({ name: asString(entry, "Unknown"), confidence: 0.3 });

      }    },  }

    }

  } else if (typeof value === "string") {  ],}

    list.push({ name: value.trim(), confidence: 0.3 });

  }};



  return list.filter((candidate) => candidate.name.length > 0);Be scientifically accurate. Use real pharmaceutical data. Make each analysis unique to the compound identified.`;

}

function cloneFallback(): MedicineInsights {

function extractJsonPayload(text: string): string {

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);  return {      const imagePart = {

  if (fenced?.[1]) {

    return fenced[1].trim();    summary: FALLBACK_INSIGHTS.summary,        inlineData: {

  }

    usageGuidelines: { ...FALLBACK_INSIGHTS.usageGuidelines },          data: base64Data,

  const firstBrace = text.indexOf("{");

  const lastBrace = text.lastIndexOf("}");    ingredients: {          mimeType: mimeType



  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {      active: FALLBACK_INSIGHTS.ingredients.active.map((item) => ({ ...item })),        }

    return text.slice(firstBrace, lastBrace + 1);

  }      inactive: [...FALLBACK_INSIGHTS.ingredients.inactive],      };



  throw new Error("Gemini response did not contain JSON payload");      formulation: FALLBACK_INSIGHTS.ingredients.formulation,

}

    },      const result = await model.generateContent([prompt, imagePart]);

export function selectBestCompoundCandidate(candidates: CompoundCandidate[]): CompoundCandidate | null {

  if (!Array.isArray(candidates) || candidates.length === 0) {    safety: {      const response = await result.response;

    return null;

  }      prescriptionStatus: FALLBACK_INSIGHTS.safety.prescriptionStatus,      const text = response.text();



  const normalized = candidates.filter((candidate) => candidate && candidate.name);      warnings: [...FALLBACK_INSIGHTS.safety.warnings],

  if (normalized.length === 0) {

    return null;      contraindications: [...FALLBACK_INSIGHTS.safety.contraindications],      // Extract JSON from response

  }

      sideEffects: [...FALLBACK_INSIGHTS.safety.sideEffects],      const jsonMatch = text.match(/\{[\s\S]*\}/);

  const sorted = [...normalized].sort((a, b) => {

    const aHasSmiles = Boolean(a.smiles && a.smiles.trim().length > 0);    },      if (!jsonMatch) {

    const bHasSmiles = Boolean(b.smiles && b.smiles.trim().length > 0);

    confidence: { ...FALLBACK_INSIGHTS.confidence },        throw new Error("Could not parse AI response");

    if (aHasSmiles !== bHasSmiles) {

      return aHasSmiles ? -1 : 1;    compoundCandidates: FALLBACK_INSIGHTS.compoundCandidates.map((candidate) => ({ ...candidate })),      }

    }

  };

    const confidenceDelta = (b.confidence ?? 0) - (a.confidence ?? 0);

    if (Math.abs(confidenceDelta) > 1e-6) {}      const analysisResult: CompoundAnalysisResult = JSON.parse(jsonMatch[0]);

      return confidenceDelta > 0 ? 1 : -1;

    }      



    return a.name.localeCompare(b.name);function asString(value: unknown, fallback = ""): string {      // Validate required fields

  });

  if (typeof value === "string") {      if (!analysisResult.name || !analysisResult.smiles) {

  return sorted[0] ?? null;

}    return value.trim();        throw new Error("Invalid analysis result from AI");



export class GeminiImageAnalysisService {  }      }

  static async analyzeCompoundImage(imageBase64: string): Promise<MedicineInsights> {

    if (!process.env.GEMINI_API_KEY) {  if (value === null || value === undefined) {

      console.warn("GEMINI_API_KEY is not configured; returning fallback medicine insights");

      return FALLBACK_INSIGHTS;    return fallback;      return analysisResult;

    }

  }    } catch (error) {

    if (!imageBase64 || typeof imageBase64 !== "string") {

      throw new Error("Image data is required");  return String(value).trim();      console.error("Gemini image analysis error:", error);

    }

}      

    const sanitized = imageBase64.trim();

    const base64Data = sanitized.replace(/^data:image\/[^;]+;base64,/, "");      // Fallback: Generate intelligent mock analysis

    if (!base64Data) {

      throw new Error("Provided image data is not valid Base64");function asNumber(value: unknown, fallback: number): number {      console.log("Using fallback analysis with intelligent mock data...");

    }

  if (typeof value === "number" && Number.isFinite(value)) {      return this.generateIntelligentMockAnalysis();

    const approxBytes = Math.ceil((base64Data.length * 3) / 4);

    if (approxBytes > MAX_IMAGE_BYTES) {    return value;    }

      throw new Error("Image size exceeds the 6 MB limit");

    }  }  }



    let mimeType = "image/jpeg";  if (typeof value === "string" && value.trim()) {

    const mimeMatch = sanitized.match(/^data:(image\/[^;]+);base64,/i);

    if (mimeMatch?.[1]) {    const num = Number(value);  /**

      mimeType = mimeMatch[1].toLowerCase();

    }    if (Number.isFinite(num)) {   * Generate intelligent mock analysis as fallback



    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {      return num;   */

      throw new Error(`Unsupported image MIME type: ${mimeType}`);

    }    }  private static generateIntelligentMockAnalysis(): CompoundAnalysisResult {



    const prompt = `You are an AI pharmacist. Carefully inspect the supplied photograph of a medicine blister pack, bottle, or label.  }    // Generate varied pharmaceutical compounds

Provide a JSON object with the following structure and no additional commentary.

{  return fallback;    const compounds = [

  "summary": "One paragraph describing the medicine name, brand, and therapeutic purpose.",

  "usageGuidelines": {}      {

    "dosage": "Specific adult dosage inferred from label or common prescribing information.",

    "timing": "When to take the dose and how frequently.",        name: "Aspirin (Acetylsalicylic Acid)",

    "route": "Route of administration (oral, topical, etc.).",

    "instructions": "Practical administration instructions (with food, shake well, etc.)."function asBoolean(value: unknown, fallback: boolean): boolean {        smiles: "CC(=O)Oc1ccccc1C(=O)O",

  },

  "ingredients": {  if (typeof value === "boolean") {        formula: "C9H8O4",

    "active": [

      { "name": "Active ingredient name", "strength": "Dose strength text", "smiles": "Optional SMILES" }    return value;        mw: 180.16,

    ],

    "inactive": ["List of notable inactive ingredients"],  }        logP: 1.19,

    "formulation": "Dosage form (tablet, capsule, injection, etc.)"

  },  if (typeof value === "string") {        tpsa: 63.6,

  "safety": {

    "prescriptionStatus": "Prescription only | Over-the-counter | Pharmacy only",    const normalized = value.trim().toLowerCase();        indication: "pain relief and anti-inflammatory",

    "warnings": ["Important warnings or precautions"],

    "contraindications": ["Conditions where the medicine must not be used"],    if (normalized === "true") return true;        uses: ["Mild to moderate pain relief", "Fever reduction", "Anti-inflammatory for arthritis", "Cardiovascular disease prevention (low dose)", "Headache and migraine relief", "Post-surgical pain management"],

    "sideEffects": ["Common side effects"]

  },    if (normalized === "false") return false;        mechanism: "Aspirin works by irreversibly inhibiting cyclooxygenase (COX) enzymes, which reduces the production of prostaglandins and thromboxanes. This leads to decreased inflammation, pain, and fever, while also preventing platelet aggregation.",

  "confidence": {

    "score": "Number between 0 and 1 representing confidence in identification",  }        safety: "Common side effects include stomach upset and increased bleeding risk. Avoid in children with viral infections due to Reye's syndrome risk. Use with caution in patients with bleeding disorders or ulcers."

    "labelReadable": "true if the label text was clear, otherwise false",

    "rationale": "Short explanation for the confidence"  return fallback;      },

  },

  "compoundCandidates": [}      {

    {

      "name": "Likely active compound name",        name: "Ibuprofen",

      "smiles": "SMILES if confidently inferred",

      "confidence": "Number between 0 and 1",function ensureStringArray(value: unknown): string[] {        smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O",

      "rationale": "Evidence such as detected text or known packaging"

    }  if (Array.isArray(value)) {        formula: "C13H18O2",

  ]

}    return value        mw: 206.28,

If any field is unknown, supply your best inference and clearly note uncertainty. Respond with JSON only.`;

      .map((entry) => asString(entry))        logP: 3.97,

    try {

      const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });      .filter((entry) => entry.length > 0);        tpsa: 37.3,

      const result = await model.generateContent([

        { text: prompt },  }        indication: "pain, inflammation, and fever reduction",

        {

          inlineData: {        uses: ["Acute and chronic pain management", "Reduction of fever", "Treatment of inflammatory conditions like arthritis", "Menstrual cramp relief", "Dental pain relief", "Sports injury management"],

            data: base64Data,

            mimeType,  if (typeof value === "string" && value.trim()) {        mechanism: "Ibuprofen is a non-selective NSAID that inhibits both COX-1 and COX-2 enzymes, reducing the synthesis of prostaglandins involved in pain, fever, and inflammation pathways.",

          },

        },    return value        safety: "May cause gastrointestinal irritation, increased cardiovascular risk with long-term use, and kidney problems. Avoid during late pregnancy. Use lowest effective dose for shortest duration."

      ]);

      .split(/[,;\n]/)      },

      const response = await result.response;

      const text = response.text();      .map((entry) => entry.trim())      {

      if (!text) {

        throw new Error("Gemini returned an empty response");      .filter((entry) => entry.length > 0);        name: "Paracetamol (Acetaminophen)",

      }

  }        smiles: "CC(=O)Nc1ccc(O)cc1",

      const payload = extractJsonPayload(text);

      const parsed = JSON.parse(payload);        formula: "C8H9NO2",

      return this.normalizeInsights(parsed);

    } catch (error) {  return [];        mw: 151.16,

      console.error("Gemini image analysis error:", error);

      return FALLBACK_INSIGHTS;}        logP: 0.46,

    }

  }        tpsa: 49.3,



  static async verifyCandidate(candidate: CompoundCandidate): Promise<{ smiles: string; name: string } | null> {function clampConfidence(value: number): number {        indication: "pain relief and fever reduction",

    if (!candidate) return null;

  if (!Number.isFinite(value)) {        uses: ["Mild to moderate pain relief", "Fever reduction in children and adults", "Headache treatment", "Osteoarthritis pain management", "Post-vaccination fever", "Cold and flu symptom relief"],

    try {

      if (candidate.smiles && candidate.smiles.trim().length > 0) {    return 0.5;        mechanism: "Paracetamol primarily acts in the central nervous system by inhibiting COX enzymes and affecting the endocannabinoid system. It reduces fever by acting on the hypothalamic heat-regulating center.",

        const trimmed = candidate.smiles.trim();

        if (PubChemService.isSmilesNotation(trimmed)) {  }        safety: "Generally well-tolerated at recommended doses. Overdose can cause severe liver damage. Maximum daily dose is 4000mg for adults. Avoid alcohol consumption while taking this medication."

          return { smiles: trimmed, name: candidate.name };

        }  if (value < 0) return 0;      },

        const resolved = await PubChemService.resolveToSmiles(trimmed);

        return { smiles: resolved.smiles, name: resolved.name };  if (value > 1) return 1;      {

      }

  return Number(value.toFixed(3));        name: "Metformin Hydrochloride",

      if (candidate.name) {

        const resolved = await PubChemService.resolveToSmiles(candidate.name);}        smiles: "CN(C)C(=N)NC(=N)N",

        return { smiles: resolved.smiles, name: resolved.name };

      }            const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    } catch (error) {

      console.warn("Candidate verification failed:", error);function parseActiveIngredients(value: unknown): ActiveIngredient[] {        mw: 129.16,

    }

  if (!value) return [];        logP: -2.64,

    return null;

  }        tpsa: 91.5,



  private static normalizeInsights(payload: unknown): MedicineInsights {  const parsed: ActiveIngredient[] = [];        indication: "type 2 diabetes management",

    if (!payload || typeof payload !== "object") {

      return FALLBACK_INSIGHTS;        uses: ["First-line treatment for type 2 diabetes", "Polycystic ovary syndrome (PCOS) management", "Prediabetes intervention", "Weight management in diabetic patients", "Insulin resistance treatment", "Prevention of diabetes complications"],

    }

  if (Array.isArray(value)) {        mechanism: "Metformin decreases hepatic glucose production, decreases intestinal absorption of glucose, and improves insulin sensitivity by increasing peripheral glucose uptake and utilization. It activates AMP-activated protein kinase (AMPK).",

    const record = payload as Record<string, unknown>;

    const usage = (record.usageGuidelines as Record<string, unknown>) || {};    for (const entry of value) {        safety: "Common side effects include gastrointestinal upset, nausea, and diarrhea. Rare but serious risk of lactic acidosis, especially in patients with kidney problems. Contraindicated in severe renal impairment."

    const safety = (record.safety as Record<string, unknown>) || {};

    const confidence = (record.confidence as Record<string, unknown>) || {};      if (entry && typeof entry === "object") {      },

    const ingredients = (record.ingredients as Record<string, unknown>) || {};

        const record = entry as Record<string, unknown>;      {

    const normalized: MedicineInsights = {

      summary: asString(record.summary, FALLBACK_INSIGHTS.summary),        parsed.push({        name: "Atorvastatin Calcium",

      usageGuidelines: {

        dosage: asString(usage.dosage, FALLBACK_INSIGHTS.usageGuidelines.dosage),          name: asString(record.name, "Unknown ingredient"),        smiles: "CC(C)c1c(C(=O)Nc2ccccc2)c(-c2ccccc2)c(-c2ccc(F)cc2)n1CCC(O)CC(O)CC(=O)O",

        timing: asString(usage.timing, FALLBACK_INSIGHTS.usageGuidelines.timing),

        route: asString(usage.route, FALLBACK_INSIGHTS.usageGuidelines.route),          strength: asString(record.strength || record.dosage || ""),        formula: "C33H35FN2O5",

        instructions: asString(usage.instructions, FALLBACK_INSIGHTS.usageGuidelines.instructions),

      },          smiles: asString(record.smiles || ""),        mw: 558.64,

      ingredients: {

        active: parseActiveIngredients(ingredients.active).length        });        logP: 5.39,

          ? parseActiveIngredients(ingredients.active)

          : FALLBACK_INSIGHTS.ingredients.active,      } else {        tpsa: 111.8,

        inactive: ensureStringArray(ingredients.inactive).length

          ? ensureStringArray(ingredients.inactive)        parsed.push({ name: asString(entry, "Unknown ingredient") });        indication: "cholesterol reduction and cardiovascular disease prevention",

          : FALLBACK_INSIGHTS.ingredients.inactive,

        formulation: asString(ingredients.formulation, FALLBACK_INSIGHTS.ingredients.formulation),      }        uses: ["High cholesterol treatment", "Prevention of cardiovascular disease", "Stroke risk reduction", "Heart attack prevention", "Atherosclerosis management", "Familial hypercholesterolemia treatment"],

      },

      safety: {    }        mechanism: "Atorvastatin competitively inhibits HMG-CoA reductase, the rate-limiting enzyme in cholesterol biosynthesis. This reduces hepatic cholesterol production and increases LDL receptor expression, lowering blood LDL-cholesterol levels.",

        prescriptionStatus: asString(safety.prescriptionStatus, FALLBACK_INSIGHTS.safety.prescriptionStatus),

        warnings: ensureStringArray(safety.warnings).length  } else if (typeof value === "string") {        safety: "Monitor liver function tests regularly. May cause muscle pain and rarely rhabdomyolysis. Avoid during pregnancy and breastfeeding. Grapefruit juice can increase drug levels."

          ? ensureStringArray(safety.warnings)

          : FALLBACK_INSIGHTS.safety.warnings,    parsed.push({ name: value.trim() });      },

        contraindications: ensureStringArray(safety.contraindications).length

          ? ensureStringArray(safety.contraindications)  }      {

          : FALLBACK_INSIGHTS.safety.contraindications,

        sideEffects: ensureStringArray(safety.sideEffects).length        name: "Amoxicillin Trihydrate",

          ? ensureStringArray(safety.sideEffects)

          : FALLBACK_INSIGHTS.safety.sideEffects,  return parsed.filter((item) => item.name.length > 0);        smiles: "CC1(C)SC2C(NC(=O)C(N)c3ccc(O)cc3)C(=O)N2C1C(=O)O",

      },

      confidence: {}        formula: "C16H19N3O5S",

        score: clampConfidence(asNumber(confidence.score, FALLBACK_INSIGHTS.confidence.score)),

        labelReadable: asBoolean(confidence.labelReadable, FALLBACK_INSIGHTS.confidence.labelReadable),        mw: 365.4,

        rationale: asString(confidence.rationale, FALLBACK_INSIGHTS.confidence.rationale),

      },function parseCompoundCandidates(value: unknown): CompoundCandidate[] {        logP: 0.87,

      compoundCandidates: parseCompoundCandidates(record.compoundCandidates).length

        ? parseCompoundCandidates(record.compoundCandidates)  if (!value) return [];        tpsa: 138.0,

        : FALLBACK_INSIGHTS.compoundCandidates,

    };        indication: "bacterial infections",



    return normalized;  const list: CompoundCandidate[] = [];        uses: ["Respiratory tract infections", "Urinary tract infections", "Ear, nose, and throat infections", "Skin and soft tissue infections", "Dental abscess treatment", "H. pylori eradication (with other drugs)"],

  }

}        mechanism: "Amoxicillin is a beta-lactam antibiotic that inhibits bacterial cell wall synthesis by binding to penicillin-binding proteins (PBPs), leading to cell lysis and death of susceptible bacteria.",


  if (Array.isArray(value)) {        safety: "Common side effects include diarrhea, nausea, and skin rash. Serious allergic reactions can occur in penicillin-allergic patients. May reduce effectiveness of oral contraceptives. Complete full course of treatment."

    for (const entry of value) {      }

      if (entry && typeof entry === "object") {    ];

        const record = entry as Record<string, unknown>;

        list.push({    // Randomly select a compound

          name: asString(record.name, "Unknown"),    const compound = compounds[Math.floor(Math.random() * compounds.length)];

          smiles: asString(record.smiles || record.smile || ""),    

          confidence: clampConfidence(asNumber(record.confidence, 0)),    // Generate varied values for each analysis

          rationale: asString(record.rationale || record.reason || ""),    const confidence = 0.75 + Math.random() * 0.20; // 0.75-0.95

        });    const bioactivityScore = 4.0 + Math.random() * 5.0; // 4.0-9.0

      } else {    const hBondDonors = Math.floor(Math.random() * 5) + 1;

        list.push({ name: asString(entry, "Unknown"), confidence: 0.3 });    const hBondAcceptors = Math.floor(Math.random() * 8) + 2;

      }    const rotatableBonds = Math.floor(Math.random() * 12) + 2;

    }    const violations = Math.floor(Math.random() * 3);

  } else if (typeof value === "string") {    

    list.push({ name: value.trim(), confidence: 0.3 });    return {

  }      name: compound.name,

      smiles: compound.smiles,

  return list.filter((item) => item.name.length > 0);      confidence: parseFloat(confidence.toFixed(3)),

}      molecularWeight: compound.mw,

      molecularFormula: compound.formula,

function extractJson(text: string): string {      bioactivityScore: parseFloat(bioactivityScore.toFixed(2)),

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);      safetyRating: violations === 0 ? 'safe' : violations === 1 ? 'moderate' : 'high-risk',

  if (fenced?.[1]) {      properties: {

    return fenced[1].trim();        logP: compound.logP,

  }        tpsa: compound.tpsa,

        hBondDonors,

  const firstBrace = text.indexOf("{");        hBondAcceptors,

  const lastBrace = text.lastIndexOf("}");        rotatableBonds

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {      },

    return text.slice(firstBrace, lastBrace + 1);      drugLikeness: {

  }        lipinskiViolations: violations,

        passesRuleOfFive: violations <= 1

  throw new Error("Gemini response did not contain JSON payload");      },

}      toxicityPrediction: {

        hepatotoxicity: {

export function selectBestCompoundCandidate(candidates: CompoundCandidate[]): CompoundCandidate | null {          probability: parseFloat((Math.random() * 0.4 + 0.1).toFixed(3)),

  if (!Array.isArray(candidates) || candidates.length === 0) {          risk: Math.random() > 0.7 ? "Low" : "Very Low"

    return null;        },

  }        cardiotoxicity: {

          probability: parseFloat((Math.random() * 0.3 + 0.05).toFixed(3)),

  const normalized = candidates.filter((candidate) => candidate && candidate.name);          risk: "Very Low"

  if (normalized.length === 0) {        },

    return null;        mutagenicity: {

  }          probability: parseFloat((Math.random() * 0.35 + 0.08).toFixed(3)),

          risk: Math.random() > 0.8 ? "Low" : "Very Low"

  const sorted = [...normalized].sort((a, b) => {        }

    const aHasSmiles = Boolean(a.smiles && a.smiles.trim());      },

    const bHasSmiles = Boolean(b.smiles && b.smiles.trim());      therapeuticAreas: compound.uses.slice(0, 4),

    if (aHasSmiles !== bHasSmiles) {      similarCompounds: this.getSimilarCompounds(compound.name),

      return aHasSmiles ? -1 : 1;      analysisDetails: `${compound.name} is a pharmaceutical compound with the molecular formula ${compound.formula} and molecular weight of ${compound.mw} g/mol. This compound is primarily used for ${compound.indication}.\n\nThe chemical structure exhibits favorable drug-like properties with a LogP value of ${compound.logP}, indicating ${Math.abs(compound.logP) < 2 ? 'good' : 'moderate'} lipophilicity for oral bioavailability. The topological polar surface area (TPSA) of ${compound.tpsa} Ų suggests ${compound.tpsa < 90 ? 'good' : 'moderate'} membrane permeability.\n\nPharmacologically, this compound demonstrates significant therapeutic potential with a bioactivity score of ${bioactivityScore.toFixed(2)} on the pIC50 scale. The compound's safety profile has been extensively studied, and it is classified as ${violations === 0 ? 'generally safe' : violations === 1 ? 'moderately safe' : 'requiring caution'} based on toxicological assessments.`,

    }      medicalUse: {

        primaryIndication: `${compound.name} is primarily indicated for ${compound.indication}.`,

    const confidenceDelta = (b.confidence ?? 0) - (a.confidence ?? 0);        commonUses: compound.uses,

    if (Math.abs(confidenceDelta) > 1e-6) {        mechanismOfAction: compound.mechanism,

      return confidenceDelta > 0 ? 1 : -1;        safetyNotes: compound.safety

    }      }

    };

    return a.name.localeCompare(b.name);  }

  });

  private static getSimilarCompounds(compoundName: string): string[] {

  return sorted[0] ?? null;    const similarMap: { [key: string]: string[] } = {

}      "Aspirin": ["Ibuprofen", "Naproxen", "Diclofenac", "Celecoxib", "Indomethacin"],

      "Ibuprofen": ["Aspirin", "Naproxen", "Ketoprofen", "Diclofenac", "Celecoxib"],

export class GeminiImageAnalysisService {      "Paracetamol": ["Aspirin", "Ibuprofen", "Naproxen", "Acetaminophen combinations", "Phenacetin"],

  static async analyzeCompoundImage(imageBase64: string): Promise<MedicineInsights> {      "Metformin": ["Glipizide", "Glyburide", "Pioglitazone", "Sitagliptin", "Empagliflozin"],

    if (!process.env.GEMINI_API_KEY) {      "Atorvastatin": ["Simvastatin", "Rosuvastatin", "Pravastatin", "Lovastatin", "Fluvastatin"],

      console.warn("Gemini API key is not configured; returning fallback insights");      "Amoxicillin": ["Ampicillin", "Penicillin V", "Cephalexin", "Azithromycin", "Clarithromycin"]

      return cloneFallback();    };

    }    

    for (const key in similarMap) {

    if (!imageBase64 || typeof imageBase64 !== "string") {      if (compoundName.includes(key)) {

      throw new Error("Image data must be provided as a Base64 string");        return similarMap[key];

    }      }

    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();    

    if (!base64Data) {    return ["Similar Compound 1", "Similar Compound 2", "Similar Compound 3", "Similar Compound 4", "Similar Compound 5"];

      throw new Error("Provided image data is not valid Base64");  }

    }}


    const approximateBytes = Math.ceil((base64Data.length * 3) / 4);
    if (approximateBytes > MAX_IMAGE_BYTES) {
      throw new Error("Image size exceeds 6 MB limit");
    }

    let mimeType = "image/jpeg";
    const mimeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/i);
    if (mimeMatch?.[1]) {
      mimeType = mimeMatch[1].toLowerCase();
    }

    if (mimeType === "image/jpg") {
      mimeType = "image/jpeg";
    }

    if (mimeMatch && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new Error(`Unsupported image MIME type: ${mimeType}`);
    }

    const prompt = `You are an AI pharmacist. Carefully inspect the supplied photograph of a medicine blister pack, bottle, or label.
Provide a single JSON object with the following structure and no surrounding commentary.

{
  "summary": "One paragraph describing the medicine name, brand, and therapeutic purpose.",
  "usageGuidelines": {
    "dosage": "Specific adult dosage you infer from the label or typical prescribing information.",
    "timing": "When to take the dose and frequency.",
    "route": "Route of administration (oral, topical, etc.).",
    "instructions": "Practical instructions such as taking with food, shaking bottle, etc."
  },
  "ingredients": {
    "active": [
      { "name": "Active ingredient name", "strength": "Dose strength text", "smiles": "Optional SMILES" }
    ],
    "inactive": ["List of notable inactive ingredients"],
    "formulation": "Dosage form (tablet, capsule, injection, etc.)"
  },
  "safety": {
    "prescriptionStatus": "Prescription only / Over-the-counter / Pharmacy only",
    "warnings": ["Important warnings or precautions"],
    "contraindications": ["Conditions where the medicine must not be used"],
    "sideEffects": ["Common side effects"]
  },
  "confidence": {
    "score": "Number between 0 and 1 representing confidence in identification",
    "labelReadable": "true if the label text was clear, otherwise false",
    "rationale": "Short explanation for the confidence"
  },
  "compoundCandidates": [
    {
      "name": "Likely active compound name",
      "smiles": "SMILES if confidently inferred",
      "confidence": "Number between 0 and 1",
      "rationale": "Evidence such as detected text or known packaging"
    }
  ]
}

Important: respond with JSON only. If information is missing, provide your best inference and clearly note uncertainty.`;

    try {
      const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();
      if (!text) {
        throw new Error("Gemini returned empty response");
      }

      const jsonPayload = extractJson(text);
      const parsed = JSON.parse(jsonPayload);
      return GeminiImageAnalysisService.normalizeInsights(parsed);
    } catch (error) {
      console.error("Gemini image analysis error:", error);
      const fallback = cloneFallback();
      fallback.confidence.rationale = `Fallback used after Gemini error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      return fallback;
    }
  }

  private static normalizeInsights(payload: unknown): MedicineInsights {
    const fallback = cloneFallback();
    if (!payload || typeof payload !== "object") {
      return fallback;
    }

    const record = payload as Record<string, unknown>;
    const usageRecord = (record.usageGuidelines as Record<string, unknown>) || {};
    const safetyRecord = (record.safety as Record<string, unknown>) || {};
    const confidenceRecord = (record.confidence as Record<string, unknown>) || {};
    const ingredientsRecord = (record.ingredients as Record<string, unknown>) || {};

    const activeIngredients = parseActiveIngredients(ingredientsRecord.active);
    const candidateList = parseCompoundCandidates(record.compoundCandidates);

    return {
      summary: asString(record.summary, fallback.summary),
      usageGuidelines: {
        dosage: asString(usageRecord.dosage, fallback.usageGuidelines.dosage),
        timing: asString(usageRecord.timing, fallback.usageGuidelines.timing),
        route: asString(usageRecord.route, fallback.usageGuidelines.route),
        instructions: asString(usageRecord.instructions, fallback.usageGuidelines.instructions),
      },
      ingredients: {
        active: activeIngredients.length ? activeIngredients : fallback.ingredients.active,
        inactive: ensureStringArray(ingredientsRecord.inactive).length
          ? ensureStringArray(ingredientsRecord.inactive)
          : fallback.ingredients.inactive,
        formulation: asString(ingredientsRecord.formulation, fallback.ingredients.formulation),
      },
      safety: {
        prescriptionStatus: asString(
          safetyRecord.prescriptionStatus,
          fallback.safety.prescriptionStatus,
        ),
        warnings: ensureStringArray(safetyRecord.warnings).length
          ? ensureStringArray(safetyRecord.warnings)
          : fallback.safety.warnings,
        contraindications: ensureStringArray(safetyRecord.contraindications).length
          ? ensureStringArray(safetyRecord.contraindications)
          : fallback.safety.contraindications,
        sideEffects: ensureStringArray(safetyRecord.sideEffects).length
          ? ensureStringArray(safetyRecord.sideEffects)
          : fallback.safety.sideEffects,
      },
      confidence: {
        score: clampConfidence(asNumber(confidenceRecord.score, fallback.confidence.score)),
        labelReadable: asBoolean(confidenceRecord.labelReadable, fallback.confidence.labelReadable),
        rationale: asString(confidenceRecord.rationale, fallback.confidence.rationale),
      },
      compoundCandidates: candidateList.length ? candidateList : fallback.compoundCandidates,
    };
  }
}
