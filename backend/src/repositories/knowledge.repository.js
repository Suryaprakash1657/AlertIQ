/**
 * Knowledge Base Repository
 *
 * Provides persistent PostgreSQL-backed and deterministic in-memory implementations
 * for Knowledge Base documents and chunks in AlertIQ.
 */

import { getClient, query as dbQuery } from "../config/db.js";
import { config } from "../config/env.js";

/**
 * Formats a JavaScript array of floats into a valid pgvector literal string '[0.1,0.2,...]'.
 *
 * @param {Array<number>|string} vector
 * @returns {string|null}
 */
export const formatVectorForPg = (vector) => {
  if (!vector) return null;
  if (typeof vector === "string") return vector;
  if (Array.isArray(vector)) {
    return `[${vector.join(",")}]`;
  }
  return null;
};

/**
 * Parses a pgvector string representation '[0.1,0.2,...]' back into an array of floats.
 *
 * @param {string|Array<number>} val
 * @returns {Array<number>|null}
 */
export const parseVectorFromPg = (val) => {
  if (!val) return null;
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((numStr) => parseFloat(numStr));
    }
  }
  return null;
};

/**
 * In-Memory Knowledge Repository implementation.
 * Preserved for deterministic unit tests and offline testing.
 */
export class InMemoryKnowledgeRepository {
  constructor() {
    /** @type {Map<string, Object>} */
    this.documents = new Map();

    /** @type {Map<string, Array<Object>>} */
    this.chunksByDocId = new Map();
  }

  async create(document, chunks = []) {
    if (this.documents.has(document.id)) {
      const error = new Error(`Document with ID '${document.id}' already exists.`);
      error.statusCode = 409;
      error.code = "23505";
      throw error;
    }

    const docCopy = JSON.parse(JSON.stringify(document));
    const chunksCopy = JSON.parse(JSON.stringify(chunks));

    this.documents.set(document.id, docCopy);
    this.chunksByDocId.set(document.id, chunksCopy);

    return {
      document: { ...docCopy, chunkCount: chunksCopy.length },
      chunks: chunksCopy
    };
  }

  async replaceDocument(document, chunks = []) {
    const docCopy = JSON.parse(JSON.stringify(document));
    const chunksCopy = JSON.parse(JSON.stringify(chunks));

    this.documents.set(document.id, docCopy);
    this.chunksByDocId.set(document.id, chunksCopy);

    return {
      document: { ...docCopy, chunkCount: chunksCopy.length },
      chunks: chunksCopy
    };
  }

  async findAll(options = {}) {
    const docList = [];

    for (const [id, doc] of this.documents.entries()) {
      const chunks = this.chunksByDocId.get(id) || [];
      docList.push({
        id: doc.id,
        title: doc.title,
        source: doc.source,
        metadata: doc.metadata,
        contentLength: doc.content ? doc.content.length : 0,
        chunkCount: chunks.length,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      });
    }

    docList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return docList;
  }

  async findById(id) {
    const doc = this.documents.get(id);
    if (!doc) {
      return null;
    }

    const chunks = this.chunksByDocId.get(id) || [];

    return {
      ...JSON.parse(JSON.stringify(doc)),
      chunkCount: chunks.length,
      chunks: JSON.parse(JSON.stringify(chunks))
    };
  }

  async deleteById(id) {
    if (!this.documents.has(id)) {
      return false;
    }

    this.documents.delete(id);
    this.chunksByDocId.delete(id);
    return true;
  }

  async findChunksByDocumentId(documentId) {
    const chunks = this.chunksByDocId.get(documentId);
    return chunks ? JSON.parse(JSON.stringify(chunks)) : [];
  }

  async getAllIndexedChunks() {
    const indexedChunks = [];
    for (const chunks of this.chunksByDocId.values()) {
      for (const chunk of chunks) {
        if (chunk.embedding && chunk.embedding.status === "ready") {
          indexedChunks.push(JSON.parse(JSON.stringify(chunk)));
        }
      }
    }
    return indexedChunks;
  }

  async findChunkById(chunkId) {
    if (!chunkId || typeof chunkId !== "string") {
      return null;
    }
    for (const chunks of this.chunksByDocId.values()) {
      const match = chunks.find((c) => c.id === chunkId);
      if (match) {
        return JSON.parse(JSON.stringify(match));
      }
    }
    return null;
  }

  async clear() {
    this.documents.clear();
    this.chunksByDocId.clear();
  }
}

/**
 * PostgreSQL + pgvector Knowledge Repository implementation.
 * Production persistent repository for AlertIQ.
 */
export class PostgresKnowledgeRepository {
  /**
   * Atomically persists a new document and all of its chunks.
   * Fails with unique violation if document ID already exists.
   *
   * @param {Object} document - Normalized document entity.
   * @param {Array<Object>} chunks - Array of chunk entities.
   * @returns {Promise<{ document: Object, chunks: Array<Object> }>}
   */
  async create(document, chunks = []) {
    const client = await getClient();
    try {
      await client.query("BEGIN;");

      const docSql = `
        INSERT INTO knowledge_documents (
          id, title, content, source, metadata, chunk_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, title, content, source, metadata, chunk_count as "chunkCount", created_at as "createdAt", updated_at as "updatedAt";
      `;
      const docParams = [
        document.id,
        document.title,
        document.content,
        document.source || null,
        JSON.stringify(document.metadata || {}),
        chunks.length,
        document.createdAt || new Date(),
        document.updatedAt || new Date()
      ];

      const docRes = await client.query(docSql, docParams);
      const savedDoc = docRes.rows[0];

      const savedChunks = [];
      for (const chunk of chunks) {
        const chunkSql = `
          INSERT INTO knowledge_chunks (
            id, document_id, chunk_index, total_chunks, content, metadata,
            char_count, token_estimate, embedding, embedding_status, embedding_model,
            embedding_dimensions, embedding_generated_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id, document_id as "documentId", chunk_index as "chunkIndex", total_chunks as "totalChunks",
                    content, metadata, char_count as "charCount", token_estimate as "tokenEstimate",
                    embedding_status as "embeddingStatus", embedding_model as "embeddingModel",
                    embedding_dimensions as "embeddingDimensions", embedding_generated_at as "embeddingGeneratedAt",
                    created_at as "createdAt", updated_at as "updatedAt";
        `;

        const vectorLiteral = chunk.embedding?.vector ? formatVectorForPg(chunk.embedding.vector) : null;
        const status = chunk.embedding?.status || "pending";
        const model = chunk.embedding?.model || null;
        const dims = chunk.embedding?.dimensions || (chunk.embedding?.vector ? 768 : null);
        const genAt = chunk.embedding?.generatedAt || (chunk.embedding?.vector ? new Date() : null);

        const chunkParams = [
          chunk.id,
          document.id,
          chunk.chunkIndex,
          chunk.totalChunks || chunks.length,
          chunk.content,
          JSON.stringify(chunk.metadata || {}),
          chunk.charCount || chunk.content.length,
          chunk.tokenEstimate || Math.ceil(chunk.content.length / 4),
          vectorLiteral,
          status,
          model,
          dims,
          genAt,
          chunk.createdAt || new Date(),
          chunk.updatedAt || new Date()
        ];

        const chunkRes = await client.query(chunkSql, chunkParams);
        const row = chunkRes.rows[0];
        savedChunks.push({
          id: row.id,
          documentId: row.documentId,
          chunkIndex: row.chunkIndex,
          totalChunks: row.totalChunks,
          content: row.content,
          metadata: row.metadata,
          charCount: row.charCount,
          tokenEstimate: row.tokenEstimate,
          embedding: {
            status: row.embeddingStatus,
            model: row.embeddingModel,
            dimensions: row.embeddingDimensions,
            generatedAt: row.embeddingGeneratedAt,
            vector: chunk.embedding?.vector || null
          },
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        });
      }

      await client.query("COMMIT;");

      return {
        document: savedDoc,
        chunks: savedChunks
      };
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Atomically replaces an existing document and its chunks in a single PostgreSQL transaction.
   * If document does not exist, it is created.
   *
   * @param {Object} document - Normalized document entity.
   * @param {Array<Object>} chunks - Array of chunk entities.
   * @returns {Promise<{ document: Object, chunks: Array<Object> }>}
   */
  async replaceDocument(document, chunks = []) {
    const client = await getClient();
    try {
      await client.query("BEGIN;");

      // 1. Delete old chunks if document existed (cascade or explicit)
      await client.query("DELETE FROM knowledge_chunks WHERE document_id = $1;", [document.id]);

      // 2. Upsert document record
      const docSql = `
        INSERT INTO knowledge_documents (
          id, title, content, source, metadata, chunk_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          source = EXCLUDED.source,
          metadata = EXCLUDED.metadata,
          chunk_count = EXCLUDED.chunk_count,
          updated_at = NOW()
        RETURNING id, title, content, source, metadata, chunk_count as "chunkCount", created_at as "createdAt", updated_at as "updatedAt";
      `;
      const docParams = [
        document.id,
        document.title,
        document.content,
        document.source || null,
        JSON.stringify(document.metadata || {}),
        chunks.length,
        document.createdAt || new Date(),
        document.updatedAt || new Date()
      ];

      const docRes = await client.query(docSql, docParams);
      const savedDoc = docRes.rows[0];

      // 3. Insert fresh chunks
      const savedChunks = [];
      for (const chunk of chunks) {
        const chunkSql = `
          INSERT INTO knowledge_chunks (
            id, document_id, chunk_index, total_chunks, content, metadata,
            char_count, token_estimate, embedding, embedding_status, embedding_model,
            embedding_dimensions, embedding_generated_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id, document_id as "documentId", chunk_index as "chunkIndex", total_chunks as "totalChunks",
                    content, metadata, char_count as "charCount", token_estimate as "tokenEstimate",
                    embedding_status as "embeddingStatus", embedding_model as "embeddingModel",
                    embedding_dimensions as "embeddingDimensions", embedding_generated_at as "embeddingGeneratedAt",
                    created_at as "createdAt", updated_at as "updatedAt";
        `;

        const vectorLiteral = chunk.embedding?.vector ? formatVectorForPg(chunk.embedding.vector) : null;
        const status = chunk.embedding?.status || "pending";
        const model = chunk.embedding?.model || null;
        const dims = chunk.embedding?.dimensions || (chunk.embedding?.vector ? 768 : null);
        const genAt = chunk.embedding?.generatedAt || (chunk.embedding?.vector ? new Date() : null);

        const chunkParams = [
          chunk.id,
          document.id,
          chunk.chunkIndex,
          chunk.totalChunks || chunks.length,
          chunk.content,
          JSON.stringify(chunk.metadata || {}),
          chunk.charCount || chunk.content.length,
          chunk.tokenEstimate || Math.ceil(chunk.content.length / 4),
          vectorLiteral,
          status,
          model,
          dims,
          genAt,
          chunk.createdAt || new Date(),
          chunk.updatedAt || new Date()
        ];

        const chunkRes = await client.query(chunkSql, chunkParams);
        const row = chunkRes.rows[0];
        savedChunks.push({
          id: row.id,
          documentId: row.documentId,
          chunkIndex: row.chunkIndex,
          totalChunks: row.totalChunks,
          content: row.content,
          metadata: row.metadata,
          charCount: row.charCount,
          tokenEstimate: row.tokenEstimate,
          embedding: {
            status: row.embeddingStatus,
            model: row.embeddingModel,
            dimensions: row.embeddingDimensions,
            generatedAt: row.embeddingGeneratedAt,
            vector: chunk.embedding?.vector || null
          },
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        });
      }

      await client.query("COMMIT;");

      return {
        document: savedDoc,
        chunks: savedChunks
      };
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  }

  async findAll(options = {}) {
    const sql = `
      SELECT id, title, source, metadata, chunk_count as "chunkCount",
             length(content) as "contentLength", created_at as "createdAt", updated_at as "updatedAt"
      FROM knowledge_documents
      ORDER BY created_at DESC;
    `;
    const res = await dbQuery(sql);
    return res.rows;
  }

  async findById(id) {
    const docSql = `
      SELECT id, title, content, source, metadata, chunk_count as "chunkCount",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM knowledge_documents
      WHERE id = $1;
    `;
    const docRes = await dbQuery(docSql, [id]);
    if (docRes.rows.length === 0) {
      return null;
    }
    const doc = docRes.rows[0];

    const chunksSql = `
      SELECT id, document_id as "documentId", chunk_index as "chunkIndex", total_chunks as "totalChunks",
             content, metadata, char_count as "charCount", token_estimate as "tokenEstimate",
             embedding_status as "embeddingStatus", embedding_model as "embeddingModel",
             embedding_dimensions as "embeddingDimensions", embedding_generated_at as "embeddingGeneratedAt",
             embedding, created_at as "createdAt", updated_at as "updatedAt"
      FROM knowledge_chunks
      WHERE document_id = $1
      ORDER BY chunk_index ASC;
    `;
    const chunksRes = await dbQuery(chunksSql, [id]);

    const chunks = chunksRes.rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      chunkIndex: row.chunkIndex,
      totalChunks: row.totalChunks,
      content: row.content,
      metadata: row.metadata,
      charCount: row.charCount,
      tokenEstimate: row.tokenEstimate,
      embedding: {
        status: row.embeddingStatus,
        model: row.embeddingModel,
        dimensions: row.embeddingDimensions,
        generatedAt: row.embeddingGeneratedAt,
        vector: parseVectorFromPg(row.embedding)
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));

    return {
      ...doc,
      chunkCount: chunks.length,
      chunks
    };
  }

  async deleteById(id) {
    const sql = `DELETE FROM knowledge_documents WHERE id = $1 RETURNING id;`;
    const res = await dbQuery(sql, [id]);
    return res.rowCount > 0;
  }

  async findChunksByDocumentId(documentId) {
    const chunksSql = `
      SELECT id, document_id as "documentId", chunk_index as "chunkIndex", total_chunks as "totalChunks",
             content, metadata, char_count as "charCount", token_estimate as "tokenEstimate",
             embedding_status as "embeddingStatus", embedding_model as "embeddingModel",
             embedding_dimensions as "embeddingDimensions", embedding_generated_at as "embeddingGeneratedAt",
             embedding, created_at as "createdAt", updated_at as "updatedAt"
      FROM knowledge_chunks
      WHERE document_id = $1
      ORDER BY chunk_index ASC;
    `;
    const chunksRes = await dbQuery(chunksSql, [documentId]);
    return chunksRes.rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      chunkIndex: row.chunkIndex,
      totalChunks: row.totalChunks,
      content: row.content,
      metadata: row.metadata,
      charCount: row.charCount,
      tokenEstimate: row.tokenEstimate,
      embedding: {
        status: row.embeddingStatus,
        model: row.embeddingModel,
        dimensions: row.embeddingDimensions,
        generatedAt: row.embeddingGeneratedAt,
        vector: parseVectorFromPg(row.embedding)
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  async getAllIndexedChunks() {
    const sql = `
      SELECT id, document_id as "documentId", chunk_index as "chunkIndex", total_chunks as "totalChunks",
             content, metadata, char_count as "charCount", token_estimate as "tokenEstimate",
             embedding_status as "embeddingStatus", embedding_model as "embeddingModel",
             embedding_dimensions as "embeddingDimensions", embedding_generated_at as "embeddingGeneratedAt",
             embedding, created_at as "createdAt", updated_at as "updatedAt"
      FROM knowledge_chunks
      WHERE embedding_status = 'ready' AND embedding IS NOT NULL
      ORDER BY document_id ASC, chunk_index ASC;
    `;
    const res = await dbQuery(sql);
    return res.rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      chunkIndex: row.chunkIndex,
      totalChunks: row.totalChunks,
      content: row.content,
      metadata: row.metadata,
      charCount: row.charCount,
      tokenEstimate: row.tokenEstimate,
      embedding: {
        status: row.embeddingStatus,
        model: row.embeddingModel,
        dimensions: row.embeddingDimensions,
        generatedAt: row.embeddingGeneratedAt,
        vector: parseVectorFromPg(row.embedding)
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  async findChunkById(chunkId) {
    if (!chunkId || typeof chunkId !== "string") {
      return null;
    }
    const sql = `
      SELECT id, document_id as "documentId", chunk_index as "chunkIndex", total_chunks as "totalChunks",
             content, metadata, char_count as "charCount", token_estimate as "tokenEstimate",
             embedding_status as "embeddingStatus", embedding_model as "embeddingModel",
             embedding_dimensions as "embeddingDimensions", embedding_generated_at as "embeddingGeneratedAt",
             embedding, created_at as "createdAt", updated_at as "updatedAt"
      FROM knowledge_chunks
      WHERE id = $1;
    `;
    const res = await dbQuery(sql, [chunkId]);
    if (res.rows.length === 0) {
      return null;
    }
    const row = res.rows[0];
    return {
      id: row.id,
      documentId: row.documentId,
      chunkIndex: row.chunkIndex,
      totalChunks: row.totalChunks,
      content: row.content,
      metadata: row.metadata,
      charCount: row.charCount,
      tokenEstimate: row.tokenEstimate,
      embedding: {
        status: row.embeddingStatus,
        model: row.embeddingModel,
        dimensions: row.embeddingDimensions,
        generatedAt: row.embeddingGeneratedAt,
        vector: parseVectorFromPg(row.embedding)
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  /**
   * Searches similar chunks in PostgreSQL using pgvector cosine distance (<=>).
   *
   * @param {Array<number>|string} queryVector
   * @param {Object} options
   * @param {number} [options.topK=5]
   * @param {number} [options.similarityThreshold=0.6]
   * @returns {Promise<Array<Object>>}
   */
  async searchSimilarChunks(queryVector, options = {}) {
    const topK = options.topK || config.defaultRetrievalTopK || 5;
    const threshold = options.similarityThreshold !== undefined ? options.similarityThreshold : (config.defaultSimilarityThreshold || 0.6);
    const vectorLiteral = formatVectorForPg(queryVector);

    const sql = `
      SELECT 
        id, 
        document_id as "documentId", 
        chunk_index as "chunkIndex", 
        total_chunks as "totalChunks", 
        content, 
        metadata,
        (1 - (embedding <=> $1)) AS similarity
      FROM knowledge_chunks
      WHERE embedding_status = 'ready' AND embedding IS NOT NULL
        AND (1 - (embedding <=> $1)) >= $2
      ORDER BY (embedding <=> $1) ASC
      LIMIT $3;
    `;

    const res = await dbQuery(sql, [vectorLiteral, threshold, topK]);
    return res.rows.map((row) => ({
      chunkId: row.id,
      documentId: row.documentId,
      chunkIndex: row.chunkIndex,
      totalChunks: row.totalChunks,
      content: row.content,
      metadata: row.metadata || {},
      similarity: parseFloat(Number(row.similarity).toFixed(6))
    }));
  }

  async clear() {
    await dbQuery("DELETE FROM knowledge_documents;");
  }
}

// Singleton instances
export const inMemoryKnowledgeRepository = new InMemoryKnowledgeRepository();
export const postgresKnowledgeRepository = new PostgresKnowledgeRepository();

// Active repository reference (default: postgres in production, or in-memory if requested)
let activeKnowledgeRepository = process.env.KNOWLEDGE_STORAGE === "memory"
  ? inMemoryKnowledgeRepository
  : postgresKnowledgeRepository;

export const setKnowledgeRepository = (repo) => {
  activeKnowledgeRepository = repo;
};

export const useInMemoryRepository = () => {
  activeKnowledgeRepository = inMemoryKnowledgeRepository;
  return activeKnowledgeRepository;
};

export const usePostgresRepository = () => {
  activeKnowledgeRepository = postgresKnowledgeRepository;
  return activeKnowledgeRepository;
};

export const getKnowledgeRepository = () => activeKnowledgeRepository;

/**
 * Proxy export ensuring all existing imports of `knowledgeRepository`
 * dynamically delegate to the currently active repository instance.
 */
export const knowledgeRepository = new Proxy(
  {},
  {
    get(_, prop) {
      const target = activeKnowledgeRepository;
      const val = target[prop];
      if (typeof val === "function") {
        return val.bind(target);
      }
      return val;
    }
  }
);
