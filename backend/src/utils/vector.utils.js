/**
 * Vector Mathematics Utility for AlertIQ
 *
 * Provides pure, framework-agnostic mathematical vector operations for dense embeddings,
 * including vector validation, dot product, vector magnitude, and cosine similarity.
 */

import { config } from "../config/env.js";

/**
 * Validates that a vector is a non-empty array of finite numbers matching the expected dimension.
 *
 * @param {any} vector - Candidate vector.
 * @param {number} [expectedDimensions] - Expected vector length (defaults to config.embeddingDimensions || 768).
 * @returns {boolean} True if valid vector, false otherwise.
 */
export const isValidVector = (vector, expectedDimensions = config.embeddingDimensions || 768) => {
  if (!Array.isArray(vector) || vector.length === 0) {
    return false;
  }

  if (typeof expectedDimensions === "number" && expectedDimensions > 0) {
    if (vector.length !== expectedDimensions) {
      return false;
    }
  }

  for (let i = 0; i < vector.length; i++) {
    const val = vector[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      return false;
    }
  }

  return true;
};

/**
 * Computes the dot product of two vectors of identical length.
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Dot product result, or 0 if inputs are invalid.
 */
export const dotProduct = (vecA, vecB) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    if (typeof a !== "number" || typeof b !== "number" || !Number.isFinite(a) || !Number.isFinite(b)) {
      return 0;
    }
    sum += a * b;
  }

  return Number.isFinite(sum) ? sum : 0;
};

/**
 * Computes the Euclidean norm (magnitude) of a vector.
 *
 * @param {number[]} vec
 * @returns {number} Magnitude (length) of vector, or 0 if invalid.
 */
export const vectorMagnitude = (vec) => {
  if (!Array.isArray(vec) || vec.length === 0) {
    return 0;
  }

  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return 0;
    }
    sumSq += v * v;
  }

  const mag = Math.sqrt(sumSq);
  return Number.isFinite(mag) ? mag : 0;
};

/**
 * Computes the Cosine Similarity between two vectors.
 * Returns a normalized similarity score bounded strictly in [-1.0, 1.0].
 * Safely returns 0.0 for zero-magnitude, dimension mismatches, or malformed vectors.
 *
 * @param {number[]} vecA - Query or document vector.
 * @param {number[]} vecB - Document or candidate vector.
 * @returns {number} Cosine similarity score between -1.0 and 1.0.
 */
export const cosineSimilarity = (vecA, vecB) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  const magA = vectorMagnitude(vecA);
  const magB = vectorMagnitude(vecB);

  // Handle zero-magnitude vectors safely (prevents division by zero / NaN)
  if (magA === 0 || magB === 0) {
    return 0;
  }

  const dot = dotProduct(vecA, vecB);
  const rawSimilarity = dot / (magA * magB);

  if (!Number.isFinite(rawSimilarity)) {
    return 0;
  }

  // Clamp strictly to [-1.0, 1.0] to guard against floating-point precision anomalies
  return Math.max(-1.0, Math.min(1.0, rawSimilarity));
};
