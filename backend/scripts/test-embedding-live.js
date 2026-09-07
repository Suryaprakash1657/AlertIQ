/**
 * Module 3.19 Live Integration Test: Gemini Embedding Generation
 *
 * Calls the actual Google GenAI API with the configured 'gemini-embedding-2' model
 * to verify real API response shapes, 768-dimensional output, and live document indexing.
 * Skips gracefully if GEMINI_API_KEY is not configured or unavailable.
 */

import { config } from "../src/config/env.js";
import { generateEmbedding } from "../src/services/embedding.service.js";
import {
  createKnowledgeDocument,
  getKnowledgeDocumentById,
  deleteKnowledgeDocument,
  clearKnowledgeBase
} from "../src/services/knowledge.service.js";

async function runLiveTest() {
  console.log(`\n======================================================`);
  console.log(`Starting Module 3.19 Live Gemini Embedding Test`);
  console.log(`Model: ${config.geminiEmbeddingModel}`);
  console.log(`Expected Dimensions: ${config.embeddingDimensions}`);
  console.log(`======================================================\n`);

  if (
    !config.geminiApiKey ||
    config.geminiApiKey.trim() === "" ||
    config.geminiApiKey === "your_gemini_api_key_here"
  ) {
    console.log("⚠️  SKIPPING LIVE INTEGRATION TEST:");
    console.log("   GEMINI_API_KEY is not configured or is set to placeholder in .env.");
    console.log("   (Provider-independent deterministic tests in test-embedding-service.js provide 100% offline coverage).\n");
    return;
  }

  await clearKnowledgeBase();

  try {
    // ----------------------------------------------------
    // Test 1: Single Live Text Embedding
    // ----------------------------------------------------
    console.log("1. Requesting live embedding from Google Gemini API...");
    const startTime = Date.now();
    const liveResult = await generateEmbedding(
      "SOC Runbook: Containment steps for unauthorized SSH brute force on Linux bastion host.",
      {
        title: "Playbook - SSH Brute Force",
        taskType: "RETRIEVAL_DOCUMENT"
      }
    );
    const duration = Date.now() - startTime;

    console.log(`   ✓ Live embedding received in ${duration}ms`);
    console.log(`   ✓ Model: ${liveResult.model}`);
    console.log(`   ✓ Dimensions: ${liveResult.dimensions}`);
    console.log(`   ✓ Vector Array Length: ${liveResult.vector.length}`);
    console.log(`   ✓ Vector Sample (first 5 floats): [${liveResult.vector.slice(0, 5).join(", ")}...]`);

    if (liveResult.dimensions !== 768 || liveResult.vector.length !== 768) {
      throw new Error(`Dimension mismatch: expected 768, got ${liveResult.dimensions}`);
    }

    // ----------------------------------------------------
    // Test 2: Live Document Ingestion & Chunking
    // ----------------------------------------------------
    console.log("\n2. Ingesting knowledge document with live vector generation...");
    const docPayload = {
      title: "Playbook - DNS Tunneling Detection and Mitigation",
      content:
        "1. Detection: High volume of TXT/NULL queries to suspicious high-entropy subdomains.\n" +
        "2. Analysis: Review Zeek dns.log and calculate query length distribution.\n" +
        "3. Containment: Block the offending authoritative domain on enterprise DNS resolvers and firewall.\n" +
        "4. Remediation: Scan the originating endpoint for exfiltration malware and malware persistence.",
      source: "Cyber Threat Hunting IR-104",
      metadata: { category: "Exfiltration", severity: "HIGH" },
      chunkSize: 200,
      overlap: 40
    };

    const ingested = await createKnowledgeDocument(docPayload);
    console.log(`   ✓ Document created with ID: ${ingested.document.id}`);
    console.log(`   ✓ Total Chunks: ${ingested.chunkCount}`);

    for (let i = 0; i < ingested.chunks.length; i++) {
      const chunk = ingested.chunks[i];
      console.log(`   ✓ Chunk [${i}] embedding status: ${chunk.embedding?.status}, model: ${chunk.embedding?.model}, dim: ${chunk.embedding?.dimensions}`);
      if (!chunk.embedding || chunk.embedding.status !== "ready" || chunk.embedding.dimensions !== 768) {
        throw new Error(`Chunk ${i} did not receive ready 768-dim embedding`);
      }
    }

    // ----------------------------------------------------
    // Test 3: Verification via getKnowledgeDocumentById
    // ----------------------------------------------------
    console.log("\n3. Retrieving ingested document and verifying chunk embeddings...");
    const retrieved = await getKnowledgeDocumentById(ingested.document.id);
    if (!retrieved || retrieved.chunks.length !== ingested.chunkCount) {
      throw new Error("Failed to retrieve document with matching chunks");
    }
    console.log(`   ✓ Retrieved document '${retrieved.title}' with ${retrieved.chunks.length} vector-ready chunks.`);

    // ----------------------------------------------------
    // Test 4: Cleanup
    // ----------------------------------------------------
    console.log("\n4. Cleaning up test document...");
    await deleteKnowledgeDocument(ingested.document.id);
    console.log("   ✓ Test document deleted successfully.");

    console.log("\n======================================================");
    console.log("✅ Live Gemini Embedding Test PASSED Successfully!");
    console.log("======================================================\n");
  } catch (error) {
    console.error("\n❌ Live Gemini Embedding Test FAILED:", error.message);
    if (error.statusCode) {
      console.error(`   HTTP Status Code: ${error.statusCode}`);
    }
    process.exit(1);
  }
}

runLiveTest().catch((err) => {
  console.error("Live test runner error:", err);
  process.exit(1);
});
