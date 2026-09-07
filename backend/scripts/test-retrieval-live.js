/**
 * Module 3.20 Live Integration Test: Gemini Semantic Retrieval & RAG Context
 *
 * Calls the actual Google GenAI API with 'gemini-embedding-2' query embeddings to verify
 * real-world semantic retrieval ranking against indexed knowledge-base chunks.
 * Skips gracefully if GEMINI_API_KEY is not configured.
 */

import { config } from "../src/config/env.js";
import { generateQueryEmbedding } from "../src/services/embedding.service.js";
import { retrieveKnowledge } from "../src/services/retrieval.service.js";
import { buildRagContext } from "../src/utils/rag.utils.js";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  clearKnowledgeBase
} from "../src/services/knowledge.service.js";

async function runLiveTest() {
  console.log(`\n======================================================`);
  console.log(`Starting Module 3.20 Live Semantic Retrieval Test`);
  console.log(`Model: ${config.geminiEmbeddingModel}`);
  console.log(`Dimensions: ${config.embeddingDimensions}`);
  console.log(`======================================================\n`);

  if (
    !config.geminiApiKey ||
    config.geminiApiKey.trim() === "" ||
    config.geminiApiKey === "your_gemini_api_key_here"
  ) {
    console.log("⚠️  SKIPPING LIVE INTEGRATION TEST:");
    console.log("   GEMINI_API_KEY is not configured or is set to placeholder in .env.\n");
    return;
  }

  await clearKnowledgeBase();

  try {
    // ----------------------------------------------------
    // 1. Ingest Knowledge Documents for Retrieval Baseline
    // ----------------------------------------------------
    console.log("1. Ingesting test runbooks with live vector embeddings...");
    const ransomwareDoc = await createKnowledgeDocument({
      title: "Playbook - Ransomware File Encryption Mitigation",
      content:
        "1. Phase 1 - Containment: Immediately disconnect infected endpoint from LAN and Wi-Fi.\n" +
        "2. Phase 2 - Active Defense: Terminate processes executing vssadmin.exe or certutil.exe download cradles.\n" +
        "3. Phase 3 - Remediation: Rebuild system from trusted baseline and restore data from immutable cloud backup.",
      source: "Enterprise SOC Runbook IR-088",
      metadata: { category: "Ransomware", severity: "CRITICAL" }
    });

    const webDoc = await createKnowledgeDocument({
      title: "Guide - SQL Injection Investigation",
      content:
        "1. Triage: Check Web Application Firewall (WAF) logs for UNION SELECT or OR 1=1 payloads.\n" +
        "2. Remediation: Apply parameterized queries and sanitize all user input fields.",
      source: "AppSec Guidelines",
      metadata: { category: "Web Security", severity: "HIGH" }
    });

    console.log(`   ✓ Ingested '${ransomwareDoc.document.title}' (${ransomwareDoc.chunkCount} chunks)`);
    console.log(`   ✓ Ingested '${webDoc.document.title}' (${webDoc.chunkCount} chunks)`);

    // ----------------------------------------------------
    // 2. Query Embedding Generation (taskType: RETRIEVAL_QUERY)
    // ----------------------------------------------------
    console.log("\n2. Requesting live query embedding from Google Gemini API...");
    const searchQuery = "How to isolate host and stop ransomware encryption";
    const queryEmb = await generateQueryEmbedding(searchQuery);

    console.log(`   ✓ Query embedding received (${queryEmb.dimensions} dimensions)`);
    if (queryEmb.dimensions !== config.embeddingDimensions || !Array.isArray(queryEmb.vector)) {
      throw new Error(`Query embedding dimension mismatch (got ${queryEmb.dimensions})`);
    }

    // ----------------------------------------------------
    // 3. Semantic Retrieval & Ranking
    // ----------------------------------------------------
    console.log("\n3. Executing semantic retrieval for query: '" + searchQuery + "'...");
    const retrieval = await retrieveKnowledge(searchQuery, {
      topK: 3,
      similarityThreshold: 0.3
    });

    console.log(`   ✓ Matched Chunks: ${retrieval.matchedCount}`);
    for (let i = 0; i < retrieval.results.length; i++) {
      const res = retrieval.results[i];
      console.log(`     [Rank ${i + 1}] Similarity: ${res.similarity.toFixed(4)} | Title: ${res.metadata.documentTitle}`);
    }

    if (retrieval.results.length === 0) {
      throw new Error("Live retrieval returned 0 matching chunks");
    }

    // Assertion: Relevant document ranks first and similarity is a finite number in [-1.0, 1.0]
    const topResult = retrieval.results[0];
    if (!topResult.metadata.documentTitle.includes("Ransomware")) {
      throw new Error(`Expected Ransomware document to rank #1, got '${topResult.metadata.documentTitle}'`);
    }

    if (typeof topResult.similarity !== "number" || !Number.isFinite(topResult.similarity) || topResult.similarity < -1.0 || topResult.similarity > 1.0) {
      throw new Error(`Invalid similarity score: ${topResult.similarity}`);
    }

    console.log("   ✓ Verified Top-1 match is Ransomware playbook with valid similarity score.");

    // ----------------------------------------------------
    // 4. RAG Context Formatting
    // ----------------------------------------------------
    console.log("\n4. Building RAG Context Block...");
    const { ragContextText, sourcesUsed } = buildRagContext(retrieval.results);
    console.log(`   ✓ RAG Context generated (${ragContextText.length} characters, ${sourcesUsed.length} sources cited)`);

    // ----------------------------------------------------
    // 5. Cleanup
    // ----------------------------------------------------
    console.log("\n5. Cleaning up test documents...");
    await deleteKnowledgeDocument(ransomwareDoc.document.id);
    await deleteKnowledgeDocument(webDoc.document.id);
    console.log("   ✓ Test documents deleted successfully.");

    console.log("\n======================================================");
    console.log("✅ Live Gemini Semantic Retrieval Test PASSED!");
    console.log("======================================================\n");
  } catch (error) {
    console.error("\n❌ Live Semantic Retrieval Test FAILED:", error.message);
    process.exit(1);
  }
}

runLiveTest().catch((err) => {
  console.error("Live test runner error:", err);
  process.exit(1);
});
