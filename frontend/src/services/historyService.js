/**
 * Alert Analysis History API Service for AlertIQ
 *
 * Exposes methods to query, retrieve, and delete historical alert analysis records.
 */

import apiClient from "./apiClient.js";

/**
 * Retrieves a paginated list of past alert analyses with optional filters.
 * Endpoint: GET /api/history
 *
 * @param {Object} [params]
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.limit=20] - Records per page
 * @param {string} [params.severity] - Filter by alert severity (LOW, MEDIUM, HIGH, CRITICAL)
 * @param {string} [params.riskLevel] - Filter by analysis risk level (LOW, MEDIUM, HIGH, CRITICAL)
 * @param {string} [params.source] - Filter by telemetry source
 * @param {string} [params.ragStatus] - Filter by RAG status (success, no_match, empty_kb, failed, disabled)
 * @returns {Promise<{
 *   success: boolean,
 *   data: Array<{
 *     analysisId: number,
 *     alertId: number,
 *     externalAlertId?: string,
 *     title: string,
 *     severity: string,
 *     source: string,
 *     riskLevel: string,
 *     summary: string,
 *     model: string,
 *     ragStatus: string,
 *     matchesFound: number,
 *     sourcesUsedCount: number,
 *     createdAt: string
 *   }>,
 *   pagination: {
 *     page: number,
 *     limit: number,
 *     total: number,
 *     totalPages: number
 *   }
 * }>}
 */
export const getHistory = async (params = {}) => {
  const query = new URLSearchParams();

  if (params.page !== undefined && params.page !== null) {
    query.set("page", String(params.page));
  }
  if (params.limit !== undefined && params.limit !== null) {
    query.set("limit", String(params.limit));
  }
  if (params.severity) {
    query.set("severity", params.severity.trim());
  }
  if (params.riskLevel) {
    query.set("riskLevel", params.riskLevel.trim());
  }
  if (params.source) {
    query.set("source", params.source.trim());
  }
  if (params.ragStatus) {
    query.set("ragStatus", params.ragStatus.trim());
  }

  const queryString = query.toString();
  const endpoint = queryString ? `/api/history?${queryString}` : "/api/history";

  return apiClient.get(endpoint);
};

/**
 * Retrieves full analysis record including structured breakdown, alert details, and RAG sources.
 * Endpoint: GET /api/history/:analysisId
 *
 * @param {number|string} analysisId - Unique numeric ID of the analysis record
 * @returns {Promise<{
 *   success: boolean,
 *   data: {
 *     analysisId: number,
 *     alert: {
 *       id: number,
 *       alertId?: string,
 *       title: string,
 *       severity: string,
 *       source: string,
 *       timestamp?: string,
 *       description?: string,
 *       sourceIp?: string,
 *       destinationIp?: string,
 *       targetHost?: string,
 *       userName?: string,
 *       status?: string,
 *       evidence?: any,
 *       additionalDetails?: any,
 *       createdAt: string
 *     },
 *     analysis: {
 *       summary: string,
 *       riskAssessment: { level: string, reasoning: string },
 *       keyIndicators: string[],
 *       investigationSteps: string[],
 *       recommendedActions: string[],
 *       assumptions: string[],
 *       limitations: string[]
 *     },
 *     model: string,
 *     usage?: Object,
 *     ragStatus: string,
 *     matchesFound: number,
 *     sourcesUsedCount: number,
 *     sources: Array<{
 *       id: number,
 *       analysisId: number,
 *       documentId: string,
 *       title: string,
 *       source: string,
 *       category: string,
 *       similarity: number,
 *       createdAt: string
 *     }>,
 *     createdAt: string
 *   }
 * }>}
 */
export const getHistoryById = async (analysisId) => {
  if (!analysisId) throw new Error("Analysis ID is required.");
  return apiClient.get(`/api/history/${encodeURIComponent(analysisId)}`);
};

/**
 * Deletes a historical analysis record and its source provenance links.
 * Endpoint: DELETE /api/history/:analysisId
 *
 * @param {number|string} analysisId - Unique numeric ID of the analysis record
 * @returns {Promise<{
 *   success: boolean,
 *   message: string
 * }>}
 */
export const deleteHistoryById = async (analysisId) => {
  if (!analysisId) throw new Error("Analysis ID is required.");
  return apiClient.delete(`/api/history/${encodeURIComponent(analysisId)}`);
};

export const historyService = {
  getHistory,
  getHistoryById,
  deleteHistoryById
};

export default historyService;
