/**
 * Automated Test Suite: Module 3.21 - Retrieval Evaluation & Metrics
 *
 * Tests:
 * 1. Document-level Information Retrieval (IR) metric math & deduplication
 * 2. Precision@K, Recall@K, HitRate@K, Reciprocal Rank, and MRR
 * 3. Benchmark test case evaluation over cybersecurity fixtures
 * 4. Multi-relevant and ambiguous case handling
 * 5. Dedicated negative case clean rejection evaluation
 * 6. Not-indexed document case identification
 * 7. Threshold parameter sweep across [0.40, 0.50, 0.60, 0.70, 0.80]
 * 8. Top-K parameter sweep across [1, 3, 5, 10]
 * 9. Provider-independent deterministic execution
 */

import { knowledgeRepository } from "../src/repositories/knowledge.repository.js";
import {
  benchmarkDocuments,
  benchmarkTestCases
} from "../src/fixtures/retrieval-evaluation.fixtures.js";
import {
  extractDistinctDocumentIds,
  calculatePrecisionAtK,
  calculateRecallAtK,
  calculateHitRateAtK,
  calculateReciprocalRank,
  calculateMeanReciprocalRank,
  calculateAverageMetric
} from "../src/utils/retrieval-evaluation.utils.js";
import {
  evaluateRetrievalCase,
  evaluateRetrievalSuite,
  runThresholdSweep,
  runTopKSweep
} from "../src/services/retrieval-evaluation.service.js";

let passedCount = 0;
let failedCount = 0;

const assert = (condition, testName, details = "") => {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         Details: ${details}`);
    failedCount++;
  }
};

const runTests = async () => {
  console.log("\n=======================================================");
  console.log(" ALERT-IQ MODULE 3.21: RETRIEVAL EVALUATION TEST SUITE ");
  console.log("=======================================================\n");

  // -------------------------------------------------------------
  // Section 1: IR Metric Utilities & Document-Level Deduplication
  // -------------------------------------------------------------
  console.log("--- Section 1: IR Metric Utilities & Deduplication ---");

  // 1.1 extractDistinctDocumentIds
  const duplicateChunks = [
    { chunkId: "c1", documentId: "doc-A" },
    { chunkId: "c2", documentId: "doc-A" },
    { chunkId: "c3", documentId: "doc-B" },
    { chunkId: "c4", documentId: "doc-A" },
    { chunkId: "c5", documentId: "doc-C" }
  ];
  const distinctIds = extractDistinctDocumentIds(duplicateChunks);
  assert(
    distinctIds.length === 3 && distinctIds[0] === "doc-A" && distinctIds[1] === "doc-B" && distinctIds[2] === "doc-C",
    "extractDistinctDocumentIds deduplicates chunks while preserving rank order"
  );
  assert(extractDistinctDocumentIds([]).length === 0, "extractDistinctDocumentIds handles empty array safely");
  assert(extractDistinctDocumentIds(null).length === 0, "extractDistinctDocumentIds handles null safely");

  // 1.2 calculatePrecisionAtK
  // 3 distinct retrieved docs: doc-A, doc-B, doc-C. Expected: doc-A, doc-B. Precision = 2/3 = 0.6667
  const p1 = calculatePrecisionAtK(duplicateChunks, ["doc-A", "doc-B"], 5);
  assert(p1 === 0.6667, `calculatePrecisionAtK computes 2/3 = 0.6667 (got ${p1})`);

  // Multiple chunks of same relevant doc shouldn't inflate precision denominator
  const singleDocChunks = [
    { chunkId: "c1", documentId: "doc-A" },
    { chunkId: "c2", documentId: "doc-A" },
    { chunkId: "c3", documentId: "doc-A" }
  ];
  const pSingle = calculatePrecisionAtK(singleDocChunks, ["doc-A"], 3);
  assert(pSingle === 1.0, `calculatePrecisionAtK returns 1.0 for single doc with 3 chunks (got ${pSingle})`);

  // Safe zero handling
  assert(calculatePrecisionAtK([], ["doc-A"]) === 0.0, "calculatePrecisionAtK returns 0.0 for empty chunks");
  assert(calculatePrecisionAtK(duplicateChunks, ["doc-X"]) === 0.0, "calculatePrecisionAtK returns 0.0 for zero matches");

  // 1.3 calculateRecallAtK
  // 2 expected docs: doc-A, doc-Z. Retrieved docs: doc-A, doc-B, doc-C. Recall = 1/2 = 0.5
  const r1 = calculateRecallAtK(duplicateChunks, ["doc-A", "doc-Z"], 5);
  assert(r1 === 0.5, `calculateRecallAtK computes 1/2 = 0.5 (got ${r1})`);

  // Empty ground truth returns null (not 0 or NaN)
  assert(calculateRecallAtK(duplicateChunks, []) === null, "calculateRecallAtK returns null for empty expectedDocIds");

  // 1.4 calculateHitRateAtK
  assert(calculateHitRateAtK(duplicateChunks, ["doc-A"]) === 1.0, "calculateHitRateAtK returns 1.0 on hit");
  assert(calculateHitRateAtK(duplicateChunks, ["doc-X"]) === 0.0, "calculateHitRateAtK returns 0.0 on no hit");
  assert(calculateHitRateAtK(duplicateChunks, []) === null, "calculateHitRateAtK returns null for empty expectedDocIds");

  // 1.5 calculateReciprocalRank & calculateMeanReciprocalRank
  // Distinct retrieved docs: doc-A (rank 1), doc-B (rank 2), doc-C (rank 3).
  // First relevant doc (doc-B) is at distinct document rank 2 -> RR = 1/2 = 0.5
  const rr1 = calculateReciprocalRank(duplicateChunks, ["doc-B"]);
  assert(rr1 === 0.5, `calculateReciprocalRank computes document-level RR 1/2 = 0.5 (got ${rr1})`);

  // Multiple chunks of preceding irrelevant doc do not push doc-B to rank 3
  const multiIrrelevantChunks = [
    { chunkId: "c1", documentId: "doc-A" },
    { chunkId: "c2", documentId: "doc-A" },
    { chunkId: "c3", documentId: "doc-A" },
    { chunkId: "c4", documentId: "doc-B" }
  ];
  const rrMulti = calculateReciprocalRank(multiIrrelevantChunks, ["doc-B"]);
  assert(rrMulti === 0.5, `Multi-chunk doc-A does not penalize doc-B past document rank 2 (got ${rrMulti})`);

  const mockCaseResults = [
    { reciprocalRank: 1.0 }, // rank 1
    { reciprocalRank: 0.5 }, // rank 2
    { reciprocalRank: 0.0 }, // not found
    { reciprocalRank: null } // negative case (should be excluded)
  ];
  const mrr = calculateMeanReciprocalRank(mockCaseResults);
  assert(mrr === 0.5, `calculateMeanReciprocalRank computes (1.0 + 0.5 + 0.0)/3 = 0.5 (got ${mrr})`);

  // -------------------------------------------------------------
  // Section 2: Loading Deterministic Benchmark Knowledge Base
  // -------------------------------------------------------------
  console.log("\n--- Section 2: Benchmark Knowledge Base Setup ---");
  await knowledgeRepository.clear();

  for (const doc of benchmarkDocuments) {
    await knowledgeRepository.create(
      {
        id: doc.id,
        title: doc.title,
        source: doc.source,
        category: doc.category,
        content: doc.content,
        metadata: { category: doc.category, source: doc.source },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      doc.chunks
    );
  }

  const allIndexed = await knowledgeRepository.getAllIndexedChunks();
  assert(allIndexed.length === 6, `Knowledge base loaded with 6 deterministic benchmark chunks across 5 docs (got ${allIndexed.length})`);

  // -------------------------------------------------------------
  // Section 3: Benchmark Test Case Evaluation
  // -------------------------------------------------------------
  console.log("\n--- Section 3: Benchmark Test Case Evaluation ---");

  // 3.1 Case 1: Ransomware (Positive Single)
  const case1 = benchmarkTestCases.find((c) => c.id === "case-01-ransomware-positive");
  const res1 = await evaluateRetrievalCase(case1, { topK: 5, similarityThreshold: 0.6 });
  assert(res1.precisionAtK === 1.0, `Case 1 Precision@5 is 1.0 (got ${res1.precisionAtK})`);
  assert(res1.recallAtK === 1.0, `Case 1 Recall@5 is 1.0 (got ${res1.recallAtK})`);
  assert(res1.hitRateAtK === 1.0, `Case 1 HitRate@5 is 1.0 (got ${res1.hitRateAtK})`);
  assert(res1.reciprocalRank === 1.0, `Case 1 RR is 1.0 (got ${res1.reciprocalRank})`);
  assert(res1.distinctRetrievedDocIds.includes("doc-ir-ransomware-01"), "Case 1 retrieved expected ransomware document");

  // 3.2 Case 6: Multi-Relevant (PowerShell + Ransomware)
  const case6 = benchmarkTestCases.find((c) => c.id === "case-06-multi-relevant");
  const res6 = await evaluateRetrievalCase(case6, { topK: 5, similarityThreshold: 0.55 });
  assert(res6.hitRateAtK === 1.0, `Case 6 Multi-Relevant HitRate is 1.0 (got ${res6.hitRateAtK})`);
  assert(res6.recallAtK >= 0.5, `Case 6 Multi-Relevant Recall >= 0.5 (got ${res6.recallAtK})`);
  assert(res6.distinctRetrievedDocIds.length >= 1, `Case 6 retrieved multi-topic chunks (retrieved ${res6.distinctRetrievedDocIds.length} distinct docs)`);

  // 3.3 Case 8 & 9: Negative Cases (Office Printer & Marketing Email)
  const case8 = benchmarkTestCases.find((c) => c.id === "case-08-negative-printer");
  const res8 = await evaluateRetrievalCase(case8, { topK: 5, similarityThreshold: 0.6 });
  assert(res8.cleanRejection === true, "Case 8 Negative query resulted in clean rejection (0 docs retrieved)");
  assert(res8.falsePositive === false, "Case 8 Negative query did not produce false positive");
  assert(res8.precisionAtK === 1.0, "Case 8 Negative query Precision is 1.0 for clean rejection");
  assert(res8.recallAtK === null, "Case 8 Negative query Recall is null");
  assert(res8.reciprocalRank === null, "Case 8 Negative query RR is null");

  // 3.4 Case 10: Not-Indexed Case (AWS IAM Compromise)
  const case10 = benchmarkTestCases.find((c) => c.id === "case-10-not-indexed-cloud-iam");
  const res10 = await evaluateRetrievalCase(case10, { topK: 5, similarityThreshold: 0.6 });
  assert(res10.indexingStatus === "not_indexed", "Case 10 correctly classified as not_indexed");
  assert(res10.missingDocIds.includes("doc-ir-aws-iam-unindexed-99"), "Case 10 accurately identified missing document ID");
  assert(res10.verdict === "expected_knowledge_absent_from_index", "Case 10 assigned correct verdict");

  // -------------------------------------------------------------
  // Section 4: Full Benchmark Suite Evaluation
  // -------------------------------------------------------------
  console.log("\n--- Section 4: Full Benchmark Suite Evaluation ---");
  const startTime = Date.now();
  const suiteReport = await evaluateRetrievalSuite(benchmarkTestCases, {
    topK: 5,
    similarityThreshold: 0.6
  });
  const elapsedMs = Date.now() - startTime;

  console.log(`  Benchmark Suite Execution Time: ${elapsedMs}ms`);
  assert(elapsedMs < 1000, `Benchmark execution completed swiftly (${elapsedMs}ms)`);
  assert(suiteReport.evaluationParameters.totalCases === 10, "Suite evaluated all 10 test cases");
  assert(suiteReport.evaluationParameters.evaluatedPositiveCases === 7, "Suite identified 7 positive/ambiguous benchmark cases");
  assert(suiteReport.evaluationParameters.evaluatedNegativeCases === 2, "Suite identified 2 negative cases");
  assert(suiteReport.evaluationParameters.notIndexedCasesCount === 1, "Suite identified 1 not-indexed case");

  assert(suiteReport.metrics.hitRateAtK >= 0.85, `Suite HitRate@5 is high (got ${suiteReport.metrics.hitRateAtK})`);
  assert(suiteReport.metrics.mrr >= 0.85, `Suite MRR is high (got ${suiteReport.metrics.mrr})`);
  assert(suiteReport.negativeEvaluation.cleanRejectionRate === 1.0, `Negative query clean rejection rate is 100% (got ${suiteReport.negativeEvaluation.cleanRejectionRate})`);

  // -------------------------------------------------------------
  // Section 5: Threshold Parameter Sweep
  // -------------------------------------------------------------
  console.log("\n--- Section 5: Threshold Parameter Sweep ---");
  const thresholds = [0.4, 0.5, 0.6, 0.7, 0.8];
  const thresholdSweep = await runThresholdSweep(benchmarkTestCases, thresholds, { topK: 5 });

  assert(thresholdSweep.length === 5, `Threshold sweep evaluated 5 points [0.40, 0.50, 0.60, 0.70, 0.80]`);

  for (const point of thresholdSweep) {
    console.log(
      `  Threshold ${point.threshold.toFixed(2)} -> Precision: ${point.precisionAtK.toFixed(4)}, Recall: ${point.recallAtK.toFixed(4)}, HitRate: ${point.hitRateAtK.toFixed(4)}, MRR: ${point.mrr.toFixed(4)}, RejectionRate: ${point.cleanRejectionRate.toFixed(4)}, AvgChunks: ${point.avgMatchedChunks}`
    );
    assert(typeof point.precisionAtK === "number", `Threshold ${point.threshold} produced valid precision`);
    assert(typeof point.cleanRejectionRate === "number", `Threshold ${point.threshold} produced valid rejection rate`);
  }

  // Higher threshold should yield stricter filtering (fewer avg matched chunks)
  const lowThresh = thresholdSweep.find((p) => p.threshold === 0.4);
  const highThresh = thresholdSweep.find((p) => p.threshold === 0.8);
  assert(
    highThresh.avgMatchedChunks <= lowThresh.avgMatchedChunks,
    `Higher threshold (0.80) retrieved fewer/equal average chunks than low threshold (0.40)`
  );

  // -------------------------------------------------------------
  // Section 6: Top-K Parameter Sweep
  // -------------------------------------------------------------
  console.log("\n--- Section 6: Top-K Parameter Sweep ---");
  const kValues = [1, 3, 5, 10];
  const topKSweep = await runTopKSweep(benchmarkTestCases, kValues, { similarityThreshold: 0.6 });

  assert(topKSweep.length === 4, `Top-K sweep evaluated 4 points [1, 3, 5, 10]`);

  for (const point of topKSweep) {
    console.log(
      `  K=${point.topK.toString().padEnd(2)} -> Precision: ${point.precisionAtK.toFixed(4)}, Recall: ${point.recallAtK.toFixed(4)}, HitRate: ${point.hitRateAtK.toFixed(4)}, MRR: ${point.mrr.toFixed(4)}, AvgContextChars: ${point.avgContextChars}, AvgSelectedChunks: ${point.avgSelectedChunks}`
    );
    assert(typeof point.precisionAtK === "number", `K=${point.topK} produced valid precision`);
    assert(point.avgContextChars <= 10000, `K=${point.topK} RAG context within 10,000 char budget (${point.avgContextChars} chars)`);
  }

  // Recall should be monotonically non-decreasing as K grows
  const k1 = topKSweep.find((p) => p.topK === 1);
  const k10 = topKSweep.find((p) => p.topK === 10);
  assert(k10.recallAtK >= k1.recallAtK, `Recall at K=10 (${k10.recallAtK}) >= Recall at K=1 (${k1.recallAtK})`);

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(` RETRIEVAL EVALUATION TEST SUMMARY`);
  console.log(` Passed: ${passedCount}`);
  console.log(` Failed: ${failedCount}`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error("Test runner encountered an unhandled error:", err);
  process.exit(1);
});
