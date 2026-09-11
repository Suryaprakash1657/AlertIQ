import express from "express";
import {
  createDocument,
  uploadDocument,
  listDocuments,
  getDocumentById,
  deleteDocument,
  searchKnowledge
} from "../controllers/knowledge.controller.js";
import { handleDocxUpload } from "../middleware/upload.middleware.js";

const router = express.Router();

// Semantic search across indexed knowledge chunks
router.post("/search", searchKnowledge);

// Document ingestion, chunking, and listing
router.post("/documents", createDocument);
router.post("/documents/upload", handleDocxUpload("file"), uploadDocument);
router.get("/documents", listDocuments);

// Individual document retrieval and deletion
router.get("/documents/:id", getDocumentById);
router.delete("/documents/:id", deleteDocument);

export default router;

