/**
 * Knowledge Base Controller
 *
 * Exposes REST endpoints for knowledge document ingestion, chunking, listing,
 * individual document retrieval, and deletion.
 */

import {
  createKnowledgeDocument,
  listKnowledgeDocuments,
  getKnowledgeDocumentById,
  deleteKnowledgeDocument
} from "../services/knowledge.service.js";
import { retrieveKnowledge } from "../services/retrieval.service.js";

/**
 * Handles POST /api/knowledge/documents
 * Ingests a new knowledge document, validates it, generates chunks, and stores it.
 */
export const createDocument = async (req, res) => {
  try {
    const payload = req.body;
    const result = await createKnowledgeDocument(payload);

    return res.status(201).json({
      success: true,
      message: "Knowledge document ingested and chunked successfully.",
      document: result.document,
      chunkCount: result.chunkCount,
      chunks: result.chunks
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Failed to ingest knowledge document.";

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
};

/**
 * Handles GET /api/knowledge/documents
 * Returns a list of all documents in the knowledge base.
 */
export const listDocuments = async (req, res) => {
  try {
    const result = await listKnowledgeDocuments();

    return res.status(200).json({
      success: true,
      total: result.total,
      documents: result.documents
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Failed to list knowledge documents.";

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
};

/**
 * Handles GET /api/knowledge/documents/:id
 * Retrieves a single document by its ID along with its full chunk list.
 */
export const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await getKnowledgeDocumentById(id);

    return res.status(200).json({
      success: true,
      document
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Failed to retrieve knowledge document.";

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
};

/**
 * Handles DELETE /api/knowledge/documents/:id
 * Deletes a document and all of its associated chunks.
 */
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteKnowledgeDocument(id);

    return res.status(200).json({
      success: true,
      message: result.message,
      id: result.id
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Failed to delete knowledge document.";

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
};

/**
 * Handles POST /api/knowledge/search
 * Performs semantic similarity retrieval across indexed knowledge-base chunks.
 */
export const searchKnowledge = async (req, res) => {
  try {
    const { query, topK, similarityThreshold } = req.body || {};
    const result = await retrieveKnowledge(query, { topK, similarityThreshold });

    return res.status(200).json({
      success: true,
      query: result.query,
      topK: result.topK,
      similarityThreshold: result.similarityThreshold,
      totalIndexedChunks: result.totalIndexedChunks,
      matchedCount: result.matchedCount,
      results: result.results
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Failed to perform knowledge retrieval.";

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
};


