/**
 * Alert Normalization and Mapping Utilities for AlertIQ
 *
 * Normalizes frontend alert representations to match backend validation schemas
 * without fabricating or inventing security data.
 */

const VALID_SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

/**
 * Normalizes a raw severity string into the canonical uppercase enum format.
 *
 * @param {string} severity - e.g. "high", "High", "HIGH"
 * @returns {string} Normalized severity ("LOW", "MEDIUM", "HIGH", "CRITICAL")
 */
export const normalizeSeverity = (severity) => {
  if (!severity || typeof severity !== "string") return "MEDIUM";
  const upper = severity.trim().toUpperCase();
  return VALID_SEVERITIES.has(upper) ? upper : "MEDIUM";
};

/**
 * Maps and normalizes a frontend alert object into the strict backend validation contract.
 *
 * Backend Requirements (Module 3.16 / validateAlert):
 * - title: Non-empty string (required)
 * - severity: LOW | MEDIUM | HIGH | CRITICAL (required)
 * - source: Non-empty string (required)
 * - alertId: Optional string
 * - timestamp: Optional valid date/ISO string
 * - description: Optional string
 * - sourceIp: Optional string
 * - destinationIp: Optional string
 * - targetHost: Optional string (mapped from affectedAsset if present)
 * - user: Optional string
 * - status: Optional string
 * - evidence: Optional string/array/object
 * - additionalDetails: Optional object
 *
 * @param {Object} alert - Raw frontend alert object
 * @param {Object} [options] - Additional runtime options (prompt, messages, enableRag, topK, similarityThreshold)
 * @returns {Object} Validated payload ready for POST /api/alerts/analyze
 */
export const mapAlertToBackendPayload = (alert, options = {}) => {
  if (!alert || typeof alert !== "object") {
    throw new Error("Invalid alert: An alert object is required for analysis.");
  }

  const title = (alert.title || alert.name || "").trim();
  if (!title) {
    throw new Error("Invalid alert: 'title' is required.");
  }

  const source = (alert.source || "Security Detection Sensor").trim();
  const severity = normalizeSeverity(alert.severity);

  // Map fields cleanly without inventing synthetic data
  const normalizedAlert = {
    title,
    severity,
    source,
    ...(alert.id && { alertId: String(alert.id).trim() }),
    ...(alert.alertId && { alertId: String(alert.alertId).trim() }),
    ...(alert.timestamp && { timestamp: String(alert.timestamp).trim() }),
    ...(alert.description && { description: String(alert.description).trim() }),
    ...(alert.affectedAsset && { targetHost: String(alert.affectedAsset).trim() }),
    ...(alert.targetHost && { targetHost: String(alert.targetHost).trim() }),
    ...(alert.sourceIp && { sourceIp: String(alert.sourceIp).trim() }),
    ...(alert.destinationIp && { destinationIp: String(alert.destinationIp).trim() }),
    ...(alert.user && { user: String(alert.user).trim() }),
    ...(alert.status && { status: String(alert.status).trim() }),
    ...(alert.evidence !== undefined && alert.evidence !== null && { evidence: alert.evidence }),
    ...(alert.rawLogs !== undefined && alert.rawLogs !== null && !alert.evidence && { evidence: alert.rawLogs }),
    ...(alert.additionalDetails && typeof alert.additionalDetails === "object" && { additionalDetails: alert.additionalDetails })
  };

  const payload = {
    alert: normalizedAlert
  };

  if (options.prompt && typeof options.prompt === "string" && options.prompt.trim()) {
    payload.prompt = options.prompt.trim();
  }

  if (Array.isArray(options.messages) && options.messages.length > 0) {
    payload.messages = options.messages;
  }

  if (options.enableRag !== undefined) {
    payload.enableRag = Boolean(options.enableRag);
  }

  if (typeof options.topK === "number" && options.topK > 0) {
    payload.topK = Math.floor(options.topK);
  }

  if (typeof options.similarityThreshold === "number" && options.similarityThreshold >= 0 && options.similarityThreshold <= 1.0) {
    payload.similarityThreshold = options.similarityThreshold;
  }

  return payload;
};

export default {
  normalizeSeverity,
  mapAlertToBackendPayload
};
