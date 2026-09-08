/**
 * Alert Analysis Orchestration Service for AlertIQ (Module 3.23)
 *
 * Orchestrates the full production pipeline:
 * 1. Alert validation (Module 3.16)
 * 2. Alert context formatting (Module 3.16)
 * 3. Retrieval query construction & semantic search over Module 3.22 threat corpus (Module 3.20)
 * 4. 5-state retrieval handling & graceful degradation (Module 3.21)
 * 5. Bounded RAG context assembly (Module 3.20)
 * 6. Structured Gemini analysis generation (Module 3.17)
 * 7. Response parsing and schema validation (Module 3.17)
 */

import { GoogleGenAI } from "@google/genai";
import { config } from "../config/env.js";
import { validateAlert, buildAlertContext } from "../utils/alert.utils.js";
import {
  STRUCTURED_ANALYSIS_SYSTEM_INSTRUCTION,
  DEFAULT_ANALYSIS_PROMPT,
  parseAnalysisResponse,
  validateAndNormalizeAnalysis
} from "../utils/analysis.utils.js";
import { constructRetrievalQueryFromAlert, buildRagContext } from "../utils/rag.utils.js";
import { retrieveKnowledge } from "./retrieval.service.js";
import { knowledgeRepository } from "../repositories/knowledge.repository.js";
import { sanitizeErrorMessage } from "./embedding.service.js";
import { trimMessageHistory, formatConversationContents, validateMessages } from "../utils/conversation.utils.js";
import { estimateLlmCost } from "./cost.service.js";

// Optional execution hook for deterministic unit testing without external API calls
let customLlmExecutor = null;

export const setLlmExecutionOverride = (executor) => {
  customLlmExecutor = executor;
};

export const resetLlmExecutionOverride = () => {
  customLlmExecutor = null;
};

/**
 * Executes the structured Gemini analysis call with retries for transient provider errors.
 *
 * @param {Object} params
 * @param {Array} params.contents - Formatted conversation contents.
 * @param {Object} [params.options] - Service options (including mock overrides).
 * @returns {Promise<{
 *   text: string,
 *   usage: { inputTokens: number, outputTokens: number, totalTokens: number, thoughtsTokens?: number },
 *   estimatedCost: Object
 * }>}
 */
const executeStructuredLlmCall = async ({ contents, options = {} }) => {
  // 1. Check for testing execution override
  const executor = options.llmExecutorOverride || customLlmExecutor;
  if (typeof executor === "function") {
    return executor(contents, {
      systemInstruction: STRUCTURED_ANALYSIS_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      ...options
    });
  }

  // 2. Validate Gemini API Key configuration
  if (!config.geminiApiKey || config.geminiApiKey.trim() === "" || config.geminiApiKey === "your_gemini_api_key_here") {
    const error = new Error("Gemini API key is missing or not configured in server environment (.env).");
    error.statusCode = 500;
    throw error;
  }

  const ai = new GoogleGenAI({
    apiKey: config.geminiApiKey
  });

  const requestConfig = {
    systemInstruction: STRUCTURED_ANALYSIS_SYSTEM_INSTRUCTION,
    responseMimeType: "application/json"
  };

    let response;
  const maxRetries = 4;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: config.geminiModel,
        contents,
        config: requestConfig
      });
      break;
    } catch (err) {
      const rawMessage = err?.message || "";
      const errStr = rawMessage.toLowerCase();
      const isTransient =
        errStr.includes("503") ||
        errStr.includes("high demand") ||
        errStr.includes("429") ||
        errStr.includes("resource_exhausted") ||
        errStr.includes("unavailable");

      if (isTransient && attempt < maxRetries) {
        // Check for recommended retry delay from Gemini response
        const delayMatch = rawMessage.match(/retry in ([0-9.]+)s/i);
        const waitTime = delayMatch
          ? Math.min(60000, Math.ceil(parseFloat(delayMatch[1]) * 1000) + 2000)
          : attempt * 2000;

        console.log(`[Alert Analysis] Transient rate-limit (attempt ${attempt}/${maxRetries}), waiting ${Math.round(waitTime / 1000)}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      const sanitized = sanitizeErrorMessage(rawMessage || "LLM generation failed.");
      const providerError = new Error(`LLM provider error: ${sanitized}`);
      providerError.statusCode = err?.status || err?.statusCode || 502;
      throw providerError;
    }
  }

  const text = response?.text || "";
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

  const estimatedCost = estimateLlmCost(usage, config.geminiModel);

  return {
    text,
    usage,
    estimatedCost
  };
};

/**
 * Orchestrates the full production alert analysis pipeline for AlertIQ.
 *
 * @param {Object} payload - Ingestion payload containing alert, optional prompt, messages, and options.
 * @param {Object} [options={}] - Additional runtime overrides.
 * @returns {Promise<{
 *   success: boolean,
 *   analysis: Object,
 *   knowledgeContext: {
 *     status: "success"|"no_match"|"empty_kb"|"failed"|"disabled",
 *     query?: string,
 *     topK?: number,
 *     similarityThreshold?: number,
 *     matchesFound: number,
 *     sourcesUsed: Array<{
 *       documentId: string,
 *       title: string,
 *       source: string,
 *       category: string,
 *       similarity: number
 *     }>,
 *     error?: string
 *   },
 *   conversation: { historyMessagesReceived: number, historyMessagesUsed: number, historyTrimmed: boolean },
 *   model: string,
 *   usage: Object,
 *   estimatedCost: Object
 * }>}
 */
export const analyzeAlertPipeline = async (payload = {}, options = {}) => {
  // 1. Validate payload presence
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Invalid request payload: Request body must be a valid JSON object.");
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate structured alert object (strictly required)
  if (payload.alert === undefined || payload.alert === null) {
    const error = new Error("Invalid request: 'alert' is required for structured analysis.");
    error.statusCode = 400;
    throw error;
  }

  const validatedAlert = validateAlert(payload.alert);

  // 3. Validate optional user prompt
  if (payload.prompt !== undefined && payload.prompt !== null && typeof payload.prompt !== "string") {
    const error = new Error("Invalid request: 'prompt' must be a string if provided.");
    error.statusCode = 400;
    throw error;
  }
  const activePrompt =
    typeof payload.prompt === "string" && payload.prompt.trim() !== ""
      ? payload.prompt.trim()
      : DEFAULT_ANALYSIS_PROMPT;

  // 4. Validate and trim optional conversation history
  validateMessages(payload.messages);
  const {
    messages: activeHistory,
    historyMessagesReceived,
    historyMessagesUsed,
    historyTrimmed
  } = trimMessageHistory(payload.messages || [], config.maxHistoryMessages);

  // 5. Build structured Markdown alert context
  const alertContext = buildAlertContext(validatedAlert);

  // 6. Handle knowledge retrieval & 5-state tracking
  const mergedOptions = { ...options, ...(payload.options || {}) };
  const enableRag =
    mergedOptions.enableRag !== undefined
      ? Boolean(mergedOptions.enableRag)
      : payload.enableRag !== undefined
      ? Boolean(payload.enableRag)
      : true;

  const topK =
    mergedOptions.topK !== undefined
      ? Number(mergedOptions.topK)
      : payload.topK !== undefined
      ? Number(payload.topK)
      : (config.defaultRetrievalTopK || 5);

  const similarityThreshold =
    mergedOptions.similarityThreshold !== undefined
      ? Number(mergedOptions.similarityThreshold)
      : payload.similarityThreshold !== undefined
      ? Number(payload.similarityThreshold)
      : (config.defaultSimilarityThreshold !== undefined ? config.defaultSimilarityThreshold : 0.60);

  let knowledgeContext = {
    status: enableRag ? "success" : "disabled",
    query: null,
    topK: enableRag ? topK : undefined,
    similarityThreshold: enableRag ? similarityThreshold : undefined,
    matchesFound: 0,
    sourcesUsed: []
  };

  let ragContextText = "";

  if (enableRag) {
    const retrievalQuery = constructRetrievalQueryFromAlert(validatedAlert);
    knowledgeContext.query = retrievalQuery;

    try {
      // Check repository for indexed chunks
      const allIndexedChunks = await knowledgeRepository.getAllIndexedChunks();

      if (!Array.isArray(allIndexedChunks) || allIndexedChunks.length === 0) {
        knowledgeContext.status = "empty_kb";
        knowledgeContext.matchesFound = 0;
        knowledgeContext.sourcesUsed = [];
      } else if (retrievalQuery) {
        const retrievalResult = await retrieveKnowledge(retrievalQuery, {
          topK,
          similarityThreshold,
          providerOverride: mergedOptions.embeddingProviderOverride
        });

        knowledgeContext.matchesFound = retrievalResult.matchedCount;

        if (retrievalResult.matchedCount > 0) {
          knowledgeContext.status = "success";
          const ragBuilt = buildRagContext(retrievalResult.results);
          ragContextText = ragBuilt.ragContextText;

          // Preserve clean source attribution (without exposing raw float vectors or internal embedding objects)
          knowledgeContext.sourcesUsed = retrievalResult.results.map((chunk) => ({
            documentId: chunk.documentId,
            title: chunk.metadata?.documentTitle || "Threat Knowledge Document",
            source: chunk.metadata?.source || "Internal Knowledge Base",
            category: chunk.metadata?.category || "cybersecurity",
            similarity: chunk.similarity
          }));
        } else {
          knowledgeContext.status = "no_match";
          knowledgeContext.sourcesUsed = [];
        }
      }
    } catch (retrievalErr) {
      // Graceful fallback to alert-only analysis on retrieval/embedding failures
      knowledgeContext = {
        status: "failed",
        query: retrievalQuery,
        topK,
        similarityThreshold,
        matchesFound: 0,
        sourcesUsed: [],
        error: sanitizeErrorMessage(retrievalErr?.message || "Knowledge retrieval failed.")
      };
      ragContextText = "";
    }
  }

  // 7. Combine alert context and retrieved knowledge reference block
  const combinedContext = ragContextText
    ? `${alertContext}\n\n${ragContextText}`
    : alertContext;

  // 8. Format conversation turn for structured Gemini analysis
  const contents = formatConversationContents(activeHistory, activePrompt, combinedContext);

  // 9. Execute structured Gemini call
  const { text, usage, estimatedCost } = await executeStructuredLlmCall({
    contents,
    options: mergedOptions
  });

  // 10. Parse raw response JSON
  const parsedJson = parseAnalysisResponse(text);

  // 11. Validate and normalize schema
  const validatedAnalysis = validateAndNormalizeAnalysis(parsedJson);

  return {
    success: true,
    analysis: validatedAnalysis,
    knowledgeContext,
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
