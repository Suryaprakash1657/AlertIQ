import { getClient, closePool, testConnection, query } from "../src/config/db.js";

/**
 * Generates a deterministic 768-dimensional normalized unit vector for testing.
 * Does NOT call Gemini API.
 *
 * @param {number} [seed=1]
 * @returns {string} pgvector formatted string '[0.036, ...]'
 */
function createDeterministicTestVector(seed = 1) {
  const dim = 768;
  const values = [];
  let sumSq = 0;

  for (let i = 0; i < dim; i++) {
    // Simple deterministic pseudo-random float
    const val = Math.sin(seed * (i + 1));
    values.push(val);
    sumSq += val * val;
  }

  // Normalize to unit length
  const norm = Math.sqrt(sumSq);
  const normalized = values.map((v) => Number((v / norm).toFixed(6)));
  return `[${normalized.join(",")}]`;
}

/**
 * Generates a deterministic vector with incorrect dimension (512-dim).
 *
 * @returns {string}
 */
function createInvalidDimTestVector() {
  const values = Array(512).fill(0.05);
  return `[${values.join(",")}]`;
}

async function runDatabaseTests() {
  console.log("===============================================================");
  console.log("   AlertIQ Module 3.24 — Database & pgvector Verification Test ");
  console.log("===============================================================\n");

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

  let client;

  try {
    // -------------------------------------------------------------
    // Section 1: Connectivity & Extension
    // -------------------------------------------------------------
    console.log("--- Section 1: PostgreSQL Connection & pgvector Extension ---");

    const conn = await testConnection();
    assert(conn.ok === true, "PostgreSQL connection succeeds", conn.error);

    const extRes = await query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
    );
    assert(
      extRes.rows.length === 1 && extRes.rows[0].extname === "vector",
      "pgvector extension is installed and active",
      `Version: ${extRes.rows[0]?.extversion}`
    );

    // -------------------------------------------------------------
    // Section 2: Schema & Tables Verification
    // -------------------------------------------------------------
    console.log("\n--- Section 2: Schema & Tables Structure ---");

    const tablesRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('knowledge_documents', 'knowledge_chunks', 'schema_migrations');
    `);
    const foundTables = new Set(tablesRes.rows.map((r) => r.table_name));

    assert(foundTables.has("knowledge_documents"), "knowledge_documents table exists");
    assert(foundTables.has("knowledge_chunks"), "knowledge_chunks table exists");
    assert(foundTables.has("schema_migrations"), "schema_migrations table exists");

    // Check knowledge_chunks.embedding column data type
    const colRes = await query(`
      SELECT column_name, udt_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding';
    `);
    assert(
      colRes.rows.length === 1 && (colRes.rows[0].udt_name === "vector" || colRes.rows[0].data_type === "USER-DEFINED"),
      "knowledge_chunks.embedding column is a vector type"
    );

    // Verify embedding dimension is 768 via pg_attribute
    const dimRes = await query(`
      SELECT a.attname, a.atttypmod as dimensions
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      WHERE c.relname = 'knowledge_chunks' AND a.attname = 'embedding';
    `);
    assert(
      dimRes.rows.length === 1 && dimRes.rows[0].dimensions === 768,
      "knowledge_chunks.embedding vector dimension is strictly 768"
    );

    // -------------------------------------------------------------
    // Section 3: Constraints & Indexes
    // -------------------------------------------------------------
    console.log("\n--- Section 3: Constraints & Index Verification ---");

    // Verify Indexes
    const indexRes = await query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('knowledge_documents', 'knowledge_chunks');
    `);
    const indexNames = new Set(indexRes.rows.map((r) => r.indexname));

    assert(indexNames.has("idx_knowledge_chunks_document_id"), "idx_knowledge_chunks_document_id index exists");
    assert(indexNames.has("idx_knowledge_chunks_embedding_status"), "idx_knowledge_chunks_embedding_status index exists");
    assert(indexNames.has("idx_knowledge_documents_created_at"), "idx_knowledge_documents_created_at index exists");

    // Verify Unique Constraint (document_id, chunk_index)
    const uqRes = await query(`
      SELECT conname, contype 
      FROM pg_constraint c
      JOIN pg_class cl ON c.conrelid = cl.oid
      WHERE cl.relname = 'knowledge_chunks' AND c.conname = 'uq_knowledge_chunks_doc_idx';
    `);
    assert(uqRes.rows.length === 1 && uqRes.rows[0].contype === "u", "uq_knowledge_chunks_doc_idx unique constraint exists");

    // -------------------------------------------------------------
    // Section 4: Data Operations & Constraints Validation
    // -------------------------------------------------------------
    console.log("\n--- Section 4: CRUD, Constraints & Vector Operations ---");

    client = await getClient();

    const testDocId = "doc-test-threat-unit-01";
    const testChunkId1 = `${testDocId}_chunk_0`;
    const testChunkId2 = `${testDocId}_chunk_1`;

    // Clean up any lingering test records
    await client.query("DELETE FROM knowledge_documents WHERE id = $1;", [testDocId]);

    // Test 1: Insert Document with Stable ID
    await client.query(
      `INSERT INTO knowledge_documents (id, title, content, source, metadata, chunk_count)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [testDocId, "Unit Test Threat Intelligence Report", "Simulated cyber attack payload analysis.", "AlertIQ-TestEngine", JSON.stringify({ category: "Ransomware" }), 2]
    );
    assert(true, "Successfully inserted document with stable alphanumeric ID");

    // Test 2: Insert Valid Chunk with 768-dim vector
    const testVec1 = createDeterministicTestVector(1);
    await client.query(
      `INSERT INTO knowledge_chunks (
        id, document_id, chunk_index, total_chunks, content, metadata, 
        char_count, token_estimate, embedding, embedding_status, embedding_model, 
        embedding_dimensions, embedding_generated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW());`,
      [testChunkId1, testDocId, 0, 2, "Chunk 0 content: initial access vector.", JSON.stringify({ section: 1 }), 40, 10, testVec1, "ready", "gemini-embedding-2", 768]
    );
    assert(true, "Successfully inserted chunk with valid 768-dimensional VECTOR");

    // Test 3: Rejection of Duplicate (document_id, chunk_index)
    let duplicateRejected = false;
    try {
      await client.query(
        `INSERT INTO knowledge_chunks (
          id, document_id, chunk_index, total_chunks, content, metadata, 
          char_count, token_estimate, embedding_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [`${testDocId}_chunk_0_dup`, testDocId, 0, 2, "Duplicate index content", "{}", 20, 5, "pending"]
      );
    } catch (dupErr) {
      duplicateRejected = dupErr.code === "23505"; // Unique violation
    }
    assert(duplicateRejected, "Database rejects duplicate (document_id, chunk_index) via unique constraint");

    // Test 4: Rejection of Wrong Vector Dimension (e.g. 512-dim)
    let wrongDimRejected = false;
    const invalidVec = createInvalidDimTestVector();
    try {
      await client.query(
        `INSERT INTO knowledge_chunks (
          id, document_id, chunk_index, total_chunks, content, metadata, 
          char_count, token_estimate, embedding, embedding_status, embedding_model, embedding_dimensions
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [testChunkId2, testDocId, 1, 2, "Chunk 1 content: privilege escalation.", "{}", 42, 11, invalidVec, "ready", "gemini-embedding-2", 768]
      );
    } catch (dimErr) {
      wrongDimRejected = dimErr.code === "22000" || dimErr.message.includes("different size") || dimErr.message.includes("dimension");
    }
    assert(wrongDimRejected, "Database strictly rejects vectors with incorrect dimensions (512 != 768)");

    // Test 5: Rejection of Check Constraint Violations (e.g. invalid embedding_status)
    let invalidStatusRejected = false;
    try {
      await client.query(
        `INSERT INTO knowledge_chunks (
          id, document_id, chunk_index, total_chunks, content, metadata, 
          char_count, token_estimate, embedding_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [`${testDocId}_chunk_invalid_status`, testDocId, 1, 2, "Invalid status test", "{}", 20, 5, "in_progress"]
      );
    } catch (statusErr) {
      invalidStatusRejected = statusErr.code === "23514"; // Check violation
    }
    assert(invalidStatusRejected, "Database rejects invalid embedding_status not in controlled enum values");

    // Test 6: Pgvector Cosine Distance Query (<=> operator)
    const simQueryRes = await client.query(
      `SELECT id, document_id, (embedding <=> $1) AS cosine_distance 
       FROM knowledge_chunks 
       WHERE id = $2;`,
      [testVec1, testChunkId1]
    );
    const calculatedDist = parseFloat(simQueryRes.rows[0]?.cosine_distance);
    assert(
      simQueryRes.rows.length === 1 && !isNaN(calculatedDist) && calculatedDist < 0.0001,
      "Pgvector cosine distance operator (<=>) executes correctly (dist = 0 for identical vector)"
    );

    // Test 7: Foreign Key Cascade Deletion
    await client.query("DELETE FROM knowledge_documents WHERE id = $1;", [testDocId]);
    const orphanedChunks = await client.query("SELECT id FROM knowledge_chunks WHERE document_id = $1;", [testDocId]);
    assert(orphanedChunks.rows.length === 0, "Deleting parent document cascades and removes all child chunks");

    // -------------------------------------------------------------
    // Section 5: Transaction Safety Verification
    // -------------------------------------------------------------
    console.log("\n--- Section 5: Transaction Safety (Rollback & Commit) ---");

    await client.query("BEGIN;");
    await client.query(
      `INSERT INTO knowledge_documents (id, title, content) VALUES ($1, $2, $3);`,
      ["doc-rollback-test", "Rollback Document", "Will be rolled back."]
    );
    await client.query("ROLLBACK;");

    const rolledBackDoc = await client.query("SELECT id FROM knowledge_documents WHERE id = $1;", ["doc-rollback-test"]);
    assert(rolledBackDoc.rows.length === 0, "Transaction rollback successfully undoes operations without residual state");

  } catch (err) {
    console.error("\n✖ Unexpected database test error:", err);
    failed++;
  } finally {
    if (client) {
      client.release();
    }
    await closePool();
  }

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log("\n===============================================================");
  console.log(`Database Test Results: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runDatabaseTests();
