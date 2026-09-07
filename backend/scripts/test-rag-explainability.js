/**
 * Automated Test Suite: Module 3.21 - RAG Explainability, Traces & Context Evaluation
 *
 * Tests:
 * 1. Retrieval trace generation across all 5 top-level states:
 *    - "success"
 *    - "no_match"
 *    - "empty_kb"
 *    - "failed"
 *    - "disabled"
 * 2. Candidate-level rejection classification:
 *    - "below_threshold"
 *    - "exceeded_top_k"
 * 3. Security & data protection:
 *    - Zero raw vector leakage in trace
 *    - Zero API key / secret leakage
 * 4. RAG context evaluation:
 *    - Character budget enforcement (<= 10,000 chars)
 *    - Whole-chunk inclusion policy
 *    - Source attribution integrity
 * 5. Deterministic RAG vs Non-RAG pipeline comparison
 */

import { knowledgeRepository } from "../src/repositories/knowledge.repository.js";
import {
  benchmarkDocuments,
  createDeterministicVector
} from "../src/fixtures/retrieval-evaluation.fixtures.js";
import {
  generateRetrievalTrace,
  evaluateRagContext,
  compareRagVsNonRag
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
  console.log("\n==========================================================");
  console.log(" ALERT-IQ MODULE 3.21: RAG EXPLAINABILITY & TRACE TESTS   ");
  console.log("==========================================================\n");

  // -------------------------------------------------------------
  // Section 1: Setup Repository & Test Empty KB State
  // -------------------------------------------------------------
  console.log("--- Section 1: Empty KB State Trace ---");
  await knowledgeRepository.clear();

  const emptyTrace = await generateRetrievalTrace("ransomware alert", {
    enableRag: true
  });
  assert(emptyTrace.status === "empty_kb", `Empty repository generates status "empty_kb" (got "${emptyTrace.status}")`);
  assert(emptyTrace.selectedChunks.length === 0, "Empty KB trace contains 0 selected chunks");
  assert(emptyTrace.corpusStats.totalIndexedChunks === 0, "Corpus stats report 0 indexed chunks");

  // -------------------------------------------------------------
  // Section 2: Disabled RAG State
  // -------------------------------------------------------------
  console.log("\n--- Section 2: Disabled RAG State Trace ---");
  const disabledTrace = await generateRetrievalTrace("ransomware alert", {
    enableRag: false
  });
  assert(disabledTrace.status === "disabled", `Disabled RAG generates status "disabled" (got "${disabledTrace.status}")`);
  assert(disabledTrace.selectedChunks.length === 0, "Disabled RAG trace contains 0 selected chunks");
  assert(disabledTrace.rejectedCandidates.length === 0, "Disabled RAG trace contains 0 rejected candidates");

  // -------------------------------------------------------------
  // Section 3: Load Documents & Test Success & No-Match States
  // -------------------------------------------------------------
  console.log("\n--- Section 3: Success & No-Match Trace States ---");
  for (const doc of benchmarkDocuments) {
    await knowledgeRepository.create(
      {
        id: doc.id,
        title: doc.title,
        source: doc.source,
        category: doc.category,
        content: doc.content,
        metadata: { category: doc.category, source: doc.source }
      },
      doc.chunks
    );
  }

  // 3.1 Success State
  const rwVector = createDeterministicVector(0, 0.05);
  const successTrace = await generateRetrievalTrace("ransomware isolation query", {
    topK: 2,
    similarityThreshold: 0.6,
    providerOverride: async () => ({
      model: "gemini-embedding-2",
      dimensions: 768,
      vector: rwVector
    })
  });

  assert(successTrace.status === "success", `Relevant query generates status "success" (got "${successTrace.status}")`);
  assert(successTrace.selectedChunks.length === 2, `Selected Top-2 chunks (got ${successTrace.selectedChunks.length})`);
  assert(successTrace.selectedChunks[0].rank === 1, "Selected chunk 1 has rank 1");
  assert(successTrace.selectedChunks[0].similarity > 0.8, `Selected chunk has high similarity (got ${successTrace.selectedChunks[0].similarity})`);
  assert(successTrace.selectedChunks[0].documentId === "doc-ir-ransomware-01", "Selected chunk attributes documentId correctly");

  // 3.2 Candidate Rejections
  const belowThresholdCandidates = successTrace.rejectedCandidates.filter((c) => c.rejectionReason === "below_threshold");
  assert(belowThresholdCandidates.length > 0, `Recorded ${belowThresholdCandidates.length} candidate rejections for "below_threshold"`);
  assert(belowThresholdCandidates[0].passedThreshold === false, "Below threshold candidate has passedThreshold: false");

  // 3.3 Exceeded Top-K Rejection
  // With TopK = 1, chunk 2 should be rejected with exceeded_top_k if similarity >= threshold
  const top1Trace = await generateRetrievalTrace("ransomware isolation query", {
    topK: 1,
    similarityThreshold: 0.6,
    providerOverride: async () => ({
      model: "gemini-embedding-2",
      dimensions: 768,
      vector: rwVector
    })
  });

  const exceededTopK = top1Trace.rejectedCandidates.filter((c) => c.rejectionReason === "exceeded_top_k");
  assert(exceededTopK.length >= 1, `Candidate exceeding Top-1 recorded with reason "exceeded_top_k" (found ${exceededTopK.length})`);
  assert(exceededTopK[0].passedThreshold === true, "exceeded_top_k candidate passedThreshold is true");

  // 3.4 No-Match State
  const orthoVector = createDeterministicVector(8, 0); // Orthogonal cluster
  const noMatchTrace = await generateRetrievalTrace("unrelated marketing inquiry", {
    topK: 5,
    similarityThreshold: 0.7,
    providerOverride: async () => ({
      model: "gemini-embedding-2",
      dimensions: 768,
      vector: orthoVector
    })
  });

  assert(noMatchTrace.status === "no_match", `Unrelated query generates status "no_match" (got "${noMatchTrace.status}")`);
  assert(noMatchTrace.selectedChunks.length === 0, "No-match trace has 0 selected chunks");
  assert(noMatchTrace.rejectedCandidates.length === 6, "All 6 candidates recorded as rejected below threshold");

  // -------------------------------------------------------------
  // Section 4: Security & Sensitive Field Exclusion
  // -------------------------------------------------------------
  console.log("\n--- Section 4: Security & Vector/Secret Exclusion ---");
  const traceStr = JSON.stringify(successTrace);

  assert(!traceStr.includes("vector"), "Retrieval trace contains no raw 'vector' keys");
  assert(!traceStr.includes("geminiApiKey"), "Retrieval trace contains no API keys");
  assert(!traceStr.includes("AIza"), "Retrieval trace contains no Google API key patterns");
  assert(!traceStr.includes("Bearer"), "Retrieval trace contains no auth bearer tokens");

  // -------------------------------------------------------------
  // Section 5: RAG Context Evaluation
  // -------------------------------------------------------------
  console.log("\n--- Section 5: RAG Context Budget & Whole Chunk Audit ---");

  const sampleChunks = [
    {
      id: "chunk-rw-01",
      documentId: "doc-ir-ransomware-01",
      content: "Isolate infected hosts immediately. Terminate suspicious processes.",
      metadata: { documentTitle: "Ransomware Runbook", category: "incident_response" },
      similarity: 0.942
    },
    {
      id: "chunk-rw-02",
      documentId: "doc-ir-ransomware-01",
      content: "Check Volume Shadow Copies and disable compromised AD accounts.",
      metadata: { documentTitle: "Ransomware Runbook", category: "incident_response" },
      similarity: 0.915
    }
  ];

  // 5.1 Standard Context Assembly
  const contextAudit = evaluateRagContext(sampleChunks, { maxChars: 10000 });
  assert(contextAudit.withinBudget === true, "RAG context is within 10,000 character budget");
  assert(contextAudit.contextChars > 0, `RAG context generated ${contextAudit.contextChars} characters`);
  assert(contextAudit.sourcesUsed.length === 2, "Both source chunks attributed");
  assert(contextAudit.noVectorLeakage === true, "Assembled markdown contains no vector data or float arrays");

  // 5.2 Whole Chunk Budget Enforcement
  const tightAudit = evaluateRagContext(sampleChunks, { maxChars: 700 });
  assert(tightAudit.withinBudget === true, `Tight budget (700 chars) enforced (${tightAudit.contextChars} chars)`);
  assert(tightAudit.sourcesUsed.length === 1, "Only first complete chunk included to avoid partial slicing");
  assert(!tightAudit.ragContextText.includes("Check Volume"), "Second chunk omitted entirely rather than truncated mid-sentence");

  // 5.3 Empty Retrieval Handling
  const emptyContextAudit = evaluateRagContext([]);
  assert(emptyContextAudit.contextChars === 0, "Empty retrieval results produce 0 context chars");
  assert(emptyContextAudit.sourcesUsed.length === 0, "Empty retrieval results produce 0 sources");

  // -------------------------------------------------------------
  // Section 6: Deterministic RAG vs Non-RAG Pipeline Comparison
  // -------------------------------------------------------------
  console.log("\n--- Section 6: Deterministic RAG vs Non-RAG Pipeline Comparison ---");

  const mockAlert = {
    title: "Host Isolation Triggered by Ransomware Detector",
    severity: "CRITICAL",
    source: "CrowdStrike Falcon",
    description: "Suspicious encryption activity detected on Workstation WS-9014.",
    rawLogs: "Process vssadmin.exe delete shadows /all executed by SYSTEM."
  };

  const comparison = await compareRagVsNonRag(mockAlert, {
    similarityThreshold: 0.6,
    providerOverride: async () => ({
      model: "gemini-embedding-2",
      dimensions: 768,
      vector: rwVector
    })
  });

  assert(comparison.ragEnabled.status === "success", `RAG enabled pipeline status is "success" (got "${comparison.ragEnabled.status}")`);
  assert(comparison.ragEnabled.contextChars > 0, `RAG enabled pipeline generated context (${comparison.ragEnabled.contextChars} chars)`);
  assert(comparison.ragEnabled.retrievalMetadataAttached === true, "RAG enabled pipeline attaches retrieval metadata");
  assert(comparison.ragDisabled.status === "disabled", `RAG disabled pipeline status is "disabled" (got "${comparison.ragDisabled.status}")`);
  assert(comparison.ragDisabled.contextChars === 0, "RAG disabled pipeline generated 0 context chars");
  assert(comparison.ragDisabled.sourcesRetrievedCount === 0, "RAG disabled pipeline retrieved 0 sources");
  assert(comparison.comparison.retrievalSkippedWhenDisabled === true, "Retrieval is cleanly skipped when RAG is disabled");
  assert(comparison.comparison.isDeterministic === true, "Comparison executes deterministically without LLM generation");

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("\n==========================================================");
  console.log(` RAG EXPLAINABILITY & TRACE TEST SUMMARY`);
  console.log(` Passed: ${passedCount}`);
  console.log(` Failed: ${failedCount}`);
  console.log("==========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error("Test runner encountered an unhandled error:", err);
  process.exit(1);
});
