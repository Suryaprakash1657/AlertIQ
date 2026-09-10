/**
 * Alert Follow-Up Chat Service for AlertIQ
 *
 * Implements dedicated conversational incident-response assistance:
 * - Validates alert, prompt, and conversation history
 * - Evaluates semantic scope boundaries (redirecting out-of-scope queries)
 * - Constructs dynamic, question-aware retrieval queries
 * - Augments conversation with grounded knowledge runbooks
 * - Enforces conversational reasoning (alternatives, trade-offs, false positives)
 * - Zero persistence to analysis history (purely conversational session)
 */

import { GoogleGenAI } from "@google/genai";
import { config } from "../config/env.js";
import { validateAlert, buildAlertContext } from "../utils/alert.utils.js";
import {
  ALERTIQ_CHAT_SYSTEM_INSTRUCTION,
  SCOPE_REDIRECTION_MESSAGE
} from "../utils/prompts.js";
import { constructDynamicChatQuery, buildRagContext } from "../utils/rag.utils.js";
import { retrieveKnowledge } from "./retrieval.service.js";
import { knowledgeRepository } from "../repositories/knowledge.repository.js";
import { sanitizeErrorMessage } from "./embedding.service.js";
import { trimMessageHistory, validateMessages } from "../utils/conversation.utils.js";
import { estimateLlmCost } from "./cost.service.js";

// Optional execution hook for deterministic unit testing without external API calls
let customChatLlmExecutor = null;

export const setChatLlmExecutionOverride = (executor) => {
  customChatLlmExecutor = executor;
};

export const resetChatLlmExecutionOverride = () => {
  customChatLlmExecutor = null;
};

/**
 * Common non-security query patterns for fast out-of-scope detection.
 * Uses semantic boundaries (recipes, weather, sports, general creative writing).
 */
const OUT_OF_SCOPE_REGEX = /\b(recipe|bake|cook|pasta|cookie|cake|weather|forecast|rain|temperature|poem|poetry|song lyrics|football|soccer|baseball|nba|nfl|cricket score|movie review|joke|horoscope|astrology)\b/i;

/**
 * Checks if an inquiry is clearly outside the scope of cybersecurity, IT infrastructure, or the active incident.
 *
 * @param {string} prompt - User question.
 * @returns {boolean} True if question is clearly out-of-scope.
 */
export const isPromptOutOfScope = (prompt = "") => {
  if (typeof prompt !== "string" || prompt.trim() === "") {
    return false;
  }

  const clean = prompt.trim().toLowerCase();

  // If prompt explicitly contains general non-IT/non-security domains without any cybersecurity context
  if (OUT_OF_SCOPE_REGEX.test(clean)) {
    const isSecurityContext = /\b(firewall|cve|ssh|malware|alert|port|ip|token|auth|compromise|phish|sudo|contain|isolate|remediat|mitigat|packet|tcp|udp|server|linux|windows|active directory|credential|ioc)\b/i.test(clean);
    if (!isSecurityContext) {
      return true;
    }
  }

  return false;
};

/**
 * Detects if a user prompt is purely a greeting or simple acknowledgement without an actual security inquiry.
 * Returns a brief, natural response if matched, or null if it contains an actual inquiry.
 *
 * @param {string} prompt - Raw user prompt.
 * @param {Object} [alert=null] - Validated alert entity.
 * @returns {string|null} Natural response or null if question should proceed to full pipeline.
 */
export const getGreetingOrAcknowledgementResponse = (prompt = "", alert = null) => {
  if (typeof prompt !== "string" || prompt.trim() === "") {
    return null;
  }

  // Normalize: remove surrounding punctuation, lower case, collapse extra spaces
  const clean = prompt
    .trim()
    .toLowerCase()
    .replace(/^[^\w]+|[^\w]+$/g, "")
    .replace(/\s+/g, " ");

  // If prompt contains question marks or security investigation verbs/nouns, do NOT treat as pure greeting
  if (
    clean.includes("?") ||
    /\b(what|why|how|who|where|when|can|could|is|are|should|would|will|check|verify|explain|contain|mitigat|remediat|isolate|kill|ip|port|ssh|user|sudo|log|file|alert|risk|evidence|process|persistence|backdoor|malware|cve)\b/i.test(clean)
  ) {
    return null;
  }

  const alertIdentifier = alert?.id || alert?.title || "this incident";
  const alertTitle = alert?.title || alert?.id || "the security alert";

  const GREETING_PATTERNS = new Set([
    "hello",
    "hi",
    "hey",
    "hey there",
    "hi there",
    "hello there",
    "good morning",
    "good afternoon",
    "good evening",
    "greetings",
    "hello alertiq",
    "hi alertiq",
    "hey alertiq"
  ]);

  const ACKNOWLEDGEMENT_PATTERNS = new Set([
    "thanks",
    "thank you",
    "thank you so much",
    "thanks a lot",
    "thanks alertiq",
    "thank you alertiq",
    "got it",
    "got it thanks",
    "ok thanks",
    "okay thanks",
    "understood",
    "understood thanks",
    "great thanks",
    "perfect thanks",
    "cool thanks",
    "ok",
    "okay",
    "acknowledged"
  ]);

  if (GREETING_PATTERNS.has(clean)) {
    return `Hello! I'm ready to help investigate ${alertIdentifier}: "${alertTitle}". You can ask about the alert evidence, investigation steps, containment options, alternative mitigation approaches, or false-positive validation.`;
  }

  if (ACKNOWLEDGEMENT_PATTERNS.has(clean)) {
    return `You're welcome! Let me know if you need any further analysis, alternative mitigation approaches, or verification steps for ${alertIdentifier}.`;
  }

  return null;
};


/**
 * Executes the conversational Gemini API call with retries for transient provider errors.
 *
 * @param {Object} params
 * @param {Array} params.contents - Formatted multi-turn conversation contents.
 * @param {Object} [params.options] - Service options.
 * @returns {Promise<{
 *   text: string,
 *   usage: { inputTokens: number, outputTokens: number, totalTokens: number, thoughtsTokens?: number },
 *   estimatedCost: Object
 * }>}
 */
const executeChatLlmCall = async ({ contents, options = {} }) => {
  // 1. Check for testing execution override
  const executor = options.llmExecutorOverride || customChatLlmExecutor;
  if (typeof executor === "function") {
    return executor(contents, {
      systemInstruction: ALERTIQ_CHAT_SYSTEM_INSTRUCTION,
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
    systemInstruction: ALERTIQ_CHAT_SYSTEM_INSTRUCTION
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
        const delayMatch = rawMessage.match(/retry in ([0-9.]+)s/i);
        const waitTime = delayMatch
          ? Math.min(60000, Math.ceil(parseFloat(delayMatch[1]) * 1000) + 2000)
          : attempt * 2000;

        console.log(`[Follow-Up Chat] Transient rate-limit (attempt ${attempt}/${maxRetries}), waiting ${Math.round(waitTime / 1000)}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      const sanitized = sanitizeErrorMessage(rawMessage || "Follow-up chat generation failed.");
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
 * Orchestrates the conversational follow-up chat pipeline for an active security alert.
 *
 * @param {Object} payload
 * @param {Object} payload.alert - Pre-validated structured alert object (required).
 * @param {string} payload.prompt - User follow-up question (required).
 * @param {Array<{role: string, content: string}>} [payload.messages] - Prior conversation turns.
 * @param {boolean} [payload.enableRag=true] - Flag to enable semantic knowledge retrieval.
 * @param {number} [payload.topK=5] - Number of RAG chunks to retrieve.
 * @param {number} [payload.similarityThreshold=0.60] - Cosine similarity cutoff.
 * @param {Object} [options={}] - Optional runtime overrides.
 * @returns {Promise<{
 *   success: boolean,
 *   response: string,
 *   isOutOfScope: boolean,
 *   citations: Array<{ documentId: string, title: string, source: string, category: string, similarity: number }>,
 *   knowledgeContext: { status: string, matchesFound: number, topK?: number, similarityThreshold?: number, error?: string },
 *   conversation: { historyMessagesReceived: number, historyMessagesUsed: number, historyTrimmed: boolean },
 *   model: string,
 *   usage: Object,
 *   estimatedCost: Object
 * }>}
 */
export const chatWithAlertPipeline = async (payload = {}, options = {}) => {
  // 1. Validate payload presence
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Invalid request payload: Request body must be a valid JSON object.");
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate structured alert object
  if (payload.alert === undefined || payload.alert === null) {
    const error = new Error("Invalid request: 'alert' is required for follow-up chat.");
    error.statusCode = 400;
    throw error;
  }
  const validatedAlert = validateAlert(payload.alert);

  // 3. Validate user prompt (Required non-empty string)
  if (payload.prompt === undefined || payload.prompt === null || typeof payload.prompt !== "string" || payload.prompt.trim() === "") {
    const error = new Error("Invalid request: 'prompt' must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }
  const activePrompt = payload.prompt.trim();

  // 4. Validate and trim prior conversation history
  validateMessages(payload.messages);
  const {
    messages: activeHistory,
    historyMessagesReceived,
    historyMessagesUsed,
    historyTrimmed
  } = trimMessageHistory(payload.messages || [], config.maxHistoryMessages);

  const mergedOptions = { ...options, ...(payload.options || {}) };
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

  // 5. Fast-path greeting and acknowledgement handling (deterministic, zero RAG or LLM cost)
  const greetingResponse = getGreetingOrAcknowledgementResponse(activePrompt, validatedAlert);
  if (greetingResponse) {
    return {
      success: true,
      response: greetingResponse,
      isOutOfScope: false,
      citations: [],
      knowledgeContext: {
        status: "disabled",
        matchesFound: 0,
        topK,
        similarityThreshold
      },
      conversation: {
        historyMessagesReceived,
        historyMessagesUsed,
        historyTrimmed
      },
      model: config.geminiModel,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      estimatedCost: { totalCost: 0 }
    };
  }

  // 6. Fast-path out-of-scope evaluation (bypasses unnecessary RAG retrieval and costs)
  if (isPromptOutOfScope(activePrompt)) {
    return {
      success: true,
      response: SCOPE_REDIRECTION_MESSAGE,
      isOutOfScope: true,
      citations: [],
      knowledgeContext: {
        status: "disabled",
        matchesFound: 0,
        topK,
        similarityThreshold
      },
      conversation: {
        historyMessagesReceived,
        historyMessagesUsed,
        historyTrimmed
      },
      model: config.geminiModel,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      estimatedCost: { totalCost: 0 }
    };
  }


  // 6. Build active alert markdown context
  const alertContext = buildAlertContext(validatedAlert);

  // 7. Dynamic RAG retrieval (combining alert telemetry + specific user question)
  const enableRag =
    mergedOptions.enableRag !== undefined
      ? Boolean(mergedOptions.enableRag)
      : payload.enableRag !== undefined
      ? Boolean(payload.enableRag)
      : true;

  let knowledgeContext = {
    status: enableRag ? "success" : "disabled",
    query: null,
    topK: enableRag ? topK : undefined,
    similarityThreshold: enableRag ? similarityThreshold : undefined,
    matchesFound: 0
  };
  let citations = [];
  let ragContextText = "";

  if (enableRag) {
    const dynamicQuery = constructDynamicChatQuery(validatedAlert, activePrompt);
    knowledgeContext.query = dynamicQuery;

    try {
      const allIndexedChunks = await knowledgeRepository.getAllIndexedChunks();

      if (!Array.isArray(allIndexedChunks) || allIndexedChunks.length === 0) {
        knowledgeContext.status = "empty_kb";
        knowledgeContext.matchesFound = 0;
      } else if (dynamicQuery) {
        const retrievalResult = await retrieveKnowledge(dynamicQuery, {
          topK,
          similarityThreshold,
          providerOverride: mergedOptions.embeddingProviderOverride
        });

        knowledgeContext.matchesFound = retrievalResult.matchedCount;

        if (retrievalResult.matchedCount > 0) {
          knowledgeContext.status = "success";
          const ragBuilt = buildRagContext(retrievalResult.results);
          ragContextText = ragBuilt.ragContextText;

          citations = retrievalResult.results.map((chunk) => ({
            documentId: chunk.documentId,
            title: chunk.metadata?.documentTitle || "Internal Security Document",
            source: chunk.metadata?.source || "Internal Knowledge Base",
            category: chunk.metadata?.category || "cybersecurity",
            similarity: chunk.similarity
          }));
        } else {
          knowledgeContext.status = "no_match";
        }
      }
    } catch (retrievalErr) {
      knowledgeContext = {
        status: "failed",
        query: dynamicQuery,
        topK,
        similarityThreshold,
        matchesFound: 0,
        error: sanitizeErrorMessage(retrievalErr?.message || "Knowledge retrieval failed.")
      };
      ragContextText = "";
    }
  }

  // 8. Assemble multi-turn conversation contents with strict separation
  const formattedHistory = (activeHistory || []).map((msg) => {
    const normalizedRole = msg.role.toLowerCase() === "assistant" ? "model" : msg.role.toLowerCase();
    return {
      role: normalizedRole,
      parts: [{ text: msg.content.trim() }]
    };
  });

  const groundingBlock = ragContextText
    ? `${ragContextText}\n\n`
    : "";

  const finalUserTurn =
    `### ACTIVE SECURITY ALERT DETAILS ###\n` +
    `${alertContext}\n\n` +
    `${groundingBlock}` +
    `### ANALYST QUESTION / INVESTIGATION QUERY ###\n` +
    `${activePrompt}`;

  const contents = [
    ...formattedHistory,
    {
      role: "user",
      parts: [{ text: finalUserTurn }]
    }
  ];

  // 9. Execute conversational Gemini generation
  const { text, usage, estimatedCost } = await executeChatLlmCall({
    contents,
    options: mergedOptions
  });

  // 10. Check if LLM output indicated scope redirection
  const isLlmRedirection =
    text.toLowerCase().includes("focused on helping with the current security incident") ||
    text.toLowerCase().includes("please ask a question related to this incident");

  return {
    success: true,
    response: text.trim(),
    isOutOfScope: isLlmRedirection,
    citations,
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
