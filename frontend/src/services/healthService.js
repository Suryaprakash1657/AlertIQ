/**
 * Health API Service for AlertIQ
 *
 * Exposes methods to query backend service status and connectivity.
 */

import apiClient from "./apiClient.js";

/**
 * Checks backend health and runtime metadata.
 * Endpoint: GET /api/health
 *
 * @returns {Promise<{
 *   status: "ok",
 *   service: string,
 *   environment: string,
 *   timestamp: string
 * }>}
 */
export const checkHealth = async () => {
  return apiClient.get("/api/health");
};

export const healthService = {
  checkHealth
};

export default healthService;
