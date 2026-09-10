/**
 * Alert Analysis API Service for AlertIQ
 *
 * Exposes methods to trigger structured AI alert mitigation analysis with RAG.
 */

import apiClient from "./apiClient.js";

/**
 * Executes the full production alert analysis pipeline.
 * Endpoint: POST /api/alerts/analyze
 *
 * @param {Object} payload
 * @param {Object} payload.alert - Normalized structured alert object (required)
 * @param {string} [payload.prompt] - Optional additional investigation question
 * @param {Array<{role: string, content: string}>} [payload.messages] - Optional prior conversation messages
 * @param {boolean} [payload.enableRag=true] - Optional flag to enable/disable RAG retrieval
 * @param {number} [payload.topK] - Optional number of RAG chunks to retrieve
 * @param {number} [payload.similarityThreshold] - Optional similarity score threshold
 * @returns {Promise<{
 *   success: boolean,
 *   analysis: {
 *     summary: string,
 *     riskAssessment: { level: string, reasoning: string },
 *     keyIndicators: string[],
 *     investigationSteps: string[],
 *     recommendedActions: string[],
 *     assumptions: string[],
 *     limitations: string[]
 *   },
 *   knowledgeContext: {
 *     status: "success"|"no_match"|"empty_kb"|"failed"|"disabled",
 *     query?: string,
 *     topK?: number,
 *     similarityThreshold?: number,
 *     matchesFound: number,
 *     sourcesUsed: Array<{
 *       documentId: string,
 *       title: string,
 *       source: string,
 *       category: string,
 *       similarity: number
 *     }>,
 *     error?: string
 *   },
 *   conversation: {
 *     historyMessagesReceived: number,
 *     historyMessagesUsed: number,
 *     historyTrimmed: boolean
 *   },
 *   model: string,
 *   usage: {
 *     inputTokens: number,
 *     outputTokens: number,
 *     totalTokens: number
 *   },
 *   estimatedCost: Object,
 *   persistence: {
 *     saved: boolean,
 *     analysisId?: number,
 *     alertRecordId?: number
 *   }
 * }>}
 */
export const analyzeAlert = async (payload) => {
  return apiClient.post("/api/alerts/analyze", payload);
};

/**
 * Executes conversational follow-up chat for an active alert.
 * Endpoint: POST /api/alerts/chat
 *
 * @param {Object} payload
 * @param {Object} payload.alert - Normalized structured alert object (required)
 * @param {string} payload.prompt - User follow-up question (required)
 * @param {Array<{role: string, content: string}>} [payload.messages] - Prior conversation messages
 * @param {boolean} [payload.enableRag=true] - Optional flag to enable/disable RAG retrieval
 * @param {number} [payload.topK] - Optional number of RAG chunks to retrieve
 * @param {number} [payload.similarityThreshold] - Optional similarity cutoff
 * @returns {Promise<{
 *   success: boolean,
 *   response: string,
 *   isOutOfScope: boolean,
 *   citations: Array<{ documentId: string, title: string, source: string, category: string, similarity: number }>,
 *   knowledgeContext: Object,
 *   conversation: Object,
 *   model: string,
 *   usage: Object,
 *   estimatedCost: Object
 * }>}
 */
export const chatWithAlert = async (payload) => {
  return apiClient.post("/api/alerts/chat", payload);
};

export const alertService = {
  analyzeAlert,
  chatWithAlert
};

export default alertService;

