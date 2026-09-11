/**
 * Knowledge Base API Service for AlertIQ
 *
 * Exposes methods to manage, list, search, and delete indexed security runbooks.
 */

import apiClient from "./apiClient.js";

/**
 * Ingests and chunks a new knowledge document into vector storage.
 * Endpoint: POST /api/knowledge/documents
 *
 * @param {Object} payload
 * @param {string} payload.title - Document title (required)
 * @param {string} payload.content - Raw document text content (required)
 * @param {string} [payload.source] - Document source/origin
 * @param {Object} [payload.metadata] - Key-value metadata (category, type, etc.)
 * @param {number} [payload.chunkSize] - Custom chunk token size
 * @param {number} [payload.overlap] - Custom chunk overlap token size
 * @returns {Promise<{
 *   success: boolean,
 *   message: string,
 *   document: Object,
 *   chunkCount: number,
 *   chunks: Array<Object>
 * }>}
 */
export const createDocument = async (payload) => {
  return apiClient.post("/api/knowledge/documents", payload);
};

/**
 * Uploads and extracts a Microsoft Word (.docx) document into vector storage.
 * Endpoint: POST /api/knowledge/documents/upload
 *
 * @param {FormData} formData - Multipart form containing 'file' (.docx) and optional metadata fields.
 * @returns {Promise<{
 *   success: boolean,
 *   message: string,
 *   document: Object,
 *   chunkCount: number
 * }>}
 */
export const uploadDocument = async (formData) => {
  return apiClient.post("/api/knowledge/documents/upload", formData);
};

/**
 * Lists all indexed knowledge documents (lightweight summary).
 * Endpoint: GET /api/knowledge/documents
 *
 * @returns {Promise<{
 *   success: boolean,
 *   total: number,
 *   documents: Array<{
 *     id: string,
 *     title: string,
 *     source: string,
 *     metadata: Object,
 *     chunkCount: number,
 *     createdAt: string,
 *     updatedAt: string
 *   }>
 * }>}
 */
export const getDocuments = async () => {
  return apiClient.get("/api/knowledge/documents");
};

/**
 * Retrieves a single knowledge document by ID including its chunk breakdown.
 * Endpoint: GET /api/knowledge/documents/:id
 *
 * @param {string} id - Document identifier
 * @returns {Promise<{
 *   success: boolean,
 *   document: {
 *     id: string,
 *     title: string,
 *     content: string,
 *     source: string,
 *     metadata: Object,
 *     chunks: Array<Object>,
 *     createdAt: string,
 *     updatedAt: string
 *   }
 * }>}
 */
export const getDocumentById = async (id) => {
  if (!id) throw new Error("Document ID is required.");
  return apiClient.get(`/api/knowledge/documents/${encodeURIComponent(id)}`);
};

/**
 * Deletes a document and all of its associated vector chunks.
 * Endpoint: DELETE /api/knowledge/documents/:id
 *
 * @param {string} id - Document identifier
 * @returns {Promise<{
 *   success: boolean,
 *   message: string,
 *   id: string
 * }>}
 */
export const deleteDocument = async (id) => {
  if (!id) throw new Error("Document ID is required.");
  return apiClient.delete(`/api/knowledge/documents/${encodeURIComponent(id)}`);
};

/**
 * Performs semantic similarity search across knowledge base chunks.
 * Endpoint: POST /api/knowledge/search
 *
 * @param {Object} params
 * @param {string} params.query - Search query string (required)
 * @param {number} [params.topK=5] - Number of top matches to retrieve
 * @param {number} [params.similarityThreshold=0.6] - Cosine similarity cutoff
 * @returns {Promise<{
 *   success: boolean,
 *   query: string,
 *   topK: number,
 *   similarityThreshold: number,
 *   totalIndexedChunks: number,
 *   matchedCount: number,
 *   results: Array<{
 *     chunkId: string,
 *     documentId: string,
 *     content: string,
 *     similarity: number,
 *     metadata: Object
 *   }>
 * }>}
 */
export const searchKnowledge = async ({ query, topK, similarityThreshold }) => {
  return apiClient.post("/api/knowledge/search", { query, topK, similarityThreshold });
};

export const knowledgeService = {
  createDocument,
  uploadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  searchKnowledge
};

export default knowledgeService;
