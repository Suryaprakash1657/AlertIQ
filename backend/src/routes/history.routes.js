/**
 * Alert Analysis History Routes for AlertIQ (Module 3.26)
 */

import { Router } from "express";
import {
  getHistory,
  getHistoryById,
  deleteHistoryById
} from "../controllers/history.controller.js";

const router = Router();

// GET /api/history - Paginated & filtered list of past analyses
router.get("/", getHistory);

// GET /api/history/:analysisId - Detailed analysis record
router.get("/:analysisId", getHistoryById);

// DELETE /api/history/:analysisId - Delete a history record (for testing/cleanup)
router.delete("/:analysisId", deleteHistoryById);

export default router;
