import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Helper to parse positive integer configuration with safe fallback
const parsePositiveInt = (value, fallback = 10) => {
  const parsed = parseInt(value, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  maxHistoryMessages: parsePositiveInt(process.env.MAX_HISTORY_MESSAGES, 10)
};
