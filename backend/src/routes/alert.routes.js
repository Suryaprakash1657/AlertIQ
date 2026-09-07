import express from "express";
import { analyzeAlert } from "../controllers/alert.controller.js";

const router = express.Router();

// POST /api/alerts/analyze - Production Alert Analysis Pipeline Orchestration
router.post("/analyze", analyzeAlert);

export default router;
