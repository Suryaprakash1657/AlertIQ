import { PostgresKnowledgeRepository, formatVectorForPg } from "../src/repositories/knowledge.repository.js";
import { closePool, testConnection } from "../src/config/db.js";

/**
 * Generates a deterministic 768-dimensional normalized unit vector.
 * Does NOT call Gemini API.
 */
function createDeterministicTestVector(seed = 1) {
  const dim = 768;
  const values = [];
  let sumSq = 0;

  for (let i = 0; i < dim; i++) {
    const val = Math.sin(seed * (i + 1));
    values.push(val);
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq);
  return values.map((v) => Number((v / norm).toFixed(6)));
}

async function runPersistentRepositoryTests() {
  console.log("===============================================================");
  console.log(" AlertIQ Module 3.25 — Persistent PostgreSQL Repository Tests  ");
  console.log("===============================================================\n");

  const repo = new PostgresKnowledgeRepository();
  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = "") => {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${testName} ${details ? `(${details})` : ""}`);
      failed++;
    }
  };

  const testDocId1 = "doc-test-repo-persisted-01";
  const testDocId2 = "doc-test-repo-persisted-02";

  try {
    // -------------------------------------------------------------
    // Section 1: DB Connection Pre-check
    // -------------------------------------------------------------
    console.log("--- Section 1: PostgreSQL Pre-check ---");
    const conn = await testConnection();
    assert(conn.ok === true, "PostgreSQL connection is healthy", conn.error);

    // Clean up test-specific IDs before test
    await repo.deleteById(testDocId1);
    await repo.deleteById(testDocId2);

    // -------------------------------------------------------------
    // Section 2: Atomic Document & Chunks Creation
    // -------------------------------------------------------------
    console.log("\n--- Section 2: Atomic Document & Chunks Creation ---");

    const vec1 = createDeterministicTestVector(1);
    const vec2 = createDeterministicTestVector(2);

    const docEntity = {
      id: testDocId1,
      title: "Playbook - Automated Ransomware Containment",
      content: "Complete guide to isolating infected network segments during a ransomware incident.",
      source: "AlertIQ-SecOps",
      metadata: {
        category: "Ransomware",
        threatType: "malware",
        authority: "CISA",
        version: "1.0"
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const chunkEntities = [
      {
        id: `${testDocId1}_chk_0`,
        documentId: testDocId1,
        chunkIndex: 0,
        totalChunks: 2,
        content: "Step 1: Isolate affected host network interface immediately.",
        metadata: { step: 1, severity: "critical" },
        charCount: 60,
        tokenEstimate: 15,
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          generatedAt: new Date().toISOString(),
          vector: vec1
        }
      },
      {
        id: `${testDocId1}_chk_1`,
        documentId: testDocId1,
        chunkIndex: 1,
        totalChunks: 2,
        content: "Step 2: Collect memory dump and preserve volatile artifacts.",
        metadata: { step: 2, severity: "high" },
        charCount: 62,
        tokenEstimate: 16,
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          generatedAt: new Date().toISOString(),
          vector: vec2
        }
      }
    ];

    const createResult = await repo.create(docEntity, chunkEntities);
    assert(createResult.document.id === testDocId1, "Document created with stable ID");
    assert(createResult.document.chunkCount === 2, "Document reports correct chunkCount (2)");
    assert(createResult.chunks.length === 2, "Persisted 2 chunks in database");

    // -------------------------------------------------------------
    // Section 3: Document Retrieval (findById & findAll)
    // -------------------------------------------------------------
    console.log("\n--- Section 3: Document & Chunk Queries ---");

    const fetchedDoc = await repo.findById(testDocId1);
    assert(fetchedDoc !== null, "findById retrieves persisted document from PostgreSQL");
    assert(fetchedDoc.title === docEntity.title, "Document title matches original");
    assert(fetchedDoc.metadata.category === "Ransomware", "Document JSONB metadata preserved");
    assert(fetchedDoc.chunks.length === 2, "Document includes full chunks array");
    assert(fetchedDoc.chunks[0].chunkIndex === 0, "Chunks ordered correctly by chunkIndex");
    assert(Array.isArray(fetchedDoc.chunks[0].embedding.vector), "Chunk embedding vector parsed into float array");
    assert(fetchedDoc.chunks[0].embedding.vector.length === 768, "Chunk embedding has exactly 768 dimensions");

    const docList = await repo.findAll();
    const listed = docList.find((d) => d.id === testDocId1);
    assert(Boolean(listed), "Document appears in findAll() listing");
    assert(listed.chunks === undefined, "findAll() summary omits bulky chunks array for performance");
    assert(listed.chunkCount === 2, "findAll() summary includes accurate chunkCount");

    // -------------------------------------------------------------
    // Section 4: Individual Chunk Lookup & Indexed Chunks
    // -------------------------------------------------------------
    console.log("\n--- Section 4: Chunk Lookups & Indexing ---");

    const chunk0 = await repo.findChunkById(`${testDocId1}_chk_0`);
    assert(chunk0 !== null && chunk0.documentId === testDocId1, "findChunkById retrieves chunk entity");
    assert(chunk0.embedding.status === "ready", "findChunkById retains embedding status 'ready'");

    const nonExistentChunk = await repo.findChunkById("non_existent_chunk_id");
    assert(nonExistentChunk === null, "findChunkById returns null for missing chunk ID");

    const allIndexed = await repo.getAllIndexedChunks();
    const hasIndexedChunk = allIndexed.some((c) => c.id === `${testDocId1}_chk_0`);
    assert(hasIndexedChunk, "getAllIndexedChunks includes persisted ready chunk");

    // -------------------------------------------------------------
    // Section 5: Duplicate Prevention & Atomic Replacement
    // -------------------------------------------------------------
    console.log("\n--- Section 5: Duplicate Rejection & Atomic Replacement ---");

    let duplicateRejected = false;
    try {
      await repo.create(docEntity, chunkEntities);
    } catch (err) {
      duplicateRejected = true;
    }
    assert(duplicateRejected, "create() rejects duplicate document ID with error");

    // Atomic replacement via replaceDocument
    const updatedDoc = {
      ...docEntity,
      title: "Playbook - Automated Ransomware Containment (v2.0)"
    };
    const updatedChunks = [
      {
        ...chunkEntities[0],
        content: "Updated Step 1: Terminate infected processes and disable NIC."
      }
    ];

    const replaceResult = await repo.replaceDocument(updatedDoc, updatedChunks);
    assert(replaceResult.document.title === updatedDoc.title, "replaceDocument() atomically updates document title");
    assert(replaceResult.chunks.length === 1, "replaceDocument() updates chunk collection to 1 chunk");

    const recheckDoc = await repo.findById(testDocId1);
    assert(recheckDoc.chunks.length === 1, "Post-replacement query confirms old chunks removed and new chunk stored");
    assert(recheckDoc.chunks[0].content.includes("Updated Step 1"), "New chunk content persisted");

    // -------------------------------------------------------------
    // Section 6: Direct Pgvector Cosine Similarity Search (<=>)
    // -------------------------------------------------------------
    console.log("\n--- Section 6: Pgvector Cosine Distance Retrieval ---");

    const queryVec = vec1; // Identical to chunk 0
    const searchResults = await repo.searchSimilarChunks(queryVec, {
      topK: 5,
      similarityThreshold: 0.5
    });

    assert(searchResults.length >= 1, "searchSimilarChunks returns matches above threshold");
    const topMatch = searchResults.find((r) => r.chunkId === `${testDocId1}_chk_0`);
    assert(Boolean(topMatch), "searchSimilarChunks retrieved expected chunk");
    assert(topMatch.similarity > 0.99, `Top match similarity ≈ 1.0 (got ${topMatch?.similarity})`);
    assert(topMatch.chunkId !== undefined && topMatch.documentId !== undefined, "Search results contain required chunk provenance");

    // -------------------------------------------------------------
    // Section 7: Cascade Deletion
    // -------------------------------------------------------------
    console.log("\n--- Section 7: Cascade Deletion & Cleanup ---");

    const deleteSuccess = await repo.deleteById(testDocId1);
    assert(deleteSuccess === true, "deleteById() returns true on successful deletion");

    const afterDeleteDoc = await repo.findById(testDocId1);
    assert(afterDeleteDoc === null, "findById returns null after deletion");

    const afterDeleteChunk = await repo.findChunkById(`${testDocId1}_chk_0`);
    assert(afterDeleteChunk === null, "Associated chunks are cascaded and deleted from PostgreSQL");

  } catch (err) {
    console.error("✖ Unexpected error during persistent repository test:", err);
    failed++;
  } finally {
    // Ensure clean teardown of test IDs
    try {
      await repo.deleteById(testDocId1);
      await repo.deleteById(testDocId2);
    } catch (_) {}
    await closePool();
  }

  console.log("\n===============================================================");
  console.log(`Persistent Repository Test Results: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPersistentRepositoryTests();
