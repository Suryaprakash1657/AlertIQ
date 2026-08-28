import express from "express";
import { testLlmCompletion, analyzeAlert } from "../controllers/llm.controller.js";

const router = express.Router();

// POST /api/llm/test - Free-form completion endpoint (backward-compatible)
router.post("/test", testLlmCompletion);

// POST /api/llm/analyze - Structured security alert analysis endpoint
router.post("/analyze", analyzeAlert);

export default router;
