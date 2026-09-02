/**
 * Knowledge Base Service
 *
 * Implements business logic for document ingestion, validation, text chunking,
 * listing, retrieval, and deletion in AlertIQ.
 */

import { knowledgeRepository } from "../repositories/knowledge.repository.js";
import { validateDocumentPayload, normalizeDocument } from "../utils/document.utils.js";
import { createDocumentChunks } from "../utils/chunking.utils.js";

/**
 * Ingests a new knowledge document, validates its schema, performs text chunking,
 * and persists the document and its chunks into storage.
 *
 * @param {Object} payload - Ingestion payload containing title, content, and optional metadata/source/chunk options.
 * @returns {Promise<{
 *   document: Object,
 *   chunks: Array<Object>,
 *   chunkCount: number
 * }>}
 */
export const createKnowledgeDocument = async (payload) => {
  // 1. Validate payload schema and parameters
  const validatedPayload = validateDocumentPayload(payload);

  // 2. Normalize into a complete document entity
  const documentEntity = normalizeDocument(validatedPayload);

  // 3. Generate structured text chunks with metadata
  const chunkOptions = {
    chunkSize: validatedPayload.chunkSize,
    overlap: validatedPayload.overlap
  };
  const chunks = createDocumentChunks(documentEntity, chunkOptions);

  // 4. Persist document and chunks via repository
  const saved = await knowledgeRepository.create(documentEntity, chunks);

  return {
    document: saved.document,
    chunks: saved.chunks,
    chunkCount: saved.chunks.length
  };
};

/**
 * Lists all knowledge documents currently indexed in the knowledge base.
 * Returns a lightweight summary omitting bulky chunk text bodies.
 *
 * @param {Object} [options]
 * @returns {Promise<{
 *   total: number,
 *   documents: Array<Object>
 * }>}
 */
export const listKnowledgeDocuments = async (options = {}) => {
  const documents = await knowledgeRepository.findAll(options);
  return {
    total: documents.length,
    documents
  };
};

/**
 * Retrieves a single knowledge document by its ID, including all of its generated chunks.
 *
 * @param {string} id - Document identifier.
 * @returns {Promise<Object>} Full document entity with chunks array.
 * @throws {Error} with statusCode 404 if not found, or 400 if invalid ID.
 */
export const getKnowledgeDocumentById = async (id) => {
  if (!id || typeof id !== "string" || id.trim() === "") {
    const error = new Error("Invalid request: Document ID must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }

  const document = await knowledgeRepository.findById(id.trim());
  if (!document) {
    const error = new Error(`Document with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return document;
};

/**
 * Deletes a knowledge document and its associated chunks from the knowledge base.
 *
 * @param {string} id - Document identifier.
 * @returns {Promise<{ id: string, deleted: boolean, message: string }>}
 * @throws {Error} with statusCode 404 if not found, or 400 if invalid ID.
 */
export const deleteKnowledgeDocument = async (id) => {
  if (!id || typeof id !== "string" || id.trim() === "") {
    const error = new Error("Invalid request: Document ID must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }

  const deleted = await knowledgeRepository.deleteById(id.trim());
  if (!deleted) {
    const error = new Error(`Document with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return {
    id: id.trim(),
    deleted: true,
    message: `Document '${id.trim()}' and all associated chunks were successfully deleted.`
  };
};

/**
 * Clears the knowledge base. Primarily used in test setups.
 *
 * @returns {Promise<void>}
 */
export const clearKnowledgeBase = async () => {
  await knowledgeRepository.clear();
};
