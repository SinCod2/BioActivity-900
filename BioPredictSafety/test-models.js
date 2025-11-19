import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyDAKPXaST8WIo2P-qAVo6p_pnaoPUkAbP4");

async function listModels() {
  try {
    console.log("Fetching available models...\n");
    
    const models = await genAI.listModels();
    
    console.log("Available Models:");
    console.log("=================\n");
    
    for (const model of models) {
      console.log(`Model: ${model.name}`);
      console.log(`Display Name: ${model.displayName}`);
      console.log(`Description: ${model.description}`);
      console.log(`Supported Methods: ${model.supportedGenerationMethods?.join(", ")}`);
      console.log("---");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
