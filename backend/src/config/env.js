import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

// Helper to parse positive integer configuration with safe fallback
const parsePositiveInt = (value, fallback = 10) => {
  const parsed = parseInt(value, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : fallback;
};

// Helper to parse positive float configuration with safe fallback
const parsePositiveFloat = (value, fallback = 0.6) => {
  const parsed = parseFloat(value);
  return !isNaN(parsed) && parsed >= 0 && parsed <= 1.0 ? parsed : fallback;
};

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
  embeddingDimensions: 768,
  defaultRetrievalTopK: parsePositiveInt(process.env.DEFAULT_RETRIEVAL_TOP_K, 5),
  maxRetrievalTopK: parsePositiveInt(process.env.MAX_RETRIEVAL_TOP_K, 20),
  defaultSimilarityThreshold: parsePositiveFloat(process.env.DEFAULT_SIMILARITY_THRESHOLD, 0.6),
  maxRagContextChars: parsePositiveInt(process.env.MAX_RAG_CONTEXT_CHARS, 10000),
  maxHistoryMessages: parsePositiveInt(process.env.MAX_HISTORY_MESSAGES, 10),

  // Database Configuration (PostgreSQL + pgvector)
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: parsePositiveInt(process.env.DB_PORT, 5432),
  dbUser: process.env.DB_USER || "postgres",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "alertiq",
  dbSsl: process.env.DB_SSL === "true",
  dbMaxConnections: parsePositiveInt(process.env.DB_MAX_CONNECTIONS, 20),
  dbIdleTimeoutMillis: parsePositiveInt(process.env.DB_IDLE_TIMEOUT_MS, 30000),
  dbConnectionTimeoutMillis: parsePositiveInt(process.env.DB_CONN_TIMEOUT_MS, 5000)
};
