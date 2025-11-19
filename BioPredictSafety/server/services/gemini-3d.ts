const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"; // use v1beta for wider model availability
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_3D_MODEL || "gemini-1.5-flash-latest";

if (!GEMINI_API_KEY) {
  console.warn("⚠️ GEMINI_API_KEY is not set. 3D visualization will use fallback data.");
}

async function callGemini(model: string, prompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Empty response from Gemini API");
  }

  return text as string;
}

function extractJson(text: string) {
  let jsonText = text.trim();

  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/```json\n?/gi, "").replace(/```/g, "").trim();
  }

  return JSON.parse(jsonText);
}

export class Gemini3DService {
  /**
   * Generate 3D molecular structure visualization using Gemini API
   * This uses Gemini to enhance the molecular visualization with AI-powered suggestions
   */
  static async generate3DVisualization(smiles: string, compoundName?: string) {
    try {
      const prompt = `
You are a molecular structure expert. Given this SMILES notation: "${smiles}" ${compoundName ? `for compound "${compoundName}"` : ''}, 
provide detailed 3D coordinate suggestions for optimal molecular visualization.

Return a JSON object with:
1. "atoms": Array of atoms with enhanced 3D positions {element, x, y, z}
2. "bonds": Array of bonds with visual properties {from, to, order, color?, thickness?}
3. "visualHints": Suggestions for rendering (colors, sizes, angles)
4. "molecularInsights": Brief chemical insights about the structure

Focus on:

Return ONLY valid JSON, no markdown formatting.
`;
  const text = await callGemini(GEMINI_MODEL, prompt);
      const parsed = extractJson(text);
      
      return {
        success: true,
        data: parsed,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Gemini 3D generation error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate 3D structure",
        fallback: true
      };
    }
  }

  /**
   * Get AI-enhanced molecular insights
   */
  static async getMolecularInsights(smiles: string, compoundName?: string) {
    try {
      const prompt = `
Analyze this molecular compound:
SMILES: ${smiles}
${compoundName ? `Name: ${compoundName}` : ''}

Provide:
1. Key structural features
2. Functional groups present
3. 3D conformation characteristics
4. Important chemical properties
5. Visualization tips for 3D rendering

Keep it concise and scientific. Return as JSON with keys: features, functionalGroups, conformation, properties, visualizationTips
`;
  const text = await callGemini(GEMINI_MODEL, prompt);
      return extractJson(text);
    } catch (error) {
      console.error("Gemini insights error:", error);
      return null;
    }
  }
}
