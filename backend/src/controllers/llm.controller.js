import { generateCompletion } from "../services/llm.service.js";

/**
 * Handle POST /api/llm/test
 * Accepts { "prompt": "..." } and returns LLM completion response.
 */
export const testLlmCompletion = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Prompt is required and must be a non-empty string."
      });
    }

    const result = await generateCompletion(prompt.trim());

    return res.status(200).json({
      success: true,
      response: result.response,
      model: result.model,
      usage: result.usage,
      estimatedCost: result.estimatedCost
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Failed to generate LLM completion.";

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
};
