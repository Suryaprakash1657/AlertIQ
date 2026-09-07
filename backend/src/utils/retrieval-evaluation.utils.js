/**
 * Information Retrieval (IR) Evaluation Metrics Utilities for AlertIQ
 *
 * Provides pure, zero-division-safe mathematical implementations of document-level
 * Precision@K, Recall@K, HitRate@K, Reciprocal Rank (RR), and Mean Reciprocal Rank (MRR).
 *
 * Ensures document-level deduplication so multiple chunks from a single document
 * do not artificially distort relevance measurements.
 */

/**
 * Extracts an ordered list of unique document IDs from retrieved chunk entities,
 * preserving the earliest rank occurrence of each document.
 *
 * @param {Array<{ documentId?: string }>} retrievedChunks - Array of chunk objects.
 * @returns {string[]} Array of unique document IDs.
 */
export const extractDistinctDocumentIds = (retrievedChunks = []) => {
  if (!Array.isArray(retrievedChunks) || retrievedChunks.length === 0) {
    return [];
  }

  const seen = new Set();
  const distinct = [];

  for (const chunk of retrievedChunks) {
    const docId = chunk?.documentId;
    if (docId && typeof docId === "string" && !seen.has(docId)) {
      seen.add(docId);
      distinct.push(docId);
    }
  }

  return distinct;
};

/**
 * Calculates document-level Precision@K.
 * Precision@K = (number of relevant distinct docs in Top-K) / (number of distinct docs actually retrieved in Top-K)
 *
 * @param {Array<Object>} retrievedChunks - Array of retrieved chunk objects.
 * @param {string[]} expectedDocIds - Array of ground-truth relevant document IDs.
 * @param {number} [k] - Cutoff rank (defaults to retrievedChunks.length).
 * @returns {number} Precision score bounded in [0.0, 1.0].
 */
export const calculatePrecisionAtK = (retrievedChunks = [], expectedDocIds = [], k) => {
  if (!Array.isArray(retrievedChunks) || retrievedChunks.length === 0) {
    return 0.0;
  }

  const effectiveK = typeof k === "number" && k > 0 ? k : retrievedChunks.length;
  const chunksAtK = retrievedChunks.slice(0, effectiveK);
  const retrievedDocIds = extractDistinctDocumentIds(chunksAtK);

  if (retrievedDocIds.length === 0) {
    return 0.0;
  }

  const expectedSet = new Set(Array.isArray(expectedDocIds) ? expectedDocIds : []);
  const relevantRetrieved = retrievedDocIds.filter((docId) => expectedSet.has(docId));

  const precision = relevantRetrieved.length / retrievedDocIds.length;
  return parseFloat(precision.toFixed(4));
};

/**
 * Calculates document-level Recall@K.
 * Recall@K = (number of relevant distinct docs in Top-K) / (total number of expected relevant docs)
 * Returns null if expectedDocIds is empty (e.g. negative cases where Recall is undefined).
 *
 * @param {Array<Object>} retrievedChunks - Array of retrieved chunk objects.
 * @param {string[]} expectedDocIds - Array of ground-truth relevant document IDs.
 * @param {number} [k] - Cutoff rank (defaults to retrievedChunks.length).
 * @returns {number|null} Recall score bounded in [0.0, 1.0], or null for empty ground truth.
 */
export const calculateRecallAtK = (retrievedChunks = [], expectedDocIds = [], k) => {
  if (!Array.isArray(expectedDocIds) || expectedDocIds.length === 0) {
    return null; // Undefined for empty ground truth
  }

  if (!Array.isArray(retrievedChunks) || retrievedChunks.length === 0) {
    return 0.0;
  }

  const effectiveK = typeof k === "number" && k > 0 ? k : retrievedChunks.length;
  const chunksAtK = retrievedChunks.slice(0, effectiveK);
  const retrievedDocIds = extractDistinctDocumentIds(chunksAtK);

  const expectedSet = new Set(expectedDocIds);
  const relevantRetrieved = retrievedDocIds.filter((docId) => expectedSet.has(docId));

  const recall = relevantRetrieved.length / expectedDocIds.length;
  return parseFloat(Math.min(1.0, Math.max(0.0, recall)).toFixed(4));
};

/**
 * Calculates Hit Rate@K (Success@K).
 * Returns 1.0 if at least one expected relevant document is in Top-K, 0.0 otherwise.
 * Returns null if expectedDocIds is empty.
 *
 * @param {Array<Object>} retrievedChunks - Array of retrieved chunk objects.
 * @param {string[]} expectedDocIds - Array of ground-truth relevant document IDs.
 * @param {number} [k] - Cutoff rank.
 * @returns {number|null} 1.0 or 0.0, or null if expectedDocIds is empty.
 */
export const calculateHitRateAtK = (retrievedChunks = [], expectedDocIds = [], k) => {
  if (!Array.isArray(expectedDocIds) || expectedDocIds.length === 0) {
    return null;
  }

  if (!Array.isArray(retrievedChunks) || retrievedChunks.length === 0) {
    return 0.0;
  }

  const effectiveK = typeof k === "number" && k > 0 ? k : retrievedChunks.length;
  const chunksAtK = retrievedChunks.slice(0, effectiveK);
  const retrievedDocIds = extractDistinctDocumentIds(chunksAtK);

  const expectedSet = new Set(expectedDocIds);
  const hasHit = retrievedDocIds.some((docId) => expectedSet.has(docId));

  return hasHit ? 1.0 : 0.0;
};

/**
 * Calculates Reciprocal Rank (RR) for a single query using distinct document-level rank.
 * RR = 1 / rank_position of the first relevant distinct document.
 * Returns 0.0 if no expected document is retrieved.
 * Returns null if expectedDocIds is empty.
 *
 * @param {Array<Object>} retrievedChunks - Array of retrieved chunk objects (ordered by relevance).
 * @param {string[]} expectedDocIds - Array of ground-truth relevant document IDs.
 * @returns {number|null} Reciprocal rank score, or null if expectedDocIds is empty.
 */
export const calculateReciprocalRank = (retrievedChunks = [], expectedDocIds = []) => {
  if (!Array.isArray(expectedDocIds) || expectedDocIds.length === 0) {
    return null;
  }

  if (!Array.isArray(retrievedChunks) || retrievedChunks.length === 0) {
    return 0.0;
  }

  const distinctDocIds = extractDistinctDocumentIds(retrievedChunks);
  if (distinctDocIds.length === 0) {
    return 0.0;
  }

  const expectedSet = new Set(expectedDocIds);

  for (let i = 0; i < distinctDocIds.length; i++) {
    const docId = distinctDocIds[i];
    if (docId && expectedSet.has(docId)) {
      const rank = i + 1; // 1-based distinct document rank
      return parseFloat((1.0 / rank).toFixed(6));
    }
  }

  return 0.0;
};

/**
 * Calculates Mean Reciprocal Rank (MRR) across an array of evaluation case results.
 * Ignores cases where reciprocalRank is null (e.g. negative query cases).
 *
 * @param {Array<{ reciprocalRank?: number|null }>} evaluationResults - Array of evaluated case results.
 * @returns {number} Average MRR bounded in [0.0, 1.0].
 */
export const calculateMeanReciprocalRank = (evaluationResults = []) => {
  if (!Array.isArray(evaluationResults) || evaluationResults.length === 0) {
    return 0.0;
  }

  const validScores = evaluationResults
    .map((r) => r.reciprocalRank)
    .filter((score) => typeof score === "number" && Number.isFinite(score));

  if (validScores.length === 0) {
    return 0.0;
  }

  const sum = validScores.reduce((acc, val) => acc + val, 0);
  return parseFloat((sum / validScores.length).toFixed(4));
};

/**
 * Computes arithmetic mean for a specific numeric metric key across an array of result objects.
 *
 * @param {Array<Object>} results - Array of evaluated objects.
 * @param {string} metricKey - Key name (e.g. "precisionAtK", "recallAtK").
 * @returns {number} Average value bounded and rounded to 4 decimals.
 */
export const calculateAverageMetric = (results = [], metricKey) => {
  if (!Array.isArray(results) || results.length === 0 || !metricKey) {
    return 0.0;
  }

  const validValues = results
    .map((r) => r[metricKey])
    .filter((v) => typeof v === "number" && Number.isFinite(v));

  if (validValues.length === 0) {
    return 0.0;
  }

  const sum = validValues.reduce((acc, v) => acc + v, 0);
  return parseFloat((sum / validValues.length).toFixed(4));
};
