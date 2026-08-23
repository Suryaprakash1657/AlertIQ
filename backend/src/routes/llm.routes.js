import express from "express";
import { testLlmCompletion } from "../controllers/llm.controller.js";

const router = express.Router();

// POST /api/llm/test - Test endpoint for verifying LLM connectivity and first completion
router.post("/test", testLlmCompletion);

export default router;
