import { GoogleGenAI } from "@google/genai";
import { config } from "../config/env.js";
import { ALERTIQ_SYSTEM_INSTRUCTION } from "../utils/prompts.js";

/**
 * Generate a completion from Google Gemini API with system and user prompt separation.
 * @param {string} prompt - The user prompt to send to Gemini.
 * @returns {Promise<{success: boolean, response: string, model: string}>}
 */
export const generateCompletion = async (prompt) => {
  if (!config.geminiApiKey || config.geminiApiKey.trim() === "" || config.geminiApiKey === "your_gemini_api_key_here") {
    const error = new Error("Gemini API key is missing or not configured in server environment (.env).");
    error.statusCode = 500;
    throw error;
  }

  const ai = new GoogleGenAI({
    apiKey: config.geminiApiKey
  });

  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: {
      systemInstruction: ALERTIQ_SYSTEM_INSTRUCTION
    }
  });

  const content = response.text || "";

  return {
    success: true,
    response: content,
    model: config.geminiModel
  };
};

