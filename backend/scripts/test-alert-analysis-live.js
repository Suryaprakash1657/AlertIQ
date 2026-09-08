#!/usr/bin/env node

/**
 * AlertIQ Module 3.23.1 — Real Live AI/RAG End-to-End Verification
 *
 * Exercises the entire AlertIQ backend intelligence pipeline in a single Node.js process:
 * 1. Clears in-memory knowledge store
 * 2. Ingests 8 authoritative threat corpus documents with REAL Gemini embeddings (gemini-embedding-2)
 * 3. Verifies in-memory repository indexing and vector readiness
 * 4. Submits a realistic SSH brute-force security alert
 * 5. Generates REAL Gemini query embedding
 * 6. Performs REAL dense vector semantic retrieval
 * 7. Assembles REAL Markdown RAG context
 * 8. Generates REAL Gemini structured analysis (JSON schema)
 * 9. Validates schema, provenance, risk levels, and zero vector leakage
 * 10. Verifies RAG-disabled behavior (enableRag: false)
 */

import { clearKnowledgeBase } from "../src/services/knowledge.service.js";
import { ingestThreatCorpus, getThreatCorpusStatus } from "../src/services/threat-corpus.service.js";
import { knowledgeRepository } from "../src/repositories/knowledge.repository.js";
import { analyzeAlertPipeline } from "../src/services/alert-analysis.service.js";
import { config } from "../src/config/env.js";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

const runLiveVerification = async () => {
  console.log("===============================================================");
  console.log("     AlertIQ LIVE AI/RAG END-TO-END VERIFICATION               ");
  console.log("===============================================================");

  // 0. Configuration check
  if (!config.geminiApiKey || config.geminiApiKey.trim() === "" || config.geminiApiKey === "your_gemini_api_key_here") {
    console.error("[FATAL] GEMINI_API_KEY is not configured in backend/.env. Cannot perform live E2E verification.");
    process.exit(1);
  }

  console.log(`\nActive Live Environment:`);
  console.log(`  LLM Model:             ${config.geminiModel}`);
  console.log(`  Embedding Model:       ${config.geminiEmbeddingModel}`);
  console.log(`  Vector Dimensions:     ${config.embeddingDimensions}`);
  console.log(`  Retrieval Threshold:   ${config.defaultSimilarityThreshold}`);
  console.log(`  Default Top-K:         ${config.defaultRetrievalTopK}`);
  console.log("---------------------------------------------------------------");

  const startTime = Date.now();

  // 1. Clear in-memory repository
  console.log("\n[Stage 1] Resetting in-memory knowledge store...");
  await clearKnowledgeBase();

  // 2. Ingest threat corpus using real Gemini embeddings
  console.log("[Stage 2] Ingesting 8 production threat documents with live Gemini embeddings...");
  const corpusIngestionStart = Date.now();
  const ingestionResult = await ingestThreatCorpus({
    force: true,
    verbose: true
  });
  const corpusIngestionElapsed = ((Date.now() - corpusIngestionStart) / 1000).toFixed(2);

  assert(ingestionResult.total === 8, `Expected 8 documents, got ${ingestionResult.total}`);
  assert(ingestionResult.ingested === 8, `Expected 8 ingested, got ${ingestionResult.ingested}`);

  // 3. Verify in-process indexed chunks
  console.log(`\n[Stage 3] Verifying in-process vector readiness (${corpusIngestionElapsed}s)...`);
  const status = await getThreatCorpusStatus();
  assert(status.indexedCount === 8, `Expected 8 indexed in memory, got ${status.indexedCount}`);
  assert(status.missingCount === 0, `Expected 0 missing, got ${status.missingCount}`);

  const allIndexedChunks = await knowledgeRepository.getAllIndexedChunks();
  assert(allIndexedChunks.length > 0, "Repository must contain indexed chunks");
  console.log(`  Total Indexed Chunks in Memory: ${allIndexedChunks.length}`);

  // 4. Define realistic SSH brute-force alert
  const testAlert = {
    alertId: "LIVE-E2E-SSH-001",
    title: "Multiple Failed SSH Login Attempts",
    severity: "HIGH",
    source: "Linux Authentication Monitor",
    timestamp: new Date().toISOString(),
    description: "Multiple failed SSH authentication attempts were detected against a production Linux server.",
    sourceIp: "203.0.113.25",
    destinationIp: "10.0.0.15",
    targetHost: "prod-web-01",
    user: "admin",
    rawLogs: [
      "Failed password for admin from 203.0.113.25 port 42812 ssh2",
      "Failed password for admin from 203.0.113.25 port 42814 ssh2",
      "Failed password for admin from 203.0.113.25 port 42818 ssh2",
      "Failed password for admin from 203.0.113.25 port 42820 ssh2"
    ]
  };

  // 4b. Perform direct live semantic retrieval test using gemini-embedding-2
  console.log("\n[Stage 4] Testing live query embedding & semantic retrieval with gemini-embedding-2...");
  const queryEmbedStart = Date.now();
  const { constructRetrievalQueryFromAlert, buildRagContext } = await import("../src/utils/rag.utils.js");
  const { retrieveKnowledge } = await import("../src/services/retrieval.service.js");

  const queryText = constructRetrievalQueryFromAlert(testAlert);
  console.log(`  Constructed Query: "${queryText}"`);

  const directRetrieval = await retrieveKnowledge(queryText, {
    topK: 3,
    similarityThreshold: 0.60
  });
  const queryEmbedElapsed = ((Date.now() - queryEmbedStart) / 1000).toFixed(2);

  assert(directRetrieval.matchedCount > 0, "Direct live retrieval must find matches");
  const topMatch = directRetrieval.results[0];
  console.log(`  Live Retrieval Matched: ${directRetrieval.matchedCount} chunks (${queryEmbedElapsed}s)`);
  console.log(`  Top Match: [${topMatch.documentId}] "${topMatch.metadata?.documentTitle}" (similarity: ${topMatch.similarity})`);
  assert(topMatch.documentId === "doc-threat-nist-ssh-bruteforce-01", "Expected Top-1 document to be SSH brute force playbook");
  assert(topMatch.similarity >= 0.60 && topMatch.similarity <= 1.0, "Similarity must be within valid threshold");

  const assembledRag = buildRagContext(directRetrieval.results);
  assert(assembledRag.ragContextText.length > 50, "Assembled RAG context must be non-empty");
  console.log(`  Assembled RAG Context: ${assembledRag.ragContextText.length} characters`);

  // 5. Execute production alert analysis pipeline with RAG enabled
  console.log("\n[Stage 5] Running full production alert analysis pipeline (RAG: ENABLED)...");
  const pipelineStart = Date.now();
  const ragAnalysisResult = await analyzeAlertPipeline({
    alert: testAlert,
    prompt: "Investigate this SSH alert and provide prioritized containment recommendations.",
    enableRag: true
  });
  const pipelineElapsed = ((Date.now() - pipelineStart) / 1000).toFixed(2);

  // 6. Validate live RAG results
  console.log(`\n[Stage 6] Validating live RAG retrieval & structured output (${pipelineElapsed}s)...`);
  assert(ragAnalysisResult.success === true, "Analysis pipeline must succeed");

  const kc = ragAnalysisResult.knowledgeContext;
  assert(kc.status === "success", `Expected knowledgeContext.status 'success', got '${kc.status}'`);
  assert(kc.matchesFound > 0, "Expected at least 1 matching knowledge chunk");
  assert(kc.sourcesUsed.length > 0, "Expected at least 1 cited source");

  // Validate similarity values
  for (const src of kc.sourcesUsed) {
    assert(typeof src.similarity === "number" && !isNaN(src.similarity), "Similarity must be a finite number");
    assert(src.similarity >= -1.0 && src.similarity <= 1.0, `Similarity ${src.similarity} out of [-1, 1] range`);
  }

  // Check if expected SSH Brute Force document was retrieved
  const sshDocFound = kc.sourcesUsed.some(
    (src) => src.documentId === "doc-threat-nist-ssh-bruteforce-01" || src.title.toLowerCase().includes("ssh")
  );
  assert(sshDocFound, "Expected SSH brute-force threat document to be retrieved");

  // 7. Validate structured AI analysis schema
  const analysis = ragAnalysisResult.analysis;
  assert(typeof analysis.summary === "string" && analysis.summary.length > 20, "Summary missing or too short");
  assert(typeof analysis.riskAssessment === "object" && analysis.riskAssessment !== null, "riskAssessment missing");
  assert(
    ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(analysis.riskAssessment.level),
    `Invalid risk level: ${analysis.riskAssessment.level}`
  );
  assert(typeof analysis.riskAssessment.reasoning === "string", "Risk reasoning missing");
  assert(Array.isArray(analysis.keyIndicators) && analysis.keyIndicators.length > 0, "keyIndicators missing or empty");
  assert(Array.isArray(analysis.investigationSteps) && analysis.investigationSteps.length > 0, "investigationSteps missing or empty");
  assert(Array.isArray(analysis.recommendedActions) && analysis.recommendedActions.length > 0, "recommendedActions missing or empty");
  assert(Array.isArray(analysis.assumptions), "assumptions must be an array");
  assert(Array.isArray(analysis.limitations), "limitations must be an array");

  // 8. Vector Leakage Check
  const serialized = JSON.stringify(ragAnalysisResult);
  assert(!serialized.includes('"vector":['), "Raw vector arrays must never appear in response");
  assert(!serialized.includes(config.geminiApiKey), "API key must never appear in response");

  // 9. Verify RAG-disabled execution
  console.log("\n[Stage 6] Verifying RAG-disabled behavior (enableRag: false)...");
  const noRagResult = await analyzeAlertPipeline({
    alert: testAlert,
    enableRag: false
  });

  assert(noRagResult.success === true, "Non-RAG pipeline must succeed");
  assert(noRagResult.knowledgeContext.status === "disabled", `Expected status 'disabled', got '${noRagResult.knowledgeContext.status}'`);
  assert(noRagResult.knowledgeContext.matchesFound === 0, "Matches must be 0 when disabled");
  assert(noRagResult.knowledgeContext.sourcesUsed.length === 0, "sourcesUsed must be empty when disabled");
  assert(noRagResult.analysis.summary.length > 10, "Non-RAG analysis summary must be generated");

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // 10. Print final verification report
  console.log("\n===============================================================");
  console.log("          LIVE AI/RAG VERIFICATION REPORT                      ");
  console.log("===============================================================");
  console.log(`Gemini API:              PASS`);
  console.log(`Threat Corpus Ingestion: PASS (${corpusIngestionElapsed}s)`);
  console.log(`Indexed Documents:       ${status.indexedCount}`);
  console.log(`Indexed Chunks:          ${allIndexedChunks.length}`);
  console.log(`Query Embedding:         PASS`);
  console.log(`Semantic Retrieval:      PASS (${kc.matchesFound} matches found)`);
  console.log(`RAG Status:              ${kc.status}`);
  console.log(`Top Relevant Source:     ${kc.sourcesUsed[0]?.title} (score: ${kc.sourcesUsed[0]?.similarity.toFixed(4)})`);
  console.log(`RAG Context Assembly:    PASS`);
  console.log(`Structured AI Analysis:  PASS`);
  console.log(`Risk Level Assigned:     ${analysis.riskAssessment.level}`);
  console.log(`Schema Validation:       PASS`);
  console.log(`Vector Leakage Check:    PASS`);
  console.log(`RAG Disabled Test:       PASS`);
  console.log(`Total Live E2E Duration: ${totalElapsed}s`);
  console.log("===============================================================");
  console.log("RESULT: LIVE E2E PASS");
  console.log("===============================================================\n");

  console.log("--- Retrieved Sources Cited by AI ---");
  console.table(
    kc.sourcesUsed.map((s) => ({
      DocID: s.documentId,
      Title: s.title.length > 35 ? `${s.title.slice(0, 32)}...` : s.title,
      Source: s.source.length > 25 ? `${s.source.slice(0, 22)}...` : s.source,
      Category: s.category,
      Similarity: s.similarity.toFixed(4)
    }))
  );

  console.log("\n--- AI Structured Analysis Summary ---");
  console.log(`Summary:\n  ${analysis.summary}`);
  console.log(`\nRisk Assessment:\n  Level: ${analysis.riskAssessment.level}\n  Reasoning: ${analysis.riskAssessment.reasoning}`);
  console.log(`\nKey Indicators:`);
  analysis.keyIndicators.forEach((ind) => console.log(`  • ${ind}`));
  console.log(`\nRecommended Actions:`);
  analysis.recommendedActions.forEach((rec) => console.log(`  • ${rec}`));
};

runLiveVerification().catch((err) => {
  console.error(`\n[FATAL] Live E2E Verification Failed: ${err.message}`);
  if (err.statusCode) {
    console.error(`HTTP Status: ${err.statusCode}`);
  }
  process.exit(1);
});
