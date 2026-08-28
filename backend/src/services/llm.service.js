import { GoogleGenAI } from "@google/genai";
import { config } from "../config/env.js";
import { ALERTIQ_SYSTEM_INSTRUCTION } from "../utils/prompts.js";
import {
  STRUCTURED_ANALYSIS_SYSTEM_INSTRUCTION,
  DEFAULT_ANALYSIS_PROMPT,
  parseAnalysisResponse,
  validateAndNormalizeAnalysis
} from "../utils/analysis.utils.js";
import { estimateLlmCost } from "./cost.service.js";
import { trimMessageHistory, formatConversationContents } from "../utils/conversation.utils.js";
import { buildAlertContext } from "../utils/alert.utils.js";

/**
 * Shared execution helper for invoking Google Gemini API with retries for transient spikes,
 * token accounting, and cost estimation.
 *
 * @param {Object} params
 * @param {Array} params.contents - Formatted conversation contents array.
 * @param {string} params.systemInstruction - System instruction to enforce.
 * @param {string} [params.responseMimeType] - Optional response MIME type (e.g., "application/json").
 * @returns {Promise<{
 *   text: string,
 *   usage: { inputTokens: number, outputTokens: number, totalTokens: number, thoughtsTokens?: number },
 *   estimatedCost: Object
 * }>}
 */
const executeGeminiCall = async ({ contents, systemInstruction, responseMimeType }) => {
  if (!config.geminiApiKey || config.geminiApiKey.trim() === "" || config.geminiApiKey === "your_gemini_api_key_here") {
    const error = new Error("Gemini API key is missing or not configured in server environment (.env).");
    error.statusCode = 500;
    throw error;
  }

  const ai = new GoogleGenAI({
    apiKey: config.geminiApiKey
  });

  const requestConfig = {
    systemInstruction,
    ...(responseMimeType && { responseMimeType })
  };

  // Execute LLM generation with automatic retry for transient spikes (503/429)
  let response;
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: config.geminiModel,
        contents,
        config: requestConfig
      });
      break;
    } catch (err) {
      const errStr = (err?.message || "").toLowerCase();
      const isTransient =
        errStr.includes("503") ||
        errStr.includes("high demand") ||
        errStr.includes("429") ||
        errStr.includes("resource_exhausted") ||
        errStr.includes("unavailable");

      if (isTransient && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }
      throw err;
    }
  }

  const text = response?.text || "";

  // Extract usage metadata provided by @google/genai SDK
  const usageMetadata = response?.usageMetadata || {};
  const inputTokens = typeof usageMetadata.promptTokenCount === "number" ? usageMetadata.promptTokenCount : 0;
  const outputTokens = typeof usageMetadata.candidatesTokenCount === "number" ? usageMetadata.candidatesTokenCount : 0;
  const thoughtsTokens = typeof usageMetadata.thoughtsTokenCount === "number" ? usageMetadata.thoughtsTokenCount : 0;
  const totalTokens =
    typeof usageMetadata.totalTokenCount === "number"
      ? usageMetadata.totalTokenCount
      : inputTokens + outputTokens + thoughtsTokens;

  const usage = {
    inputTokens,
    outputTokens,
    totalTokens,
    ...(thoughtsTokens > 0 && { thoughtsTokens })
  };

  // Calculate estimated cost using dedicated cost estimation service
  const estimatedCost = estimateLlmCost(usage, config.geminiModel);

  return {
    text,
    usage,
    estimatedCost
  };
};

/**
 * Generate a free-form completion from Google Gemini API with system instruction separation,
 * conversation history support, structured alert context, token accounting, and cost estimation.
 * Used by POST /api/llm/test.
 *
 * @param {string} prompt - The current user prompt to send to Gemini.
 * @param {Array<{ role: string, content: string }>} [messages=[]] - Optional prior conversation messages.
 * @param {Object|null} [alert=null] - Optional validated structured alert object.
 * @returns {Promise<{
 *   success: boolean,
 *   response: string,
 *   alertContextUsed: boolean,
 *   conversation: { historyMessagesReceived: number, historyMessagesUsed: number, historyTrimmed: boolean },
 *   model: string,
 *   usage: { inputTokens: number, outputTokens: number, totalTokens: number, thoughtsTokens?: number },
 *   estimatedCost: Object
 * }>}
 */
export const generateCompletion = async (prompt, messages = [], alert = null) => {
  // Manage conversation history and trimming
  const {
    messages: activeHistory,
    historyMessagesReceived,
    historyMessagesUsed,
    historyTrimmed
  } = trimMessageHistory(messages, config.maxHistoryMessages);

  // Build formatted security alert context if alert is provided
  const alertContext = alert ? buildAlertContext(alert) : "";

  // Format structured contents for Gemini API (retaining separate system instruction)
  const contents = formatConversationContents(activeHistory, prompt, alertContext);

  const { text, usage, estimatedCost } = await executeGeminiCall({
    contents,
    systemInstruction: ALERTIQ_SYSTEM_INSTRUCTION
  });

  return {
    success: true,
    response: text,
    alertContextUsed: Boolean(alertContext),
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

/**
 * Generate a structured security analysis for a security alert from Google Gemini API.
 * Returns a validated and normalized analysis object with summary, risk assessment, key indicators,
 * investigation steps, recommended actions, assumptions, and limitations.
 * Used by POST /api/llm/analyze.
 *
 * @param {Object} alert - Pre-validated structured alert object.
 * @param {string|null} [prompt=null] - Optional additional investigation question or focus area.
 * @param {Array<{ role: string, content: string }>} [messages=[]] - Optional prior conversation messages.
 * @returns {Promise<{
 *   success: boolean,
 *   analysis: Object,
 *   conversation: { historyMessagesReceived: number, historyMessagesUsed: number, historyTrimmed: boolean },
 *   model: string,
 *   usage: { inputTokens: number, outputTokens: number, totalTokens: number, thoughtsTokens?: number },
 *   estimatedCost: Object
 * }>}
 */
export const generateAlertAnalysis = async (alert, prompt = null, messages = []) => {
  // Determine effective user investigation prompt
  const activePrompt =
    typeof prompt === "string" && prompt.trim() !== ""
      ? prompt.trim()
      : DEFAULT_ANALYSIS_PROMPT;

  // Manage conversation history and trimming
  const {
    messages: activeHistory,
    historyMessagesReceived,
    historyMessagesUsed,
    historyTrimmed
  } = trimMessageHistory(messages, config.maxHistoryMessages);

  // Build formatted security alert context (placed in user turn)
  const alertContext = buildAlertContext(alert);

  // Format conversation contents for Gemini API
  const contents = formatConversationContents(activeHistory, activePrompt, alertContext);

  // Request structured JSON output from Gemini
  const { text, usage, estimatedCost } = await executeGeminiCall({
    contents,
    systemInstruction: STRUCTURED_ANALYSIS_SYSTEM_INSTRUCTION,
    responseMimeType: "application/json"
  });

  // Parse raw response JSON
  const parsedJson = parseAnalysisResponse(text);

  // Validate and normalize schema
  const validatedAnalysis = validateAndNormalizeAnalysis(parsedJson);

  return {
    success: true,
    analysis: validatedAnalysis,
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
