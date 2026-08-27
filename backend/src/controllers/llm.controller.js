import { generateCompletion } from "../services/llm.service.js";
import { validateMessages } from "../utils/conversation.utils.js";
import { validateAlert } from "../utils/alert.utils.js";

/**
 * Handle POST /api/llm/test
 * Accepts:
 * {
 *   "prompt": "...",
 *   "alert": { ... }, // optional structured alert object
 *   "messages": [ { "role": "user"|"model"|"assistant", "content": "..." } ] // optional
 * }
 * Returns LLM completion response with conversation metadata, alertContextUsed flag, usage tokens, and estimated cost.
 */
export const testLlmCompletion = async (req, res) => {
  try {
    const { prompt, messages, alert } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Prompt is required and must be a non-empty string."
      });
    }

    // Validate conversation messages if provided
    validateMessages(messages);

    // Validate structured alert object if provided
    const validatedAlert = validateAlert(alert);

    const result = await generateCompletion(prompt.trim(), messages || [], validatedAlert);

    return res.status(200).json({
      success: true,
      response: result.response,
      alertContextUsed: result.alertContextUsed,
      conversation: result.conversation,
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

