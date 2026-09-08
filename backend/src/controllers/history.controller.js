/**
 * Alert Analysis History Controller for AlertIQ (Module 3.26)
 *
 * Exposes endpoints for querying and retrieving persisted alert analysis history:
 * - GET /api/history - Paginated, filtered list of past analyses
 * - GET /api/history/:analysisId - Full analysis details including alert context and RAG provenance
 * - DELETE /api/history/:analysisId - Deletes a history record
 */

import { alertHistoryRepository } from "../repositories/alert-history.repository.js";
import { sanitizeErrorMessage } from "../services/embedding.service.js";

/**
 * Handle GET /api/history
 *
 * Query parameters:
 * - page: Positive integer (default: 1)
 * - limit: Positive integer 1-100 (default: 20)
 * - severity: Filter by alert severity (LOW, MEDIUM, HIGH, CRITICAL)
 * - riskLevel: Filter by analysis risk level (LOW, MEDIUM, HIGH, CRITICAL)
 * - source: Filter by alert source
 * - ragStatus: Filter by RAG status (success, no_match, empty_kb, failed, disabled)
 */
export const getHistory = async (req, res) => {
  try {
    const { page, limit, severity, riskLevel, source, ragStatus } = req.query;

    const result = await alertHistoryRepository.findAllAnalyses({
      page,
      limit,
      severity,
      riskLevel,
      source,
      ragStatus
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    const sanitized = sanitizeErrorMessage(error?.message || "Failed to retrieve alert analysis history.");
    return res.status(500).json({
      success: false,
      error: sanitized
    });
  }
};

/**
 * Handle GET /api/history/:analysisId
 *
 * Returns complete persisted analysis record including structured breakdown,
 * alert details, and RAG source provenance metadata (without vectors).
 */
export const getHistoryById = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const numericId = parseInt(analysisId, 10);

    if (isNaN(numericId) || numericId <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid analysis ID: Must be a positive integer."
      });
    }

    const record = await alertHistoryRepository.findAnalysisById(numericId);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: `Analysis history record with ID ${numericId} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: record
    });
  } catch (error) {
    const sanitized = sanitizeErrorMessage(error?.message || "Failed to retrieve analysis details.");
    return res.status(500).json({
      success: false,
      error: sanitized
    });
  }
};

/**
 * Handle DELETE /api/history/:analysisId
 */
export const deleteHistoryById = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const numericId = parseInt(analysisId, 10);

    if (isNaN(numericId) || numericId <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid analysis ID: Must be a positive integer."
      });
    }

    const deleted = await alertHistoryRepository.deleteAnalysisById(numericId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `Analysis history record with ID ${numericId} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      message: `Analysis record ${numericId} and associated history data deleted successfully.`
    });
  } catch (error) {
    const sanitized = sanitizeErrorMessage(error?.message || "Failed to delete analysis record.");
    return res.status(500).json({
      success: false,
      error: sanitized
    });
  }
};
