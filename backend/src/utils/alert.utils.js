/**
 * Alert Utilities for AlertIQ
 *
 * Provides schema validation and context formatting for cybersecurity alerts.
 */

export const VALID_SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

/**
 * Validates and normalizes a structured alert object.
 *
 * @param {any} alert - The alert object to validate.
 * @returns {Object} Normalized alert object.
 * @throws {Error} If the alert object or its fields fail validation.
 */
export const validateAlert = (alert) => {
  if (alert === undefined || alert === null) {
    return null;
  }

  if (typeof alert !== "object" || Array.isArray(alert)) {
    const error = new Error("Invalid request: 'alert' must be an object.");
    error.statusCode = 400;
    throw error;
  }

  // Required Field: title
  if (!alert.title || typeof alert.title !== "string" || alert.title.trim() === "") {
    const error = new Error("Invalid alert: 'title' is required and must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }

  // Required Field: severity
  if (!alert.severity || typeof alert.severity !== "string" || alert.severity.trim() === "") {
    const error = new Error("Invalid alert: 'severity' is required and must be one of: LOW, MEDIUM, HIGH, CRITICAL.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedSeverity = alert.severity.trim().toUpperCase();
  if (!VALID_SEVERITIES.has(normalizedSeverity)) {
    const error = new Error(
      `Invalid alert: 'severity' must be one of: LOW, MEDIUM, HIGH, CRITICAL. Received: "${alert.severity}".`
    );
    error.statusCode = 400;
    throw error;
  }

  // Required Field: source
  if (!alert.source || typeof alert.source !== "string" || alert.source.trim() === "") {
    const error = new Error("Invalid alert: 'source' is required and must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }

  // Optional Field Validation: timestamp
  if (alert.timestamp !== undefined && alert.timestamp !== null) {
    if (typeof alert.timestamp !== "string" || alert.timestamp.trim() === "" || isNaN(Date.parse(alert.timestamp))) {
      const error = new Error("Invalid alert: 'timestamp' must be a valid date/timestamp string.");
      error.statusCode = 400;
      throw error;
    }
  }

  // Optional string fields type validation if provided
  const stringOptionalFields = ["alertId", "description", "sourceIp", "destinationIp", "targetHost", "user", "status"];
  for (const field of stringOptionalFields) {
    if (alert[field] !== undefined && alert[field] !== null && typeof alert[field] !== "string") {
      const error = new Error(`Invalid alert: '${field}' must be a string if provided.`);
      error.statusCode = 400;
      throw error;
    }
  }

  return {
    ...alert,
    title: alert.title.trim(),
    severity: normalizedSeverity,
    source: alert.source.trim(),
    ...(alert.alertId && { alertId: alert.alertId.trim() }),
    ...(alert.timestamp && { timestamp: alert.timestamp.trim() }),
    ...(alert.description && { description: alert.description.trim() }),
    ...(alert.sourceIp && { sourceIp: alert.sourceIp.trim() }),
    ...(alert.destinationIp && { destinationIp: alert.destinationIp.trim() }),
    ...(alert.targetHost && { targetHost: alert.targetHost.trim() }),
    ...(alert.user && { user: alert.user.trim() }),
    ...(alert.status && { status: alert.status.trim() })
  };
};

/**
 * Formats evidence/logs data safely into string representation.
 *
 * @param {any} evidence - Raw evidence data (string, array, or object).
 * @returns {string} Formatted evidence text.
 */
const formatEvidence = (evidence) => {
  if (evidence === undefined || evidence === null) return "";
  
  if (typeof evidence === "string") {
    return evidence.trim();
  }

  if (Array.isArray(evidence)) {
    return evidence
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          return `- ${JSON.stringify(item)}`;
        }
        return `- ${String(item)}`;
      })
      .join("\n");
  }

  if (typeof evidence === "object") {
    try {
      return JSON.stringify(evidence, null, 2);
    } catch {
      return String(evidence);
    }
  }

  return String(evidence);
};

/**
 * Builds a clear, structured Markdown context block from an alert object.
 *
 * @param {Object} alert - The validated alert object.
 * @returns {string} Formatted security alert context string.
 */
export const buildAlertContext = (alert) => {
  if (!alert) return "";

  const lines = ["### SECURITY ALERT CONTEXT ###"];

  if (alert.alertId) lines.push(`- Alert ID: ${alert.alertId}`);
  lines.push(`- Title: ${alert.title}`);
  lines.push(`- Severity: ${alert.severity}`);
  lines.push(`- Source: ${alert.source}`);
  if (alert.timestamp) lines.push(`- Timestamp: ${alert.timestamp}`);
  if (alert.status) lines.push(`- Status: ${alert.status}`);
  if (alert.sourceIp) lines.push(`- Source IP: ${alert.sourceIp}`);
  if (alert.destinationIp) lines.push(`- Destination IP: ${alert.destinationIp}`);
  if (alert.targetHost) lines.push(`- Target Host: ${alert.targetHost}`);
  if (alert.user) lines.push(`- Affected User/Account: ${alert.user}`);
  if (alert.description) lines.push(`- Description: ${alert.description}`);

  // Handle rawLogs / evidence
  const rawLogs = alert.rawLogs || alert.evidence;
  if (rawLogs !== undefined && rawLogs !== null && (typeof rawLogs !== "string" || rawLogs.trim() !== "")) {
    const formattedLogs = formatEvidence(rawLogs);
    if (formattedLogs) {
      lines.push(`- Evidence/Logs:\n${formattedLogs}`);
    }
  }

  // Handle additionalDetails
  if (alert.additionalDetails && typeof alert.additionalDetails === "object") {
    try {
      const detailsStr = JSON.stringify(alert.additionalDetails, null, 2);
      if (detailsStr && detailsStr !== "{}") {
        lines.push(`- Additional Telemetry:\n${detailsStr}`);
      }
    } catch {
      // Gracefully ignore serialization failures
    }
  }

  lines.push("###############################");

  return lines.join("\n");
};
