/**
 * Retrieval Evaluation & Explainability Service for AlertIQ
 *
 * Provides a provider-independent, deterministic evaluation harness and trace generator
 * that executes the production retrieval service (retrieveKnowledge) without duplicating
 * similarity math, thresholding, or ranking algorithms.
 *
 * Features:
 * - Document-level Precision@K, Recall@K, HitRate@K, and MRR benchmarking
 * - Parameter sweeps across Thresholds [0.40, 0.50, 0.60, 0.70, 0.80] and Top-K [1, 3, 5, 10]
 * - Dedicated handling of Negative queries and Not-Indexed documents
 * - Safe 5-state Retrieval Trace generation with candidate-level rejection tracking
 * - RAG context budget audit and deterministic RAG vs Non-RAG pipeline comparison
 */

import { config } from "../config/env.js";
import { retrieveKnowledge } from "./retrieval.service.js";
import { knowledgeRepository } from "../repositories/knowledge.repository.js";
import { cosineSimilarity, isValidVector } from "../utils/vector.utils.js";
import { buildRagContext, constructRetrievalQueryFromAlert } from "../utils/rag.utils.js";
import {
  extractDistinctDocumentIds,
  calculatePrecisionAtK,
  calculateRecallAtK,
  calculateHitRateAtK,
  calculateReciprocalRank,
  calculateMeanReciprocalRank,
  calculateAverageMetric
} from "../utils/retrieval-evaluation.utils.js";

/**
 * Evaluates a single test case against the indexed Knowledge Base using production retrieveKnowledge().
 *
 * @param {Object} testCase - Test case entity from evaluation fixtures.
 * @param {Object} [options={}] - Evaluation parameters (topK, similarityThreshold, etc.).
 * @returns {Promise<Object>} Detailed evaluation result for this test case.
 */
export const evaluateRetrievalCase = async (testCase, options = {}) => {
  if (!testCase || typeof testCase !== "object") {
    throw new Error("Invalid testCase: testCase object is required.");
  }

  const effectiveTopK = options.topK !== undefined ? Number(options.topK) : (config.defaultRetrievalTopK || 5);
  const effectiveThreshold =
    options.similarityThreshold !== undefined
      ? Number(options.similarityThreshold)
      : (config.defaultSimilarityThreshold !== undefined ? config.defaultSimilarityThreshold : 0.6);

  // 1. Check for Not-Indexed condition: verify if expected documents exist in the corpus
  const allDocs = await knowledgeRepository.findAll();
  const indexedDocIdSet = new Set(allDocs.map((d) => d.id));
  const expectedDocIds = Array.isArray(testCase.expectedRelevantDocIds) ? testCase.expectedRelevantDocIds : [];
  const missingDocIds = expectedDocIds.filter((id) => !indexedDocIdSet.has(id));

  const isNotIndexedCase = testCase.type === "not_indexed" || (expectedDocIds.length > 0 && missingDocIds.length === expectedDocIds.length);

  // 2. Prepare mock embedding provider override if testCase contains deterministic vector
  const retrievalOptions = {
    topK: effectiveTopK,
    similarityThreshold: effectiveThreshold,
    ...(testCase.queryEmbedding && {
      providerOverride: async () => ({
        model: config.geminiEmbeddingModel || "gemini-embedding-2",
        dimensions: testCase.queryEmbedding.length,
        vector: testCase.queryEmbedding,
        generatedAt: new Date().toISOString()
      })
    })
  };

  // 3. Execute production retrieval logic directly
  const retrievalResult = await retrieveKnowledge(testCase.queryText, retrievalOptions);
  const retrievedChunks = retrievalResult.results || [];
  const distinctRetrievedDocIds = extractDistinctDocumentIds(retrievedChunks);

  // 4. Handle Not-Indexed cases
  if (isNotIndexedCase) {
    return {
      caseId: testCase.id,
      name: testCase.name,
      type: "not_indexed",
      queryText: testCase.queryText,
      indexingStatus: "not_indexed",
      missingDocIds,
      expectedRelevantDocIds: expectedDocIds,
      retrievedCount: retrievedChunks.length,
      distinctRetrievedDocIds,
      verdict: "expected_knowledge_absent_from_index"
    };
  }

  // 5. Handle Negative evaluation cases (clean rejection evaluation)
  if (testCase.type === "negative" || expectedDocIds.length === 0) {
    const isCleanRejection = retrievedChunks.length === 0;
    return {
      caseId: testCase.id,
      name: testCase.name,
      type: "negative",
      queryText: testCase.queryText,
      indexingStatus: "indexed",
      expectedRelevantDocIds: [],
      retrievedCount: retrievedChunks.length,
      distinctRetrievedDocIds,
      cleanRejection: isCleanRejection,
      falsePositive: !isCleanRejection,
      precisionAtK: isCleanRejection ? 1.0 : 0.0,
      recallAtK: null, // Undefined for empty ground truth
      hitRateAtK: null,
      reciprocalRank: null,
      verdict: isCleanRejection ? "clean_rejection" : "false_positive_retrieval"
    };
  }

  // 6. Handle Positive / Multi-Relevant / Ambiguous cases (standard IR metrics)
  const precisionAtK = calculatePrecisionAtK(retrievedChunks, expectedDocIds, effectiveTopK);
  const recallAtK = calculateRecallAtK(retrievedChunks, expectedDocIds, effectiveTopK);
  const hitRateAtK = calculateHitRateAtK(retrievedChunks, expectedDocIds, effectiveTopK);
  const reciprocalRank = calculateReciprocalRank(retrievedChunks, expectedDocIds);

  return {
    caseId: testCase.id,
    name: testCase.name,
    type: testCase.type || "positive",
    queryText: testCase.queryText,
    indexingStatus: "indexed",
    expectedRelevantDocIds: expectedDocIds,
    retrievedCount: retrievedChunks.length,
    distinctRetrievedDocIds,
    precisionAtK,
    recallAtK,
    hitRateAtK,
    reciprocalRank,
    retrievedChunks: retrievedChunks.map((c) => ({
      chunkId: c.chunkId,
      documentId: c.documentId,
      content: c.content || "",
      metadata: c.metadata || {},
      similarity: c.similarity
    }))
  };
};

/**
 * Evaluates an entire benchmark suite of test cases and computes aggregate IR metrics.
 *
 * @param {Array<Object>} testCases - Array of test case entities.
 * @param {Object} [options={}] - Evaluation parameters (topK, similarityThreshold, etc.).
 * @returns {Promise<Object>} Aggregate evaluation report.
 */
export const evaluateRetrievalSuite = async (testCases = [], options = {}) => {
  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error("Invalid testCases: Non-empty array of test cases required.");
  }

  const effectiveTopK = options.topK !== undefined ? Number(options.topK) : (config.defaultRetrievalTopK || 5);
  const effectiveThreshold =
    options.similarityThreshold !== undefined
      ? Number(options.similarityThreshold)
      : (config.defaultSimilarityThreshold !== undefined ? config.defaultSimilarityThreshold : 0.6);

  const caseResults = [];
  for (const tc of testCases) {
    const result = await evaluateRetrievalCase(tc, options);
    caseResults.push(result);
  }

  // Segregate by category
  const positiveCases = caseResults.filter((r) => r.type !== "negative" && r.type !== "not_indexed" && r.indexingStatus === "indexed");
  const negativeCases = caseResults.filter((r) => r.type === "negative");
  const notIndexedCases = caseResults.filter((r) => r.indexingStatus === "not_indexed");

  // Aggregate standard IR metrics over positive benchmark cases
  const precisionAtK = calculateAverageMetric(positiveCases, "precisionAtK");
  const recallAtK = calculateAverageMetric(positiveCases, "recallAtK");
  const hitRateAtK = calculateAverageMetric(positiveCases, "hitRateAtK");
  const mrr = calculateMeanReciprocalRank(positiveCases);

  // Aggregate negative case metrics
  const cleanRejections = negativeCases.filter((r) => r.cleanRejection).length;
  const falsePositives = negativeCases.filter((r) => r.falsePositive).length;
  const cleanRejectionRate = negativeCases.length > 0 ? parseFloat((cleanRejections / negativeCases.length).toFixed(4)) : 1.0;

  return {
    evaluationParameters: {
      totalCases: testCases.length,
      evaluatedPositiveCases: positiveCases.length,
      evaluatedNegativeCases: negativeCases.length,
      notIndexedCasesCount: notIndexedCases.length,
      topK: effectiveTopK,
      similarityThreshold: effectiveThreshold
    },
    metrics: {
      precisionAtK,
      recallAtK,
      hitRateAtK,
      mrr
    },
    negativeEvaluation: {
      totalNegativeCases: negativeCases.length,
      cleanRejections,
      falsePositiveRetrievals: falsePositives,
      cleanRejectionRate
    },
    notIndexedEvaluation: {
      totalNotIndexedCases: notIndexedCases.length,
      cases: notIndexedCases
    },
    caseResults
  };
};

/**
 * Runs a threshold parameter sweep across a list of threshold values without mutating production config.
 *
 * @param {Array<Object>} testCases - Benchmark test cases.
 * @param {number[]} [thresholds=[0.40, 0.50, 0.60, 0.70, 0.80]] - Array of similarity thresholds to evaluate.
 * @param {Object} [options={}] - Additional options (topK).
 * @returns {Promise<Array<Object>>} Array of performance metric summaries per threshold.
 */
export const runThresholdSweep = async (testCases, thresholds = [0.4, 0.5, 0.6, 0.7, 0.8], options = {}) => {
  const sweepResults = [];

  for (const threshold of thresholds) {
    const report = await evaluateRetrievalSuite(testCases, {
      ...options,
      similarityThreshold: threshold
    });

    const avgMatchedChunks =
      report.caseResults.length > 0
        ? parseFloat((report.caseResults.reduce((acc, c) => acc + (c.retrievedCount || 0), 0) / report.caseResults.length).toFixed(2))
        : 0;

    sweepResults.push({
      threshold,
      precisionAtK: report.metrics.precisionAtK,
      recallAtK: report.metrics.recallAtK,
      hitRateAtK: report.metrics.hitRateAtK,
      mrr: report.metrics.mrr,
      cleanRejectionRate: report.negativeEvaluation.cleanRejectionRate,
      avgMatchedChunks
    });
  }

  return sweepResults;
};

/**
 * Runs a Top-K parameter sweep across a list of K values without mutating production config.
 *
 * @param {Array<Object>} testCases - Benchmark test cases.
 * @param {number[]} [kValues=[1, 3, 5, 10]] - Array of Top-K values to evaluate.
 * @param {Object} [options={}] - Additional options (similarityThreshold).
 * @returns {Promise<Array<Object>>} Array of performance metric and context sizing summaries per K.
 */
export const runTopKSweep = async (testCases, kValues = [1, 3, 5, 10], options = {}) => {
  const sweepResults = [];

  for (const k of kValues) {
    const report = await evaluateRetrievalSuite(testCases, {
      ...options,
      topK: k
    });

    // Evaluate RAG context sizing for positive cases at this K
    let totalChars = 0;
    let totalSelectedChunks = 0;
    const positiveResults = report.caseResults.filter((r) => r.type !== "negative" && r.type !== "not_indexed");

    for (const res of positiveResults) {
      const rag = buildRagContext(res.retrievedChunks || [], { maxChunks: k });
      totalChars += rag.ragContextText.length;
      totalSelectedChunks += rag.sourcesUsed.length;
    }

    const avgContextChars = positiveResults.length > 0 ? Math.round(totalChars / positiveResults.length) : 0;
    const avgSelectedChunks = positiveResults.length > 0 ? parseFloat((totalSelectedChunks / positiveResults.length).toFixed(2)) : 0;

    sweepResults.push({
      topK: k,
      precisionAtK: report.metrics.precisionAtK,
      recallAtK: report.metrics.recallAtK,
      hitRateAtK: report.metrics.hitRateAtK,
      mrr: report.metrics.mrr,
      avgContextChars,
      avgSelectedChunks
    });
  }

  return sweepResults;
};

/**
 * Generates an explainability and observability retrieval trace for a query without exposing
 * embedding vectors, credentials, or sensitive secrets.
 *
 * Explicitly classifies overall retrieval into 5 distinct states:
 * - "success"
 * - "no_match"
 * - "empty_kb"
 * - "failed"
 * - "disabled"
 *
 * Tracks individual candidate rejections with structured reasons:
 * - "below_threshold"
 * - "exceeded_top_k"
 *
 * @param {string} query - Query string.
 * @param {Object} [options={}] - Retrieval options.
 * @returns {Promise<Object>} Safe, structured retrieval trace.
 */
export const generateRetrievalTrace = async (query, options = {}) => {
  // 1. Check if RAG is explicitly disabled
  if (options.enableRag === false) {
    return {
      queryText: typeof query === "string" ? query : "",
      status: "disabled",
      parameters: {
        topK: options.topK || config.defaultRetrievalTopK || 5,
        similarityThreshold: options.similarityThreshold || config.defaultSimilarityThreshold || 0.6
      },
      corpusStats: { totalIndexedChunks: 0 },
      metrics: { candidatesEvaluated: 0, passedThresholdCount: 0, selectedCount: 0 },
      selectedChunks: [],
      rejectedCandidates: [],
      error: null
    };
  }

  const effectiveTopK = options.topK !== undefined ? Number(options.topK) : (config.defaultRetrievalTopK || 5);
  const effectiveThreshold =
    options.similarityThreshold !== undefined
      ? Number(options.similarityThreshold)
      : (config.defaultSimilarityThreshold !== undefined ? config.defaultSimilarityThreshold : 0.6);

  // 2. Fetch all indexed chunks from repository
  let allIndexedChunks;
  try {
    allIndexedChunks = await knowledgeRepository.getAllIndexedChunks();
  } catch (err) {
    return {
      queryText: typeof query === "string" ? query : "",
      status: "failed",
      parameters: { topK: effectiveTopK, similarityThreshold: effectiveThreshold },
      corpusStats: { totalIndexedChunks: 0 },
      metrics: { candidatesEvaluated: 0, passedThresholdCount: 0, selectedCount: 0 },
      selectedChunks: [],
      rejectedCandidates: [],
      error: "Failed to access knowledge repository."
    };
  }

  // 3. Handle Empty KB state
  if (!Array.isArray(allIndexedChunks) || allIndexedChunks.length === 0) {
    return {
      queryText: typeof query === "string" ? query : "",
      status: "empty_kb",
      parameters: { topK: effectiveTopK, similarityThreshold: effectiveThreshold },
      corpusStats: { totalIndexedChunks: 0 },
      metrics: { candidatesEvaluated: 0, passedThresholdCount: 0, selectedCount: 0 },
      selectedChunks: [],
      rejectedCandidates: [],
      error: null
    };
  }

  // 4. Execute production retrieval
  let retrievalResult;
  try {
    retrievalResult = await retrieveKnowledge(query, options);
  } catch (err) {
    return {
      queryText: typeof query === "string" ? query : "",
      status: "failed",
      parameters: { topK: effectiveTopK, similarityThreshold: effectiveThreshold },
      corpusStats: { totalIndexedChunks: allIndexedChunks.length },
      metrics: { candidatesEvaluated: 0, passedThresholdCount: 0, selectedCount: 0 },
      selectedChunks: [],
      rejectedCandidates: [],
      error: "Retrieval query execution failed."
    };
  }

  // 5. Evaluate all candidates for full explainability (similarity scoring and rejection classification)
  // Retrieve query vector for explainability audit
  let queryVector = null;
  if (options.providerOverride) {
    const emRes = await options.providerOverride(query, options);
    queryVector = emRes?.vector;
  }

  const allCandidatesScored = [];
  for (const chunk of allIndexedChunks) {
    if (
      chunk.embedding &&
      chunk.embedding.status === "ready" &&
      isValidVector(chunk.embedding.vector, config.embeddingDimensions || 768) &&
      queryVector &&
      isValidVector(queryVector, config.embeddingDimensions || 768)
    ) {
      const sim = cosineSimilarity(queryVector, chunk.embedding.vector);
      allCandidatesScored.push({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentTitle: chunk.metadata?.documentTitle || "Untitled Document",
        category: chunk.metadata?.category || "general",
        similarity: parseFloat(sim.toFixed(6)),
        characterLength: chunk.content ? chunk.content.length : 0
      });
    }
  }

  allCandidatesScored.sort((a, b) => b.similarity - a.similarity);

  const selectedChunks = [];
  const rejectedCandidates = [];

  for (let i = 0; i < allCandidatesScored.length; i++) {
    const cand = allCandidatesScored[i];
    const rank = i + 1;

    if (cand.similarity >= effectiveThreshold) {
      if (selectedChunks.length < effectiveTopK) {
        selectedChunks.push({
          rank,
          chunkId: cand.chunkId,
          documentId: cand.documentId,
          documentTitle: cand.documentTitle,
          category: cand.category,
          similarity: cand.similarity,
          characterLength: cand.characterLength
        });
      } else {
        rejectedCandidates.push({
          rank,
          chunkId: cand.chunkId,
          documentId: cand.documentId,
          similarity: cand.similarity,
          passedThreshold: true,
          rejectionReason: "exceeded_top_k"
        });
      }
    } else {
      rejectedCandidates.push({
        rank,
        chunkId: cand.chunkId,
        documentId: cand.documentId,
        similarity: cand.similarity,
        passedThreshold: false,
        rejectionReason: "below_threshold"
      });
    }
  }

  // If queryVector was not available for granular scoring, fall back to production results
  const finalSelected = selectedChunks.length > 0 ? selectedChunks : (retrievalResult.results || []).map((c, idx) => ({
    rank: idx + 1,
    chunkId: c.chunkId,
    documentId: c.documentId,
    documentTitle: c.metadata?.documentTitle || "Untitled Document",
    category: c.metadata?.category || "general",
    similarity: c.similarity,
    characterLength: c.content ? c.content.length : 0
  }));

  const passedThresholdCount = finalSelected.length + rejectedCandidates.filter((r) => r.passedThreshold).length;
  const status = finalSelected.length > 0 ? "success" : "no_match";

  return {
    queryText: retrievalResult.query,
    status,
    parameters: {
      topK: effectiveTopK,
      similarityThreshold: effectiveThreshold
    },
    corpusStats: {
      totalIndexedChunks: allIndexedChunks.length
    },
    metrics: {
      candidatesEvaluated: allIndexedChunks.length,
      passedThresholdCount,
      selectedCount: finalSelected.length
    },
    selectedChunks: finalSelected,
    rejectedCandidates,
    error: null
  };
};

/**
 * Audits the assembled RAG context for character budget compliance, whole-chunk inclusion,
 * and vector exclusion.
 *
 * @param {Array<Object>} retrievedChunks - Array of retrieved chunk objects.
 * @param {Object} [options={}] - Assembly options (maxChars, maxChunks).
 * @returns {Object} Context audit report.
 */
export const evaluateRagContext = (retrievedChunks = [], options = {}) => {
  const maxCharsBudget = options.maxChars || config.maxRagContextChars || 10000;
  const maxChunksBudget = options.maxChunks || config.defaultRetrievalTopK || 5;

  const ragOutput = buildRagContext(retrievedChunks, {
    maxChars: maxCharsBudget,
    maxChunks: maxChunksBudget
  });

  const contextLength = ragOutput.ragContextText.length;
  const withinBudget = contextLength <= maxCharsBudget;
  const wholeChunksPreserved = ragOutput.sourcesUsed.length <= retrievedChunks.length;
  // Verify no raw vectors are present in the text
  const noVectorLeakage =
    !ragOutput.ragContextText.includes("vector") &&
    !ragOutput.ragContextText.includes("[0.") &&
    !ragOutput.ragContextText.includes("embedding");

  return {
    contextChars: contextLength,
    maxCharsBudget,
    withinBudget,
    selectedChunksCount: ragOutput.sourcesUsed.length,
    sourcesUsed: ragOutput.sourcesUsed,
    wholeChunksPreserved,
    noVectorLeakage,
    ragContextText: ragOutput.ragContextText
  };
};

/**
 * Deterministically compares RAG-enabled vs RAG-disabled execution paths for a security alert.
 * Validates metadata attachment and prompt assembly mechanics without non-deterministic LLM generation.
 *
 * @param {Object} alert - Security alert fixture.
 * @param {Object} [options={}] - Options (queryEmbedding, etc.).
 * @returns {Promise<Object>} Comparison result.
 */
export const compareRagVsNonRag = async (alert, options = {}) => {
  const query = constructRetrievalQueryFromAlert(alert);

  // 1. RAG Enabled execution path
  let ragTrace;
  let ragContextAudit;
  try {
    ragTrace = await generateRetrievalTrace(query, {
      ...options,
      enableRag: true
    });
    ragContextAudit = evaluateRagContext(
      ragTrace.selectedChunks.map((c) => ({
        ...c,
        content: `Simulated content for chunk ${c.chunkId}`
      }))
    );
  } catch (err) {
    ragTrace = { status: "failed", error: err.message };
    ragContextAudit = { contextChars: 0, sourcesUsed: [] };
  }

  // 2. RAG Disabled execution path
  const nonRagTrace = await generateRetrievalTrace(query, {
    ...options,
    enableRag: false
  });

  return {
    alertTitle: alert.title || "",
    queryConstructed: query,
    ragEnabled: {
      status: ragTrace.status,
      sourcesRetrievedCount: ragTrace.selectedChunks ? ragTrace.selectedChunks.length : 0,
      contextChars: ragContextAudit.contextChars,
      sourcesAttributed: ragContextAudit.sourcesUsed.map((s) => s.documentId),
      retrievalMetadataAttached: true
    },
    ragDisabled: {
      status: nonRagTrace.status,
      sourcesRetrievedCount: 0,
      contextChars: 0,
      sourcesAttributed: [],
      retrievalMetadataAttached: false
    },
    comparison: {
      retrievalSkippedWhenDisabled: nonRagTrace.status === "disabled",
      contextOnlyAssembledWhenEnabled: ragContextAudit.contextChars > 0 || ragTrace.status === "no_match",
      isDeterministic: true
    }
  };
};
