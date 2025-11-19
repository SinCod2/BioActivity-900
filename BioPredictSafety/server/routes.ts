import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { MolecularCalculator } from "./services/molecular";
import { MLPredictionService } from "./services/ml-prediction";
import { Gemini3DService } from "./services/gemini-3d";
import { DrugBankService } from "./services/drugbank";
import { PubChemService } from "./services/pubchem";
import { buildDiseaseContext, DEFAULT_DISEASES, formatNumber } from "./services/who-health-data";
import { insertCompoundSchema, insertPredictionSchema, insertBatchJobSchema, insertSearchHistorySchema } from "@shared/schema";

// Helper function to categorize news articles
function categorizArticle(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes("drug discovery") || lowerText.includes("pharmaceutical")) {
    return "Drug Discovery";
  } else if (lowerText.includes("ai") || lowerText.includes("machine learning") || lowerText.includes("artificial intelligence")) {
    return "AI in Chemistry";
  } else if (lowerText.includes("molecular") || lowerText.includes("protein")) {
    return "Molecular Biology";
  } else if (lowerText.includes("toxic") || lowerText.includes("safety")) {
    return "Safety Assessment";
  } else if (lowerText.includes("green") || lowerText.includes("sustainable")) {
    return "Green Chemistry";
  } else if (lowerText.includes("biotech") || lowerText.includes("crispr") || lowerText.includes("gene")) {
    return "Biotechnology";
  } else if (lowerText.includes("clinical") || lowerText.includes("trial")) {
    return "Clinical Research";
  } else {
    return "Chemistry Research";
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // In-memory saved predictions (by compoundId). For demo/development only.
  const savedPredictionIds = new Set<string>();
  
  // Analyze compound endpoint
  app.post("/api/compounds/analyze", async (req, res) => {
    try {
      const { smiles: inputSmiles, name: inputName } = req.body;
      
      // Input can be either SMILES or compound name
      const input = inputSmiles || inputName;
      
      console.log("📥 Analyze request - Input:", input, "InputSMILES:", inputSmiles, "InputName:", inputName);
      
      if (!input || typeof input !== 'string') {
        return res.status(400).json({ 
          message: "Either SMILES notation or compound name is required" 
        });
      }
      
      // Resolve input to SMILES notation
      let resolvedSmiles: string;
      let resolvedName: string;
      
      console.log("🔍 Checking if input is SMILES or compound name...");
      
      try {
        const resolved = await PubChemService.resolveToSmiles(input);
        console.log("✅ PubChem resolved - SMILES:", resolved.smiles, "Name:", resolved.name);
        resolvedSmiles = resolved.smiles;
        resolvedName = resolved.name || inputName || '';
      } catch (pubchemError) {
        console.log("⚠️ PubChem lookup failed:", pubchemError instanceof Error ? pubchemError.message : pubchemError);
        // If PubChem fails, check if input is valid SMILES
        if (!MolecularCalculator.validateSmiles(input)) {
          console.log("❌ Input is not valid SMILES either");
          return res.status(400).json({ 
            message: pubchemError instanceof Error 
              ? pubchemError.message 
              : "Invalid input: not a valid SMILES notation or compound name not found in PubChem database"
          });
        }
        // Input is valid SMILES, use it directly
        console.log("✅ Input is valid SMILES, using directly");
        resolvedSmiles = input;
        resolvedName = inputName || '';
      }
      
      console.log("📝 Final resolved - SMILES:", resolvedSmiles, "Name:", resolvedName);
      // Validate the resolved SMILES
      if (!MolecularCalculator.validateSmiles(resolvedSmiles)) {
        return res.status(400).json({ message: "Invalid SMILES notation" });
      }

      // Generate a name if not provided
      const compoundName = resolvedName || MolecularCalculator.generateCompoundName(resolvedSmiles);

      const structurePromise = PubChemService.getCompoundStructure(resolvedSmiles)
        .catch((structureError) => {
          console.warn("⚠️ PubChem structure fetch failed:", structureError instanceof Error ? structureError.message : structureError);
          return null;
        });
      
      // Check if compound already exists
      let compound = await storage.getCompoundBySmiles(resolvedSmiles);
      if (!compound) {
        // Create new compound with generated or provided name
        const compoundData = insertCompoundSchema.parse({ 
          smiles: resolvedSmiles, 
          name: compoundName 
        });
        compound = await storage.createCompound(compoundData);
      } else {
        // Update compound name if it's different or was empty
        if (compoundName && compound.name !== compoundName) {
          compound = await storage.updateCompound(compound.id, { name: compoundName }) || compound;
        }
      }
      
      // Check if prediction already exists
      let prediction = await storage.getPredictionByCompoundId(compound.id);
      
      if (!prediction) {
        // Calculate descriptors
        const descriptors = MolecularCalculator.calculateDescriptors(resolvedSmiles);
        
        // Predict pIC50
        const { pic50, confidence } = MLPredictionService.predictPIC50(descriptors);
        
        // Assess safety
        const safetyAssessment = MLPredictionService.assessSafety(descriptors);
        
        // Store prediction
        const predictionData = insertPredictionSchema.parse({
          compoundId: compound.id,
          pic50,
          confidence,
          descriptors,
          safetyAssessment,
        });
        
        prediction = await storage.createPrediction(predictionData);
      }
      
      // Calculate Lipinski rules
      const lipinskiRules = MolecularCalculator.checkLipinskiRules(prediction.descriptors as any);

      const structure = await structurePromise;
      
      res.json({
        compound,
        prediction,
        lipinskiRules,
        structure,
      });

      // Log bioactivity prediction in history (best-effort, ignore failures)
      try {
        await storage.createSearchHistory(insertSearchHistorySchema.parse({
          type: 'bioactivity',
          query: compound.name || compound.smiles,
          resultCount: 1,
          details: {
            compoundId: compound.id,
            predictionId: prediction.id,
            pic50: prediction.pic50,
            confidence: prediction.confidence,
            overallRisk: (prediction.safetyAssessment as any)?.overallRisk,
            overallScore: (prediction.safetyAssessment as any)?.overallScore,
          }
        }));
      } catch (e) {
        console.warn('History logging failed (bioactivity):', e);
      }
      
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze compound" });
    }
  });
  
  // Search medicines via DrugBank
  app.get("/api/medicines/search", async (req, res) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : "";

      if (!query.trim()) {
        return res.json({ results: [] });
      }

      const results = await DrugBankService.searchByName(query.trim());
      res.json({ results });

      // Log medicine search only if results were found (best-effort)
      try {
        if (query.trim() && results.length > 0) {
          await storage.createSearchHistory(insertSearchHistorySchema.parse({
            type: 'medicine',
            query: query.trim(),
            resultCount: results.length,
            details: { sample: results.slice(0, 3).map(r => ({ id: r.drugbankId, name: r.name })) }
          }));
        }
      } catch (e) {
        console.warn('History logging failed (medicine search):', e);
      }
    } catch (error) {
      console.error("Medicine search error:", error);
      res.status(500).json({ message: "Failed to fetch medicine search results" });
    }
  });

  // Retrieve detailed medicine information by DrugBank ID
  app.get("/api/medicines/:drugbankId", async (req, res) => {
    try {
      const { drugbankId } = req.params;
      const details = await DrugBankService.getDrugDetails(drugbankId);

      if (!details) {
        return res.status(404).json({ message: "Medicine not found" });
      }

      res.json({ details });
    } catch (error) {
      console.error("Medicine details error:", error);
      res.status(500).json({ message: "Failed to fetch medicine details" });
    }
  });
  
  // Get recent compounds
  app.get("/api/compounds/recent", async (req, res) => {
    try {
      const compounds = await storage.getAllCompounds();
      const recentCompounds = compounds.slice(0, 10); // Get last 10
      
      // Get predictions for these compounds
      const predictions = await storage.getPredictionsByCompoundIds(
        recentCompounds.map(c => c.id)
      );
      
      const compoundsWithPredictions = recentCompounds.map(compound => ({
        ...compound,
        prediction: predictions.find(p => p.compoundId === compound.id),
      }));
      
      res.json(compoundsWithPredictions);
    } catch (error) {
      console.error("Error fetching recent compounds:", error);
      res.status(500).json({ message: "Failed to fetch recent compounds" });
    }
  });
  
  // Get compound by ID
  app.get("/api/compounds/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const compound = await storage.getCompound(id);
      
      if (!compound) {
        return res.status(404).json({ message: "Compound not found" });
      }
      
      const prediction = await storage.getPredictionByCompoundId(id);
      const lipinskiRules = prediction ? 
        MolecularCalculator.checkLipinskiRules(prediction.descriptors as any) : null;
      
      res.json({
        compound,
        prediction,
        lipinskiRules,
      });
    } catch (error) {
      console.error("Error fetching compound:", error);
      res.status(500).json({ message: "Failed to fetch compound" });
    }
  });
  
  // Batch processing endpoint
  app.post("/api/batch/process", async (req, res) => {
    try {
      const { compounds } = req.body;
      
      if (!Array.isArray(compounds) || compounds.length === 0) {
        return res.status(400).json({ message: "Compounds array is required" });
      }
      
      // Create batch job
      const batchJobData = insertBatchJobSchema.parse({
        status: 'processing',
        totalCompounds: compounds.length,
        processedCompounds: 0,
        results: [],
      });
      
      const batchJob = await storage.createBatchJob(batchJobData);
      
      // Process compounds asynchronously
      setImmediate(async () => {
        const results = [];
        
        for (let i = 0; i < compounds.length; i++) {
          try {
            const { smiles, name } = compounds[i];
            
            if (!MolecularCalculator.validateSmiles(smiles)) {
              results.push({ error: "Invalid SMILES", smiles, name });
              continue;
            }
            
            // Get or create compound
            let compound = await storage.getCompoundBySmiles(smiles);
            if (!compound) {
              compound = await storage.createCompound({ smiles, name });
            }
            
            // Get or create prediction
            let prediction = await storage.getPredictionByCompoundId(compound.id);
            if (!prediction) {
              const descriptors = MolecularCalculator.calculateDescriptors(smiles);
              const { pic50, confidence } = MLPredictionService.predictPIC50(descriptors);
              const safetyAssessment = MLPredictionService.assessSafety(descriptors);
              
              prediction = await storage.createPrediction({
                compoundId: compound.id,
                pic50,
                confidence,
                descriptors,
                safetyAssessment,
              });
            }
            
            const lipinskiRules = MolecularCalculator.checkLipinskiRules(prediction.descriptors as any);
            
            results.push({
              compound,
              prediction,
              lipinskiRules,
            });
            
          } catch (error) {
            results.push({ 
              error: error instanceof Error ? error.message : "Processing error", 
              smiles: compounds[i]?.smiles 
            });
          }
          
          // Update progress
          await storage.updateBatchJob(batchJob.id, {
            processedCompounds: i + 1,
          });
        }
        
        // Mark batch as completed
        await storage.updateBatchJob(batchJob.id, {
          status: 'completed',
          results,
          completedAt: new Date(),
        });
      });
      
      res.json({ batchJobId: batchJob.id });
      
    } catch (error) {
      console.error("Batch processing error:", error);
      res.status(500).json({ message: "Failed to start batch processing" });
    }
  });
  
  // Get batch job status
  app.get("/api/batch/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const batchJob = await storage.getBatchJob(id);
      
      if (!batchJob) {
        return res.status(404).json({ message: "Batch job not found" });
      }
      
      res.json(batchJob);
    } catch (error) {
      console.error("Error fetching batch job:", error);
      res.status(500).json({ message: "Failed to fetch batch job" });
    }
  });
  
  // Export results endpoint
  app.post("/api/export", async (req, res) => {
    try {
      const { format, compoundIds } = req.body;
      
      if (!compoundIds || !Array.isArray(compoundIds)) {
        return res.status(400).json({ message: "Compound IDs are required" });
      }
      
      const compounds = await Promise.all(
        compoundIds.map(id => storage.getCompound(id))
      );
      
      const predictions = await storage.getPredictionsByCompoundIds(compoundIds);
      
      const data = compounds.map(compound => {
        if (!compound) return null;
        const prediction = predictions.find(p => p.compoundId === compound.id);
        return { compound, prediction };
      }).filter(Boolean);
      
      if (format === 'csv') {
        // Generate CSV
        const headers = [
          'SMILES', 'Name', 'pIC50', 'Confidence', 'LogP', 'MW', 'TPSA', 
          'Rotatable Bonds', 'HBD', 'HBA', 'Safety Risk', 'Safety Score'
        ];
        
        const rows = data.map(item => [
          item!.compound.smiles,
          item!.compound.name || '',
          item!.prediction?.pic50 || '',
          item!.prediction?.confidence || '',
          (item!.prediction?.descriptors as any)?.logP || '',
          (item!.prediction?.descriptors as any)?.molecularWeight || '',
          (item!.prediction?.descriptors as any)?.tpsa || '',
          (item!.prediction?.descriptors as any)?.rotatableBonds || '',
          (item!.prediction?.descriptors as any)?.hbdCount || '',
          (item!.prediction?.descriptors as any)?.hbaCount || '',
          (item!.prediction?.safetyAssessment as any)?.overallRisk || '',
          (item!.prediction?.safetyAssessment as any)?.overallScore || '',
        ]);
        
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="predictions.csv"');
        res.send(csv);
        
      } else if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="predictions.json"');
        res.json(data);
        
      } else {
        res.status(400).json({ message: "Unsupported format" });
      }
      
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Search history endpoints
  app.post('/api/history', async (req, res) => {
    try {
      const { type, query, resultCount, details } = req.body || {};
      if (!type || !query) {
        return res.status(400).json({ message: 'type and query are required' });
      }
      if (!['medicine', 'bioactivity'].includes(type)) {
        return res.status(400).json({ message: 'invalid type' });
      }
      const entry = await storage.createSearchHistory(insertSearchHistorySchema.parse({
        type,
        query,
        resultCount: typeof resultCount === 'number' ? resultCount : 0,
        details: details || null,
      }));
      res.json(entry);
    } catch (e) {
      console.error('History create error', e);
      res.status(500).json({ message: 'Failed to create history entry' });
    }
  });

  app.get('/api/history', async (req, res) => {
    try {
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const items = await storage.getSearchHistory(type);
      res.json({ items });
    } catch (e) {
      console.error('History fetch error', e);
      res.status(500).json({ message: 'Failed to fetch history' });
    }
  });

  app.delete('/api/history', async (req, res) => {
    try {
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      await storage.clearSearchHistory(type);
      res.json({ ok: true, cleared: type || 'all' });
    } catch (e) {
      console.error('History clear error', e);
      res.status(500).json({ message: 'Failed to clear history' });
    }
  });

  // Save prediction
  app.post("/api/predictions/save", async (req, res) => {
    try {
      const { compoundId } = req.body as { compoundId?: string };
      if (!compoundId) return res.status(400).json({ message: "compoundId is required" });

      const compound = await storage.getCompound(compoundId);
      const prediction = await storage.getPredictionByCompoundId(compoundId);
      if (!compound || !prediction) return res.status(404).json({ message: "Prediction not found for compound" });

      savedPredictionIds.add(compoundId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Save prediction error:", error);
      res.status(500).json({ message: "Failed to save prediction" });
    }
  });

  // Unsave prediction
  app.delete("/api/predictions/save/:compoundId", async (req, res) => {
    try {
      const { compoundId } = req.params;
      savedPredictionIds.delete(compoundId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Unsave prediction error:", error);
      res.status(500).json({ message: "Failed to unsave prediction" });
    }
  });

  // List saved predictions (latest first up to 20)
  app.get("/api/predictions/saved", async (_req, res) => {
    try {
      const ids = Array.from(savedPredictionIds);
      const compounds = await Promise.all(ids.map(id => storage.getCompound(id)));
      const predictions = await storage.getPredictionsByCompoundIds(ids);
      const items = compounds
        .map((compound) => compound && ({
          ...compound,
          prediction: predictions.find(p => p.compoundId === compound.id)
        }))
        .filter(Boolean)
        .slice(0, 20);
      res.json(items);
    } catch (error) {
      console.error("List saved predictions error:", error);
      res.status(500).json({ message: "Failed to fetch saved predictions" });
    }
  });

  // Generate 3D structure using Gemini AI
  app.post("/api/gemini/generate-3d", async (req, res) => {
    try {
      const { smiles, name } = req.body;

      if (!smiles || typeof smiles !== 'string') {
        return res.status(400).json({ message: "SMILES notation is required" });
      }

      const result = await Gemini3DService.generate3DVisualization(smiles, name);
      
      if (!result.success) {
        return res.status(500).json({ 
          message: result.error || "Failed to generate 3D structure",
          fallback: result.fallback 
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Gemini 3D generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate 3D structure",
        fallback: true 
      });
    }
  });

  // Get molecular insights using Gemini AI
  app.post("/api/gemini/insights", async (req, res) => {
    try {
      const { smiles, name } = req.body;

      if (!smiles || typeof smiles !== 'string') {
        return res.status(400).json({ message: "SMILES notation is required" });
      }

      const insights = await Gemini3DService.getMolecularInsights(smiles, name);
      
      if (!insights) {
        return res.status(500).json({ message: "Failed to get molecular insights" });
      }

      res.json(insights);
    } catch (error) {
      console.error("Gemini insights error:", error);
      res.status(500).json({ message: "Failed to get molecular insights" });
    }
  });

  // Safety disease burden context (WHO) - enrich safety assessment
  app.get('/api/safety/disease-context', async (req, res) => {
    try {
      const keysParam = typeof req.query.keys === 'string' ? req.query.keys : '';
      const keys = keysParam ? keysParam.split(',').map(k=>k.trim()).filter(Boolean) : DEFAULT_DISEASES;
      const summaries = await buildDiseaseContext(keys);
      const enriched = summaries.map(s => ({
        key: s.diseaseKey,
        name: s.diseaseName,
        mortality: formatNumber(s.mortality),
        incidence: formatNumber(s.incidence),
        prevalence: formatNumber(s.prevalence),
        needScore: s.needScore,
        yearRange: s.yearRange,
        topCountries: s.topCountries.slice(0,5).map(c => c.country),
        notes: s.notes
      }));
      res.json({ diseases: enriched });
    } catch (e) {
      console.error('WHO context error', e);
      res.status(500).json({ message: 'Failed to build WHO safety disease context' });
    }
  });

  console.log("✓ All routes registered");
  
  const httpServer = createServer(app);
  return httpServer;
}
