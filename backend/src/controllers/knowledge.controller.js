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
import { extractTextFromDocx } from "../utils/docx.utils.js";

/**
 * Handles POST /api/knowledge/documents/upload
 * Accepts a multipart/form-data upload containing a .docx file, extracts text via Mammoth,
 * validates, chunks, generates embeddings, and persists document and vector chunks.
 */
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded. Please attach a .docx file in the 'file' field."
      });
    }

    const { buffer, originalname, size, mimetype } = req.file;

    // 1. Extract raw normalized text from the DOCX binary buffer
    const { text } = await extractTextFromDocx(buffer);

    // 2. Prepare title and metadata
    const rawTitle = req.body?.title ? String(req.body.title).trim() : "";
    const cleanFileName = originalname ? originalname.replace(/\.[^/.]+$/, "").trim() : "Uploaded Runbook";
    const documentTitle = rawTitle || cleanFileName || "Uploaded Runbook";

    const category = req.body?.category || req.body?.type || "Incident Runbook";
    const source = req.body?.source || "Uploaded Document (.docx)";
    const description = req.body?.description || `Extracted from ${originalname}`;

    let parsedMetadata = {};
    if (req.body?.metadata) {
      if (typeof req.body.metadata === "string") {
        try {
          parsedMetadata = JSON.parse(req.body.metadata);
        } catch {
          parsedMetadata = { rawMetadata: req.body.metadata };
        }
      } else if (typeof req.body.metadata === "object") {
        parsedMetadata = req.body.metadata;
      }
    }

    const mergedMetadata = {
      ...parsedMetadata,
      category,
      type: category,
      originalFileName: originalname,
      fileSize: size,
      mimeType: mimetype,
      description
    };

    const payload = {
      title: documentTitle,
      content: text,
      source,
      metadata: mergedMetadata
    };

    // 3. Ingest into knowledge base via existing pipeline
    const result = await createKnowledgeDocument(payload);

    // 4. Return summary response (omitting bulky chunk vectors)
    return res.status(201).json({
      success: true,
      message: "DOCX document extracted, chunked, and indexed successfully.",
      document: {
        id: result.document.id,
        title: result.document.title,
        source: result.document.source,
        metadata: result.document.metadata,
        chunkCount: result.chunkCount,
        createdAt: result.document.createdAt,
        updatedAt: result.document.updatedAt
      },
      chunkCount: result.chunkCount
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Failed to process and ingest uploaded DOCX document.";

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
};

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


