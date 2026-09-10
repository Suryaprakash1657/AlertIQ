import express from "express";
import { analyzeAlert, chatWithAlert } from "../controllers/alert.controller.js";

const router = express.Router();

// POST /api/alerts/analyze - Production Alert Analysis Pipeline Orchestration
router.post("/analyze", analyzeAlert);

// POST /api/alerts/chat - Dedicated Conversational Follow-Up Chat Assistant
router.post("/chat", chatWithAlert);

export default router;

