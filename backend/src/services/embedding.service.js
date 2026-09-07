/**
 * Embedding Service for AlertIQ Knowledge Base
 *
 * Provides a decoupled interface for generating dense vector embeddings using Google GenAI SDK.
 * Supports configurable embedding models (default: gemini-embedding-2), explicit 768-dimensional
 * output, RETRIEVAL_DOCUMENT task configuration, transient error retries, and key sanitization.
 */

import { GoogleGenAI } from "@google/genai";
import { config } from "../config/env.js";

// Optional provider override hook used for deterministic testing/mocking
let customEmbeddingProvider = null;

/**
 * Sets a custom provider implementation (primarily for unit/mock testing).
 * @param {Function|null} provider - Async function (text, options) => { model, dimensions, vector, generatedAt }
 */
export const setEmbeddingProviderOverride = (provider) => {
  customEmbeddingProvider = provider;
};

/**
 * Resets any custom provider override back to default Google GenAI implementation.
 */
export const resetEmbeddingProviderOverride = () => {
  customEmbeddingProvider = null;
};

/**
 * Sanitizes an error message or string by stripping any potential API keys or tokens.
 * @param {string} message
 * @returns {string} Sanitized string
 */
export const sanitizeErrorMessage = (message = "") => {
  if (typeof message !== "string") {
    return "Unknown embedding provider error occurred.";
  }
  return message
    .replace(/key=[^&\s]+/gi, "key=[REDACTED]")
    .replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]")
    .replace(/bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "bearer [REDACTED]");
};

/**
 * Generates a dense vector embedding for a single text input string.
 *
 * @param {string} text - Raw text content to embed.
 * @param {Object} [options={}] - Optional parameters (title, taskType, etc.).
 * @param {string} [options.title] - Optional document title for RETRIEVAL_DOCUMENT task context.
 * @param {string} [options.taskType="RETRIEVAL_DOCUMENT"] - Task type for retrieval optimization.
 * @param {number} [options.outputDimensionality=768] - Target embedding dimensions (defaults to 768).
 * @returns {Promise<{
 *   model: string,
 *   dimensions: number,
 *   vector: number[],
 *   generatedAt: string
 * }>}
 * @throws {Error} with statusCode 400 for bad inputs, 500 for config errors, 502 for provider/validation failures.
 */
export const generateEmbedding = async (text, options = {}) => {
  // 1. Validate input text
  if (text === undefined || text === null || typeof text !== "string") {
    const error = new Error("Invalid embedding input: Text must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }

  const cleanText = text.trim();
  if (cleanText.length === 0) {
    const error = new Error("Invalid embedding input: Text cannot be empty or whitespace only.");
    error.statusCode = 400;
    throw error;
  }

  // 2. Check if a provider override is configured (for testing / mocking)
  const provider = options.providerOverride || customEmbeddingProvider;
  if (typeof provider === "function") {
    const result = await provider(cleanText, options);
    return validateEmbeddingResult(result, config.embeddingDimensions || 768);
  }

  // 3. Validate Google Gemini API configuration
  if (
    !config.geminiApiKey ||
    config.geminiApiKey.trim() === "" ||
    config.geminiApiKey === "your_gemini_api_key_here"
  ) {
    const error = new Error(
      "Gemini API key is missing or not configured in server environment (.env)."
    );
    error.statusCode = 500;
    throw error;
  }

  const modelName = config.geminiEmbeddingModel || "gemini-embedding-2";
  const targetDimensions = options.outputDimensionality || config.embeddingDimensions || 768;
  const taskType = options.taskType || "RETRIEVAL_DOCUMENT";

  const ai = new GoogleGenAI({
    apiKey: config.geminiApiKey
  });

  const requestConfig = {
    taskType,
    outputDimensionality: targetDimensions,
    ...(options.title && typeof options.title === "string" && { title: options.title.trim() })
  };

  // 4. Call @google/genai with automatic retries for transient failures (429/503)
  let response;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      response = await ai.models.embedContent({
        model: modelName,
        contents: cleanText,
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
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }

      // Sanitize error before throwing
      const sanitized = sanitizeErrorMessage(rawMessage);
      const providerError = new Error(`Failed to generate vector embedding: ${sanitized}`);
      providerError.statusCode = err.status || err.statusCode || 502;
      throw providerError;
    }
  }

  // 5. Extract and validate vector from response
  const rawVector =
    response?.embeddings?.[0]?.values ||
    response?.embedding?.values ||
    (Array.isArray(response?.values) ? response.values : null);

  const embeddingResult = {
    model: modelName,
    dimensions: Array.isArray(rawVector) ? rawVector.length : 0,
    vector: rawVector,
    generatedAt: new Date().toISOString()
  };

  return validateEmbeddingResult(embeddingResult, targetDimensions);
};

/**
 * Validates that an embedding result matches the expected dimensions and contains valid numeric floats.
 *
 * @param {Object} result
 * @param {number} expectedDimensions
 * @returns {Object} Validated result
 * @throws {Error} with statusCode 502 if vector is invalid or dimensions mismatch
 */
export const validateEmbeddingResult = (result, expectedDimensions = 768) => {
  if (!result || typeof result !== "object") {
    const error = new Error("Embedding provider returned an empty or invalid response.");
    error.statusCode = 502;
    throw error;
  }

  const { vector, model, generatedAt } = result;

  if (!Array.isArray(vector) || vector.length === 0) {
    const error = new Error("Embedding provider failed to return a vector array.");
    error.statusCode = 502;
    throw error;
  }

  // Derive dimension directly from vector length
  const actualDimensions = vector.length;

  if (actualDimensions !== expectedDimensions) {
    const error = new Error(
      `Embedding provider returned unexpected vector dimension (expected ${expectedDimensions}, got ${actualDimensions}).`
    );
    error.statusCode = 502;
    throw error;
  }

  // Verify all vector elements are finite numeric floats
  const allFiniteNumbers = vector.every(
    (val) => typeof val === "number" && Number.isFinite(val)
  );

  if (!allFiniteNumbers) {
    const error = new Error("Embedding vector contains non-numeric or non-finite values.");
    error.statusCode = 502;
    throw error;
  }

  return {
    model: model || config.geminiEmbeddingModel || "gemini-embedding-2",
    dimensions: actualDimensions,
    vector,
    generatedAt: generatedAt || new Date().toISOString()
  };
};

/**
 * Generates embeddings across an array of chunk entities, attaching vector-ready metadata to each chunk.
 *
 * @param {Array<Object>} chunks - Array of chunk objects created by chunking.utils.
 * @param {Object} [options={}] - Ingestion and embedding options.
 * @returns {Promise<Array<Object>>} Enriched array of chunks with status: "ready" and vectors.
 * @throws {Error} if any chunk embedding fails (prevents partial indexing).
 */
export const generateEmbeddingsForChunks = async (chunks, options = {}) => {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return [];
  }

  const enrichedChunks = [];

  for (const chunk of chunks) {
    const docTitle = chunk.metadata?.documentTitle || options.title || "";
    const embeddingData = await generateEmbedding(chunk.content, {
      title: docTitle,
      ...options
    });

    enrichedChunks.push({
      ...chunk,
      embedding: {
        status: "ready",
        model: embeddingData.model,
        dimensions: embeddingData.dimensions,
        vector: embeddingData.vector,
        generatedAt: embeddingData.generatedAt
      }
    });
  }

  return enrichedChunks;
};
