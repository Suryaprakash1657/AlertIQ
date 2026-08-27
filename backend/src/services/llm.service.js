import { GoogleGenAI } from "@google/genai";
import { config } from "../config/env.js";
import { ALERTIQ_SYSTEM_INSTRUCTION } from "../utils/prompts.js";
import { estimateLlmCost } from "./cost.service.js";
import { trimMessageHistory, formatConversationContents } from "../utils/conversation.utils.js";

/**
 * Generate a completion from Google Gemini API with system instruction separation,
 * conversation history support, token accounting, and cost estimation.
 *
 * @param {string} prompt - The current user prompt to send to Gemini.
 * @param {Array<{ role: string, content: string }>} [messages=[]] - Optional prior conversation messages.
 * @returns {Promise<{
 *   success: boolean,
 *   response: string,
 *   conversation: { historyMessagesReceived: number, historyMessagesUsed: number, historyTrimmed: boolean },
 *   model: string,
 *   usage: { inputTokens: number, outputTokens: number, totalTokens: number, thoughtsTokens?: number },
 *   estimatedCost: Object
 * }>}
 */
export const generateCompletion = async (prompt, messages = []) => {
  if (!config.geminiApiKey || config.geminiApiKey.trim() === "" || config.geminiApiKey === "your_gemini_api_key_here") {
    const error = new Error("Gemini API key is missing or not configured in server environment (.env).");
    error.statusCode = 500;
    throw error;
  }

  // Manage conversation history and trimming
  const {
    messages: activeHistory,
    historyMessagesReceived,
    historyMessagesUsed,
    historyTrimmed
  } = trimMessageHistory(messages, config.maxHistoryMessages);

  // Format structured contents for Gemini API (retaining separate system instruction)
  const contents = formatConversationContents(activeHistory, prompt);

  const ai = new GoogleGenAI({
    apiKey: config.geminiApiKey
  });

  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents,
    config: {
      systemInstruction: ALERTIQ_SYSTEM_INSTRUCTION
    }
  });

  const content = response.text || "";

  // Extract usage metadata provided by @google/genai SDK
  const usageMetadata = response.usageMetadata || {};
  const inputTokens = typeof usageMetadata.promptTokenCount === "number" ? usageMetadata.promptTokenCount : 0;
  const outputTokens = typeof usageMetadata.candidatesTokenCount === "number" ? usageMetadata.candidatesTokenCount : 0;
  const thoughtsTokens = typeof usageMetadata.thoughtsTokenCount === "number" ? usageMetadata.thoughtsTokenCount : 0;
  const totalTokens = typeof usageMetadata.totalTokenCount === "number"
    ? usageMetadata.totalTokenCount
    : (inputTokens + outputTokens + thoughtsTokens);

  const usage = {
    inputTokens,
    outputTokens,
    totalTokens,
    ...(thoughtsTokens > 0 && { thoughtsTokens })
  };

  // Calculate estimated cost using dedicated cost estimation service
  const estimatedCost = estimateLlmCost(usage, config.geminiModel);

  return {
    success: true,
    response: content,
    conversation: {
      historyMessagesReceived,
      historyMessagesUsed,
      historyTrimmed
    },
    model: config.geminiModel,
    usage,
    estimatedCost
  };
};
