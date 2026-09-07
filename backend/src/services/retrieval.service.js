/**
 * Semantic Knowledge Retrieval Service for AlertIQ
 *
 * Provides dense vector similarity search across indexed Knowledge Base chunks using
 * gemini-embedding-2 query embeddings, cosine similarity scoring, descending ranking,
 * and configurable Top-K and threshold filtering.
 */

import { config } from "../config/env.js";
import { generateQueryEmbedding } from "./embedding.service.js";
import { knowledgeRepository } from "../repositories/knowledge.repository.js";
import { cosineSimilarity, isValidVector } from "../utils/vector.utils.js";

/**
 * Searches the knowledge base for chunks semantically relevant to a query string.
 *
 * @param {string} query - Raw search or investigation query text.
 * @param {Object} [options={}] - Search configuration options.
 * @param {number} [options.topK] - Maximum number of top chunks to return (defaults to config.defaultRetrievalTopK || 5).
 * @param {number} [options.similarityThreshold] - Minimum cosine similarity score (defaults to config.defaultSimilarityThreshold || 0.60).
 * @returns {Promise<{
 *   query: string,
 *   topK: number,
 *   similarityThreshold: number,
 *   totalIndexedChunks: number,
 *   matchedCount: number,
 *   results: Array<{
 *     chunkId: string,
 *     documentId: string,
 *     chunkIndex: number,
 *     totalChunks: number,
 *     content: string,
 *     metadata: Object,
 *     similarity: number
 *   }>
 * }>}
 * @throws {Error} with statusCode 400 for invalid query/parameters.
 */
export const retrieveKnowledge = async (query, options = {}) => {
  // 1. Validate query input
  if (query === undefined || query === null || typeof query !== "string") {
    const error = new Error("Invalid search query: Query must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }

  const cleanQuery = query.trim();
  if (cleanQuery.length === 0) {
    const error = new Error("Invalid search query: Query cannot be empty or whitespace only.");
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate and normalize topK
  const rawTopK = options.topK !== undefined ? Number(options.topK) : (config.defaultRetrievalTopK || 5);
  const maxTopK = config.maxRetrievalTopK || 20;

  if (!Number.isInteger(rawTopK) || rawTopK <= 0) {
    const error = new Error(`Invalid retrieval parameter: 'topK' must be a positive integer.`);
    error.statusCode = 400;
    throw error;
  }
  const effectiveTopK = Math.min(rawTopK, maxTopK);

  // 3. Validate and normalize similarityThreshold
  const rawThreshold =
    options.similarityThreshold !== undefined
      ? Number(options.similarityThreshold)
      : (config.defaultSimilarityThreshold !== undefined ? config.defaultSimilarityThreshold : 0.6);

  if (typeof rawThreshold !== "number" || isNaN(rawThreshold) || rawThreshold < -1.0 || rawThreshold > 1.0) {
    const error = new Error(
      `Invalid retrieval parameter: 'similarityThreshold' must be a number between -1.0 and 1.0.`
    );
    error.statusCode = 400;
    throw error;
  }
  const effectiveThreshold = rawThreshold;

  // 4. Generate dense query embedding vector
  const queryEmbedding = await generateQueryEmbedding(cleanQuery, options);
  const queryVector = queryEmbedding.vector;

  // 5. Fetch all indexed chunks from repository abstraction
  const allIndexedChunks = await knowledgeRepository.getAllIndexedChunks();

  if (!Array.isArray(allIndexedChunks) || allIndexedChunks.length === 0) {
    return {
      query: cleanQuery,
      topK: effectiveTopK,
      similarityThreshold: effectiveThreshold,
      totalIndexedChunks: 0,
      matchedCount: 0,
      results: []
    };
  }

  // 6. Calculate cosine similarity against all indexed chunk vectors
  const candidates = [];

  for (const chunk of allIndexedChunks) {
    // Only process chunks that have ready and valid vector arrays
    if (
      !chunk.embedding ||
      chunk.embedding.status !== "ready" ||
      !isValidVector(chunk.embedding.vector, config.embeddingDimensions || 768)
    ) {
      continue;
    }

    const similarity = cosineSimilarity(queryVector, chunk.embedding.vector);

    // Apply minimum similarity threshold filter
    if (similarity >= effectiveThreshold) {
      candidates.push({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        content: chunk.content,
        metadata: chunk.metadata || {},
        similarity: parseFloat(similarity.toFixed(6))
      });
    }
  }

  // 7. Sort candidates descending by cosine similarity score
  candidates.sort((a, b) => b.similarity - a.similarity);

  // 8. Select Top-K matching chunks
  const results = candidates.slice(0, effectiveTopK);

  return {
    query: cleanQuery,
    topK: effectiveTopK,
    similarityThreshold: effectiveThreshold,
    totalIndexedChunks: allIndexedChunks.length,
    matchedCount: results.length,
    results
  };
};
