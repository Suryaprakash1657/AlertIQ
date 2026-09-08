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

  // 5. If active repository supports direct database vector search (e.g. pgvector <=>), use it:
  if (typeof knowledgeRepository.searchSimilarChunks === "function") {
    const allIndexed = await knowledgeRepository.getAllIndexedChunks();
    const totalIndexedChunks = Array.isArray(allIndexed) ? allIndexed.length : 0;

    if (totalIndexedChunks === 0) {
      return {
        query: cleanQuery,
        topK: effectiveTopK,
        similarityThreshold: effectiveThreshold,
        totalIndexedChunks: 0,
        matchedCount: 0,
        results: []
      };
    }

    const pgResults = await knowledgeRepository.searchSimilarChunks(queryVector, {
      topK: effectiveTopK,
      similarityThreshold: effectiveThreshold
    });

    return {
      query: cleanQuery,
      topK: effectiveTopK,
      similarityThreshold: effectiveThreshold,
      totalIndexedChunks,
      matchedCount: pgResults.length,
      results: pgResults
    };
  }

  // 6. Fallback: In-memory cosine similarity calculation (for InMemoryKnowledgeRepository)
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

  const candidates = [];

  for (const chunk of allIndexedChunks) {
    if (
      !chunk.embedding ||
      chunk.embedding.status !== "ready" ||
      !isValidVector(chunk.embedding.vector, config.embeddingDimensions || 768)
    ) {
      continue;
    }

    const similarity = cosineSimilarity(queryVector, chunk.embedding.vector);

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

  candidates.sort((a, b) => b.similarity - a.similarity);
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
