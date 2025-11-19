import { type Compound, type InsertCompound, type Prediction, type InsertPrediction, type BatchJob, type InsertBatchJob, type SearchHistory, type InsertSearchHistory, compounds, predictions, batchJobs, searchHistory } from "@shared/schema";
import { randomUUID } from "crypto";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, inArray } from 'drizzle-orm';

export interface IStorage {
  // Compounds
  getCompound(id: string): Promise<Compound | undefined>;
  getCompoundBySmiles(smiles: string): Promise<Compound | undefined>;
  createCompound(compound: InsertCompound): Promise<Compound>;
  updateCompound(id: string, updates: Partial<Compound>): Promise<Compound | undefined>;
  getAllCompounds(): Promise<Compound[]>;
  
  // Predictions
  getPrediction(id: string): Promise<Prediction | undefined>;
  getPredictionByCompoundId(compoundId: string): Promise<Prediction | undefined>;
  createPrediction(prediction: InsertPrediction): Promise<Prediction>;
  getPredictionsByCompoundIds(compoundIds: string[]): Promise<Prediction[]>;
  
  // Batch Jobs
  getBatchJob(id: string): Promise<BatchJob | undefined>;
  createBatchJob(batchJob: InsertBatchJob): Promise<BatchJob>;
  updateBatchJob(id: string, updates: Partial<BatchJob>): Promise<BatchJob | undefined>;
  getAllBatchJobs(): Promise<BatchJob[]>;

  // Search History
  createSearchHistory(entry: InsertSearchHistory): Promise<SearchHistory>;
  getSearchHistory(type?: string): Promise<SearchHistory[]>;
  clearSearchHistory(type?: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private compounds: Map<string, Compound>;
  private predictions: Map<string, Prediction>;
  private batchJobs: Map<string, BatchJob>;
  private history: Map<string, SearchHistory>;

  constructor() {
    this.compounds = new Map();
    this.predictions = new Map();
    this.batchJobs = new Map();
    this.history = new Map();
  }

  // Compounds
  async getCompound(id: string): Promise<Compound | undefined> {
    return this.compounds.get(id);
  }

  async getCompoundBySmiles(smiles: string): Promise<Compound | undefined> {
    return Array.from(this.compounds.values()).find(
      (compound) => compound.smiles === smiles,
    );
  }

  async createCompound(insertCompound: InsertCompound): Promise<Compound> {
    const id = randomUUID();
    const compound: Compound = { 
      ...insertCompound,
      name: insertCompound.name || null,
      id, 
      createdAt: new Date() 
    };
    this.compounds.set(id, compound);
    return compound;
  }

  async updateCompound(id: string, updates: Partial<Compound>): Promise<Compound | undefined> {
    const existing = this.compounds.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.compounds.set(id, updated);
    return updated;
  }

  async getAllCompounds(): Promise<Compound[]> {
    return Array.from(this.compounds.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  // Predictions
  async getPrediction(id: string): Promise<Prediction | undefined> {
    return this.predictions.get(id);
  }

  async getPredictionByCompoundId(compoundId: string): Promise<Prediction | undefined> {
    return Array.from(this.predictions.values()).find(
      (prediction) => prediction.compoundId === compoundId,
    );
  }

  async createPrediction(insertPrediction: InsertPrediction): Promise<Prediction> {
    const id = randomUUID();
    const prediction: Prediction = { 
      ...insertPrediction, 
      id, 
      createdAt: new Date() 
    };
    this.predictions.set(id, prediction);
    return prediction;
  }

  async getPredictionsByCompoundIds(compoundIds: string[]): Promise<Prediction[]> {
    return Array.from(this.predictions.values()).filter(
      (prediction) => compoundIds.includes(prediction.compoundId),
    );
  }

  // Batch Jobs
  async getBatchJob(id: string): Promise<BatchJob | undefined> {
    return this.batchJobs.get(id);
  }

  async createBatchJob(insertBatchJob: InsertBatchJob): Promise<BatchJob> {
    const id = randomUUID();
    const batchJob: BatchJob = { 
      ...insertBatchJob, 
      id, 
      createdAt: new Date(),
      completedAt: null
    };
    this.batchJobs.set(id, batchJob);
    return batchJob;
  }

  async updateBatchJob(id: string, updates: Partial<BatchJob>): Promise<BatchJob | undefined> {
    const existing = this.batchJobs.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.batchJobs.set(id, updated);
    return updated;
  }

  async getAllBatchJobs(): Promise<BatchJob[]> {
    return Array.from(this.batchJobs.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  // History
  async createSearchHistory(entry: InsertSearchHistory): Promise<SearchHistory> {
    const id = randomUUID();
    const record: SearchHistory = {
      ...entry,
      id,
      createdAt: new Date()
    };
    this.history.set(id, record);
    return record;
  }

  async getSearchHistory(type?: string): Promise<SearchHistory[]> {
    let items = Array.from(this.history.values());
    if (type) items = items.filter(h => h.type === type);
    return items.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, 100);
  }

  async clearSearchHistory(type?: string): Promise<void> {
    if (type) {
      for (const [id, item] of this.history.entries()) {
        if (item.type === type) this.history.delete(id);
      }
    } else {
      this.history.clear();
    }
  }
}

export class DbStorage implements IStorage {
  private db;
  
  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required for DbStorage");
    }
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
  }
  // Compounds
  async getCompound(id: string): Promise<Compound | undefined> {
    const result = await this.db.select().from(compounds).where(eq(compounds.id, id)).limit(1);
    return result[0];
  }

  async getCompoundBySmiles(smiles: string): Promise<Compound | undefined> {
    const result = await this.db.select().from(compounds).where(eq(compounds.smiles, smiles)).limit(1);
    return result[0];
  }

  async createCompound(insertCompound: InsertCompound): Promise<Compound> {
    const result = await this.db.insert(compounds).values(insertCompound).returning();
    return result[0];
  }

  async updateCompound(id: string, updates: Partial<Compound>): Promise<Compound | undefined> {
    const result = await this.db.update(compounds).set(updates).where(eq(compounds.id, id)).returning();
    return result[0];
  }

  async getAllCompounds(): Promise<Compound[]> {
    return await this.db.select().from(compounds).orderBy(desc(compounds.createdAt)).limit(100);
  }

  // Predictions
  async getPrediction(id: string): Promise<Prediction | undefined> {
    const result = await this.db.select().from(predictions).where(eq(predictions.id, id)).limit(1);
    return result[0];
  }

  async getPredictionByCompoundId(compoundId: string): Promise<Prediction | undefined> {
    const result = await this.db.select().from(predictions).where(eq(predictions.compoundId, compoundId)).limit(1);
    return result[0];
  }

  async createPrediction(insertPrediction: InsertPrediction): Promise<Prediction> {
    const result = await this.db.insert(predictions).values(insertPrediction).returning();
    return result[0];
  }

  async getPredictionsByCompoundIds(compoundIds: string[]): Promise<Prediction[]> {
    if (compoundIds.length === 0) return [];
    return await this.db.select().from(predictions).where(
      inArray(predictions.compoundId, compoundIds)
    );
  }

  // Batch Jobs
  async getBatchJob(id: string): Promise<BatchJob | undefined> {
    const result = await this.db.select().from(batchJobs).where(eq(batchJobs.id, id)).limit(1);
    return result[0];
  }

  async createBatchJob(insertBatchJob: InsertBatchJob): Promise<BatchJob> {
    const result = await this.db.insert(batchJobs).values(insertBatchJob).returning();
    return result[0];
  }

  async updateBatchJob(id: string, updates: Partial<BatchJob>): Promise<BatchJob | undefined> {
    const result = await this.db.update(batchJobs).set(updates).where(eq(batchJobs.id, id)).returning();
    return result[0];
  }

  async getAllBatchJobs(): Promise<BatchJob[]> {
    return await this.db.select().from(batchJobs).orderBy(desc(batchJobs.createdAt)).limit(50);
  }

  // History
  async createSearchHistory(entry: InsertSearchHistory): Promise<SearchHistory> {
    const result = await this.db.insert(searchHistory).values(entry).returning();
    return result[0];
  }

  async getSearchHistory(type?: string): Promise<SearchHistory[]> {
    if (type) {
      return await this.db.select().from(searchHistory).where(eq(searchHistory.type, type)).orderBy(desc(searchHistory.createdAt)).limit(100);
    }
    return await this.db.select().from(searchHistory).orderBy(desc(searchHistory.createdAt)).limit(100);
  }

  async clearSearchHistory(type?: string): Promise<void> {
    if (type) {
      await this.db.delete(searchHistory).where(eq(searchHistory.type, type));
    } else {
      await this.db.delete(searchHistory);
    }
  }
}

// Use memory storage for development (no database required)
export const storage = new MemStorage();
