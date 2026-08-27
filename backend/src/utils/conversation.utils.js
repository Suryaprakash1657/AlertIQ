import { config } from "../config/env.js";

const VALID_ROLES = new Set(["user", "model", "assistant"]);

/**
 * Validates conversation messages array and items.
 *
 * @param {any} messages - Array of conversation messages.
 * @throws {Error} If messages is not an array or contains invalid message objects.
 */
export const validateMessages = (messages) => {
  if (messages === undefined || messages === null) {
    return;
  }

  if (!Array.isArray(messages)) {
    const error = new Error("Invalid request: 'messages' must be an array of message objects.");
    error.statusCode = 400;
    throw error;
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
      const error = new Error(`Invalid message at index ${i}: each message must be an object containing 'role' and 'content'.`);
      error.statusCode = 400;
      throw error;
    }

    if (!msg.role || typeof msg.role !== "string" || !VALID_ROLES.has(msg.role.toLowerCase())) {
      const error = new Error(
        `Invalid message at index ${i}: 'role' is required and must be one of: 'user', 'model', 'assistant'. Received: ${JSON.stringify(msg.role)}.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (msg.content === undefined || msg.content === null || typeof msg.content !== "string" || msg.content.trim() === "") {
      const error = new Error(
        `Invalid message at index ${i}: 'content' is required and must be a non-empty string.`
      );
      error.statusCode = 400;
      throw error;
    }
  }
};

/**
 * Trims conversation message history to the most recent N messages.
 *
 * @param {Array} [messages=[]] - Raw list of conversation messages.
 * @param {number} [limit=config.maxHistoryMessages] - Maximum number of history messages to preserve.
 * @returns {{
 *   messages: Array,
 *   historyMessagesReceived: number,
 *   historyMessagesUsed: number,
 *   historyTrimmed: boolean
 * }}
 */
export const trimMessageHistory = (messages = [], limit = config.maxHistoryMessages) => {
  const safeList = Array.isArray(messages) ? messages : [];
  const safeLimit = (typeof limit === "number" && !isNaN(limit) && limit > 0) ? limit : 10;
  const historyMessagesReceived = safeList.length;

  if (historyMessagesReceived > safeLimit) {
    const trimmed = safeList.slice(-safeLimit);
    return {
      messages: trimmed,
      historyMessagesReceived,
      historyMessagesUsed: trimmed.length,
      historyTrimmed: true
    };
  }

  return {
    messages: [...safeList],
    historyMessagesReceived,
    historyMessagesUsed: safeList.length,
    historyTrimmed: false
  };
};

/**
 * Formats conversation history messages and current prompt into Gemini structured contents format.
 *
 * @param {Array} historyMessages - Array of sanitized and trimmed history messages.
 * @param {string} currentPrompt - Current user prompt.
 * @returns {Array<{ role: string, parts: Array<{ text: string }> }>}
 */
export const formatConversationContents = (historyMessages = [], currentPrompt = "") => {
  const formattedHistory = (historyMessages || []).map((msg) => {
    const normalizedRole = msg.role.toLowerCase() === "assistant" ? "model" : msg.role.toLowerCase();
    return {
      role: normalizedRole,
      parts: [{ text: msg.content.trim() }]
    };
  });

  return [
    ...formattedHistory,
    {
      role: "user",
      parts: [{ text: currentPrompt.trim() }]
    }
  ];
};
