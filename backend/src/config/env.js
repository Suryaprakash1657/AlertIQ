import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development"
};
