import { query, closePool } from "../src/config/db.js";

async function verify() {
  try {
    const docs = await query("SELECT id, title, chunk_count FROM knowledge_documents WHERE id LIKE 'doc-threat-%' ORDER BY id");
    console.log(`\n=== Production Threat Documents (Total: ${docs.rows.length}) ===`);
    console.table(docs.rows);

    const stats = await query(`
      SELECT 
        COUNT(*)::int AS total_chunks,
        COUNT(CASE WHEN embedding_status = 'ready' THEN 1 END)::int AS ready_chunks,
        COUNT(CASE WHEN embedding_dimensions = 768 THEN 1 END)::int AS dim_768_chunks,
        COUNT(DISTINCT embedding::text)::int AS total_distinct_embeddings
      FROM knowledge_chunks
      WHERE document_id LIKE 'doc-threat-%';
    `);
    console.log("\n=== Chunk Stats ===");
    console.table(stats.rows);

    const distinctByDoc = await query(`
      SELECT
        document_id,
        COUNT(*)::int AS chunk_count,
        COUNT(DISTINCT embedding::text)::int AS distinct_embeddings
      FROM knowledge_chunks
      WHERE document_id LIKE 'doc-threat-%'
      GROUP BY document_id
      ORDER BY document_id;
    `);
    console.log("\n=== Distinct Embeddings by Document ===");
    console.table(distinctByDoc.rows);

    const sample = await query(`
      SELECT chunk_index, substring(embedding::text, 1, 55) as sample_vec
      FROM knowledge_chunks
      WHERE document_id = 'doc-threat-cisa-ransomware-01'
      ORDER BY chunk_index;
    `);
    console.log("\n=== Sample Vector Prefixes for Ransomware Chunks ===");
    console.table(sample.rows);
  } finally {
    await closePool();
  }
}

verify();
