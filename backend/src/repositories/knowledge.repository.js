/**
 * Knowledge Base In-Memory Repository
 *
 * Provides an isolated, asynchronous data access interface for Knowledge Base documents and chunks.
 * Designed with strict repository boundaries so the underlying storage engine can be seamlessly migrated
 * to PostgreSQL, SQLite, or a Vector Database in future modules without modifying services or controllers.
 */

class KnowledgeRepository {
  constructor() {
    /** @type {Map<string, Object>} */
    this.documents = new Map();

    /** @type {Map<string, Array<Object>>} */
    this.chunksByDocId = new Map();
  }

  /**
   * Persists a new document and its associated chunks.
   *
   * @param {Object} document - Normalized document entity.
   * @param {Array<Object>} chunks - Array of chunk entities.
   * @returns {Promise<{ document: Object, chunks: Array<Object> }>}
   */
  async create(document, chunks = []) {
    // Deep clone to prevent external mutation
    const docCopy = JSON.parse(JSON.stringify(document));
    const chunksCopy = JSON.parse(JSON.stringify(chunks));

    this.documents.set(document.id, docCopy);
    this.chunksByDocId.set(document.id, chunksCopy);

    return {
      document: { ...docCopy, chunkCount: chunksCopy.length },
      chunks: chunksCopy
    };
  }

  /**
   * Retrieves all documents in a lightweight listing format.
   * Omits raw chunk bodies to keep list payloads performant.
   *
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
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

    // Sort descending by creation date
    docList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return docList;
  }

  /**
   * Retrieves a document by its ID, including its full chunk list.
   *
   * @param {string} id - Document ID.
   * @returns {Promise<Object|null>} Full document with chunks array, or null if not found.
   */
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

  /**
   * Deletes a document and all of its associated chunks.
   *
   * @param {string} id - Document ID.
   * @returns {Promise<boolean>} True if found and deleted, false if not found.
   */
  async deleteById(id) {
    if (!this.documents.has(id)) {
      return false;
    }

    this.documents.delete(id);
    this.chunksByDocId.delete(id);
    return true;
  }

  /**
   * Retrieves all chunks belonging to a specific document ID.
   *
   * @param {string} documentId
   * @returns {Promise<Array<Object>>}
   */
  async findChunksByDocumentId(documentId) {
    const chunks = this.chunksByDocId.get(documentId);
    return chunks ? JSON.parse(JSON.stringify(chunks)) : [];
  }

  /**
   * Clears all documents and chunks from the in-memory store.
   *
   * @returns {Promise<void>}
   */
  async clear() {
    this.documents.clear();
    this.chunksByDocId.clear();
  }
}

// Singleton repository instance
export const knowledgeRepository = new KnowledgeRepository();
