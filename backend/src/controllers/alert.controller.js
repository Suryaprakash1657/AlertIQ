/**
 * Alert Analysis Controller for AlertIQ (Module 3.23)
 *
 * Exposes the production analysis orchestration endpoint: POST /api/alerts/analyze
 */

import { analyzeAlertPipeline } from "../services/alert-analysis.service.js";

/**
 * Handle POST /api/alerts/analyze
 *
 * Accepts:
 * {
 *   "alert": { ... }, // required structured alert
 *   "prompt": "...",  // optional investigation question/focus
 *   "messages": [ ... ], // optional prior conversation turns
 *   "enableRag": true, // optional boolean (default: true)
 *   "topK": 5,         // optional positive integer
 *   "similarityThreshold": 0.60 // optional float between -1.0 and 1.0
 * }
 *
 * Returns structured analysis, knowledge context metadata, conversation metadata, model, usage tokens, and estimated cost.
 */
export const analyzeAlert = async (req, res) => {
  try {
    const payload = req.body || {};

    const result = await analyzeAlertPipeline(payload);

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Failed to analyze security alert.";

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
};
