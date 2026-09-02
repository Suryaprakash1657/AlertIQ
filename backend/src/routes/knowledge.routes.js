import express from "express";
import {
  createDocument,
  listDocuments,
  getDocumentById,
  deleteDocument
} from "../controllers/knowledge.controller.js";

const router = express.Router();

// Document ingestion, chunking, and listing
router.post("/documents", createDocument);
router.get("/documents", listDocuments);

// Individual document retrieval and deletion
router.get("/documents/:id", getDocumentById);
router.delete("/documents/:id", deleteDocument);

export default router;
