import { generateCompletion, generateAlertAnalysis } from "../services/llm.service.js";
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
 * Returns free-form LLM completion response with conversation metadata, alertContextUsed flag, usage tokens, and estimated cost.
 */
export const testLlmCompletion = async (req, res) => {
  try {
    const { prompt, messages, alert } = req.body || {};

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

/**
 * Handle POST /api/llm/analyze
 * Accepts:
 * {
 *   "alert": { ... }, // required structured alert object
 *   "prompt": "...",  // optional additional investigation question
 *   "messages": [ ... ] // optional prior conversation messages
 * }
 * Returns structured security analysis object, conversation metadata, usage tokens, and estimated cost.
 */
export const analyzeAlert = async (req, res) => {
  try {
    const { alert, prompt, messages, enableRag, topK, similarityThreshold } = req.body || {};

    // Alert is strictly required for analysis
    if (alert === undefined || alert === null) {
      return res.status(400).json({
        success: false,
        error: "Invalid request: 'alert' is required for structured analysis."
      });
    }

    // Validate structured alert
    const validatedAlert = validateAlert(alert);

    // Validate optional prompt
    if (prompt !== undefined && prompt !== null && typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid request: 'prompt' must be a string if provided."
      });
    }

    // Validate optional conversation messages
    validateMessages(messages);

    const ragOptions = {
      ...(enableRag !== undefined && { enableRag }),
      ...(topK !== undefined && { topK }),
      ...(similarityThreshold !== undefined && { similarityThreshold })
    };

    const result = await generateAlertAnalysis(validatedAlert, prompt, messages || [], ragOptions);

    return res.status(200).json({
      success: true,
      analysis: result.analysis,
      retrieval: result.retrieval,
      conversation: result.conversation,
      model: result.model,
      usage: result.usage,
      estimatedCost: result.estimatedCost
    });

  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || "Failed to generate structured alert analysis.";

    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
};
