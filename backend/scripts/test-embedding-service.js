/**
 * Module 3.19 Automated Test Suite: Embedding Generation & Vector-Ready Knowledge Indexing
 *
 * Deterministic, provider-independent verification suite using mock/stub embedding provider
 * to test all unit, schema, dimension, validation, repository, pipeline, error-sanitization,
 * and backward compatibility requirements without depending on external Gemini network availability.
 */

import app from "../src/app.js";
import { config } from "../src/config/env.js";
import {
  generateEmbedding,
  generateEmbeddingsForChunks,
  validateEmbeddingResult,
  setEmbeddingProviderOverride,
  resetEmbeddingProviderOverride,
  sanitizeErrorMessage
} from "../src/services/embedding.service.js";
import { clearKnowledgeBase } from "../src/services/knowledge.service.js";
import { knowledgeRepository } from "../src/repositories/knowledge.repository.js";
import { chunkText, createDocumentChunks } from "../src/utils/chunking.utils.js";

// Helper to generate a deterministic 768-dimensional mock vector
const createMock768Vector = (seed = 1) => {
  const vector = [];
  for (let i = 0; i < 768; i++) {
    // Generate deterministic pseudo-float values between -1.0 and 1.0
    const val = Math.sin(seed * (i + 1)) * 0.5;
    vector.push(parseFloat(val.toFixed(6)));
  }
  return vector;
};

// Deterministic mock provider that implements the Google GenAI embedding contract
const deterministicMockProvider = async (text, options = {}) => {
  const seed = (text && text.length) || 42;
  return {
    model: config.geminiEmbeddingModel || "gemini-embedding-2",
    dimensions: 768,
    vector: createMock768Vector(seed),
    generatedAt: new Date().toISOString()
  };
};

async function runTests() {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}/api/knowledge`;
  const llmUrl = `http://localhost:${port}/api/llm`;

  console.log(`\n======================================================`);
  console.log(`Starting Module 3.19 Embedding & Vector Indexing Test Suite`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  async function post(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  async function get(url) {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  async function del(url) {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // Set mock provider override for deterministic suite execution
  setEmbeddingProviderOverride(deterministicMockProvider);
  await clearKnowledgeBase();

  try {
    // ----------------------------------------------------
    // Test 1: Embedding Service Configuration
    // ----------------------------------------------------
    console.log("Test 1: Verifying embedding model configuration...");
    assert(
      config.geminiEmbeddingModel === "gemini-embedding-2",
      `Active embedding model is '${config.geminiEmbeddingModel}' (expected 'gemini-embedding-2')`
    );
    assert(
      config.embeddingDimensions === 768,
      `Configured embedding dimensionality is ${config.embeddingDimensions} (expected 768)`
    );

    // ----------------------------------------------------
    // Test 2: Input Validation (Empty / Whitespace / Non-string)
    // ----------------------------------------------------
    console.log("\nTest 2: Verifying input validation for embedding generation...");
    let emptyCaught = false;
    try {
      await generateEmbedding("");
    } catch (err) {
      emptyCaught = true;
      assert(err.statusCode === 400, "Empty text rejected with HTTP 400");
    }
    assert(emptyCaught, "Empty string throws validation error");

    let whitespaceCaught = false;
    try {
      await generateEmbedding("   \n\t  ");
    } catch (err) {
      whitespaceCaught = true;
      assert(err.statusCode === 400, "Whitespace text rejected with HTTP 400");
    }
    assert(whitespaceCaught, "Whitespace-only string throws validation error");

    let nonStringCaught = false;
    try {
      await generateEmbedding(12345);
    } catch (err) {
      nonStringCaught = true;
      assert(err.statusCode === 400, "Non-string text rejected with HTTP 400");
    }
    assert(nonStringCaught, "Non-string input throws validation error");

    // ----------------------------------------------------
    // Test 3: Dimension and Value Validation
    // ----------------------------------------------------
    console.log("\nTest 3: Verifying vector dimension and numeric validation...");
    let wrongDimCaught = false;
    try {
      validateEmbeddingResult(
        {
          model: "gemini-embedding-2",
          dimensions: 512,
          vector: new Array(512).fill(0.1),
          generatedAt: new Date().toISOString()
        },
        768
      );
    } catch (err) {
      wrongDimCaught = true;
      assert(
        err.statusCode === 502 && err.message.includes("expected 768, got 512"),
        "Mismatched vector dimension (512 vs 768) rejected with HTTP 502"
      );
    }
    assert(wrongDimCaught, "Dimension mismatch throws controlled 502 error");

    let nonNumericCaught = false;
    try {
      const invalidVector = new Array(768).fill(0.1);
      invalidVector[10] = "corrupted_non_numeric";
      validateEmbeddingResult(
        {
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: invalidVector,
          generatedAt: new Date().toISOString()
        },
        768
      );
    } catch (err) {
      nonNumericCaught = true;
      assert(
        err.statusCode === 502 && err.message.includes("non-numeric"),
        "Non-numeric vector elements rejected with HTTP 502"
      );
    }
    assert(nonNumericCaught, "Corrupted vector values throw controlled 502 error");

    // ----------------------------------------------------
    // Test 4: Single Text Embedding Generation
    // ----------------------------------------------------
    console.log("\nTest 4: Generating valid single text embedding...");
    const sampleText = "Investigate suspicious lateral movement via PsExec on domain controller.";
    const singleResult = await generateEmbedding(sampleText, {
      title: "Playbook - PsExec Investigation"
    });

    assert(singleResult.model === "gemini-embedding-2", "Embedding model is 'gemini-embedding-2'");
    assert(singleResult.dimensions === 768, "Embedding dimensions is exactly 768");
    assert(Array.isArray(singleResult.vector), "Embedding vector is an array");
    assert(singleResult.vector.length === 768, "Embedding vector has exactly 768 items");
    assert(
      singleResult.vector.every((val) => typeof val === "number" && Number.isFinite(val)),
      "All 768 vector items are finite numeric floats"
    );
    assert(Boolean(singleResult.generatedAt), "Timestamp generatedAt is present");

    // ----------------------------------------------------
    // Test 5: Multiple Chunks Embedding Pipeline
    // ----------------------------------------------------
    console.log("\nTest 5: Generating vector embeddings across multiple chunk entities...");
    const dummyDoc = {
      id: "doc_mock_test_001",
      title: "Active Directory Kerberoasting Incident Response",
      content:
        "Kerberoasting targets Active Directory service accounts with SPNs.\n\n" +
        "Step 1: Check Event ID 4769 for RC4 encryption ticket requests.\n\n" +
        "Step 2: Isolate the source workstation.\n\n" +
        "Step 3: Reset password for targeted SPN service account.",
      source: "SOC Playbook",
      metadata: { severity: "HIGH" }
    };
    const initialChunks = createDocumentChunks(dummyDoc, { chunkSize: 120, overlap: 30 });
    assert(initialChunks.length > 1, `Document created ${initialChunks.length} chunks`);
    assert(
      initialChunks.every((c) => c.embedding && c.embedding.status === "pending"),
      "Initial chunks have baseline embedding status 'pending'"
    );

    const readyChunks = await generateEmbeddingsForChunks(initialChunks, {
      title: dummyDoc.title
    });
    assert(readyChunks.length === initialChunks.length, "All chunks processed");
    assert(
      readyChunks.every(
        (c) =>
          c.embedding &&
          c.embedding.status === "ready" &&
          c.embedding.model === "gemini-embedding-2" &&
          c.embedding.dimensions === 768 &&
          Array.isArray(c.embedding.vector) &&
          c.embedding.vector.length === 768 &&
          Boolean(c.embedding.generatedAt)
      ),
      "Every chunk is enriched with status 'ready', model 'gemini-embedding-2', and 768-dim vector"
    );

    // ----------------------------------------------------
    // Test 6: Document Ingestion Pipeline with Vector Indexing (POST /api/knowledge/documents)
    // ----------------------------------------------------
    console.log("\nTest 6: Ingesting security runbook via POST /api/knowledge/documents...");
    const docPayload = {
      title: "Playbook - Ransomware Isolation Procedures",
      content: `1. Detection: Detect unauthorized file encryption and suspicious vssadmin delete shadows commands.
2. Immediate Containment: Disconnect network adapters immediately. Disable affected Active Directory accounts.
3. Forensics: Extract memory image and preserve event logs (Event ID 4688, 7045).
4. Eradication: Wipe and re-image confirmed compromised hosts from clean baseline.
5. Recovery: Restore critical data from immutable air-gapped backups.`,
      source: "Enterprise IR Runbook IR-088",
      metadata: {
        category: "Ransomware",
        severity: "CRITICAL",
        tactics: ["Impact", "Inhibit System Recovery"]
      },
      chunkSize: 250,
      overlap: 50
    };

    const createRes = await post(`${baseUrl}/documents`, docPayload);
    assert(createRes.status === 201, `Document ingestion returned HTTP ${createRes.status}`);
    assert(createRes.data.success === true, "Response success is true");
    assert(Boolean(createRes.data.document.id), `Created document ID: ${createRes.data.document?.id}`);
    assert(createRes.data.chunkCount > 1, `Document chunkCount is ${createRes.data.chunkCount}`);

    const ingestedChunks = createRes.data.chunks;
    assert(Array.isArray(ingestedChunks) && ingestedChunks.length > 0, "Returned chunks array is non-empty");
    assert(
      ingestedChunks.every(
        (chk) =>
          chk.embedding &&
          chk.embedding.status === "ready" &&
          chk.embedding.model === "gemini-embedding-2" &&
          chk.embedding.dimensions === 768 &&
          chk.embedding.vector.length === 768 &&
          typeof chk.embedding.generatedAt === "string"
      ),
      "All ingested chunks contain vector embeddings with status 'ready' and 768 dimensions"
    );

    const docId = createRes.data.document.id;

    // ----------------------------------------------------
    // Test 7: Document Retrieval with Full Chunks (GET /api/knowledge/documents/:id)
    // ----------------------------------------------------
    console.log(`\nTest 7: Retrieving document by ID (${docId})...`);
    const getRes = await get(`${baseUrl}/documents/${docId}`);
    assert(getRes.status === 200, `Retrieval returned HTTP ${getRes.status}`);
    assert(getRes.data.success === true, "Retrieval success is true");
    assert(getRes.data.document.id === docId, "Retrieved correct document ID");
    assert(
      getRes.data.document.chunks.every(
        (chk) => chk.embedding && chk.embedding.status === "ready" && chk.embedding.vector.length === 768
      ),
      "Retrieved chunks retain valid vector embeddings and status 'ready'"
    );

    // ----------------------------------------------------
    // Test 8: Lightweight Document Listing (GET /api/knowledge/documents)
    // ----------------------------------------------------
    console.log("\nTest 8: Listing documents summary (verifying no large vector payload leak)...");
    const listRes = await get(`${baseUrl}/documents`);
    assert(listRes.status === 200, `List returned HTTP ${listRes.status}`);
    assert(listRes.data.total >= 1, `Total indexed documents: ${listRes.data.total}`);

    const listedDoc = listRes.data.documents.find((d) => d.id === docId);
    assert(Boolean(listedDoc), "Target document found in listing");
    assert(listedDoc.chunks === undefined, "List summary omits chunk array");
    assert(listedDoc.chunkCount > 0, `List summary provides chunkCount (${listedDoc.chunkCount})`);

    // ----------------------------------------------------
    // Test 9: Repository Storage Helpers (getAllIndexedChunks & findChunkById)
    // ----------------------------------------------------
    console.log("\nTest 9: Testing repository vector storage helper methods...");
    const allIndexed = await knowledgeRepository.getAllIndexedChunks();
    assert(
      allIndexed.length === ingestedChunks.length,
      `getAllIndexedChunks returned all ${allIndexed.length} indexed chunks`
    );
    assert(
      allIndexed.every((c) => c.embedding && c.embedding.status === "ready" && c.embedding.dimensions === 768),
      "All returned chunks from getAllIndexedChunks have status 'ready' and 768 dimensions"
    );

    const firstChunkId = ingestedChunks[0].id;
    const foundChunk = await knowledgeRepository.findChunkById(firstChunkId);
    assert(Boolean(foundChunk), `findChunkById successfully found chunk '${firstChunkId}'`);
    assert(foundChunk.id === firstChunkId, "Found chunk matches requested ID");

    const nonExistentChunk = await knowledgeRepository.findChunkById("doc_non_existent_chk_99");
    assert(nonExistentChunk === null, "findChunkById returns null for non-existent chunk");

    // ----------------------------------------------------
    // Test 10: Document Deletion & Chunk Purge (DELETE /api/knowledge/documents/:id)
    // ----------------------------------------------------
    console.log(`\nTest 10: Deleting document (${docId}) and verifying chunk purge...`);
    const delRes = await del(`${baseUrl}/documents/${docId}`);
    assert(delRes.status === 200, `Deletion returned HTTP ${delRes.status}`);
    assert(delRes.data.success === true, "Deletion success confirmation");


    const postDelIndexed = await knowledgeRepository.getAllIndexedChunks();
    assert(postDelIndexed.length === 0, "Repository has 0 indexed chunks after document deletion");

    const postDelChunk = await knowledgeRepository.findChunkById(firstChunkId);
    assert(postDelChunk === null, "Deleted chunk is no longer queryable via findChunkById");

    // ----------------------------------------------------
    // Test 11: Error Sanitization & Key Protection
    // ----------------------------------------------------
    console.log("\nTest 11: Verifying secret and API key sanitization in error handling...");
    const sensitiveError =
      "Request failed with key=AIzaMockTestKeyPlaceholder1234567890ABC and bearer mock_sample_bearer_token_xyz";
    const sanitized = sanitizeErrorMessage(sensitiveError);

    assert(!sanitized.includes("AIzaMockTestKeyPlaceholder1234567890ABC"), "API key pattern was scrubbed");
    assert(!sanitized.includes("mock_sample_bearer_token_xyz"), "Bearer token pattern was scrubbed");
    assert(sanitized.includes("[REDACTED"), "Replaced with redacted indicator");


    // ----------------------------------------------------
    // Test 12: Backward Compatibility (LLM Endpoints)
    // ----------------------------------------------------
    console.log("\nTest 12: Verifying backward compatibility with existing LLM routes...");
    // 12a: LLM Test Endpoint input validation check
    const badLlmRes = await post(`${llmUrl}/test`, {});
    assert(badLlmRes.status === 400, "POST /api/llm/test rejects empty payload with HTTP 400");

    // 12b: LLM Analyze Endpoint input validation check
    const badAnalyzeRes = await post(`${llmUrl}/analyze`, {});
    assert(badAnalyzeRes.status === 400, "POST /api/llm/analyze rejects empty alert payload with HTTP 400");

    console.log("\n======================================================");
    console.log(`Module 3.19 Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
    console.log("======================================================\n");
  } finally {
    resetEmbeddingProviderOverride();
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
