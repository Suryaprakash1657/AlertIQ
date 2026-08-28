import { ALERTIQ_SYSTEM_INSTRUCTION } from "./prompts.js";

export const VALID_RISK_LEVELS = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const DEFAULT_ANALYSIS_PROMPT = "Perform a comprehensive defensive cybersecurity analysis and risk assessment on this alert.";

/**
 * Enhanced system instruction for structured cybersecurity alert analysis.
 * Incorporates base AlertIQ safety and incident-response guidelines with exact JSON schema constraints.
 */
export const STRUCTURED_ANALYSIS_SYSTEM_INSTRUCTION = `${ALERTIQ_SYSTEM_INSTRUCTION}

You MUST respond ONLY with a valid JSON object matching this exact schema:
{
  "summary": "string - concise executive overview of the security alert and incident context",
  "riskAssessment": {
    "level": "LOW | MEDIUM | HIGH | CRITICAL",
    "reasoning": "string - technical justification for why this specific risk level was assigned based on provided evidence"
  },
  "keyIndicators": ["string - specific observable IOCs, anomalies, or suspicious artifacts"],
  "investigationSteps": ["string - concrete, defensive triage and investigative actions"],
  "recommendedActions": ["string - prioritized containment, remediation, or mitigation steps"],
  "assumptions": ["string - explicit assumptions made due to missing or partial telemetry"],
  "limitations": ["string - technical boundaries or data limitations in the provided alert"]
}

Strict requirements:
1. Output valid JSON only. Do NOT include markdown formatting, code fences, or explanatory text outside the JSON object.
2. The riskAssessment.level MUST be one of: LOW, MEDIUM, HIGH, CRITICAL based on the technical risk of the alert.
3. All list fields (keyIndicators, investigationSteps, recommendedActions, assumptions, limitations) MUST be JSON arrays of strings.
4. Clearly distinguish between facts directly present in the alert and analytical assumptions.
5. Never claim access to systems, logs, or tools that were not explicitly provided in the alert context.`;

/**
 * Strips markdown code block fences (```json ... ``` or ``` ... ```) if present.
 *
 * @param {string} rawText - Raw string from LLM.
 * @returns {string} Cleaned JSON string.
 */
export const cleanJsonText = (rawText) => {
  if (typeof rawText !== "string") return "";

  let cleaned = rawText.trim();

  // Match and strip markdown code fences if Gemini added them defensively
  const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  }

  return cleaned;
};

/**
 * Parses raw LLM text into a JSON object safely.
 *
 * @param {string} rawText - Raw text from LLM response.
 * @returns {Object} Parsed JSON object.
 * @throws {Error} If JSON parsing fails.
 */
export const parseAnalysisResponse = (rawText) => {
  const cleaned = cleanJsonText(rawText);

  if (!cleaned) {
    const error = new Error("LLM response was empty or contained no valid content.");
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const error = new Error("LLM failed to return a valid JSON format response.");
    error.statusCode = 502;
    throw error;
  }
};

/**
 * Normalizes an array field to ensure it is an array of strings.
 *
 * @param {any} arr - The value to normalize.
 * @param {string} fieldName - Field name for error reporting.
 * @returns {string[]} Array of strings.
 */
const normalizeStringArray = (arr, fieldName) => {
  if (arr === undefined || arr === null) {
    return [];
  }

  if (!Array.isArray(arr)) {
    if (typeof arr === "string" && arr.trim() !== "") {
      return [arr.trim()];
    }
    const error = new Error(`LLM analysis error: '${fieldName}' must be an array of strings.`);
    error.statusCode = 502;
    throw error;
  }

  return arr
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item !== null && item !== undefined) return String(item).trim();
      return "";
    })
    .filter((item) => item.length > 0);
};

/**
 * Validates and normalizes structured analysis output against the AlertIQ schema.
 *
 * @param {any} data - Parsed JSON object from LLM.
 * @returns {Object} Validated and normalized analysis object.
 * @throws {Error} If required fields fail validation.
 */
export const validateAndNormalizeAnalysis = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    const error = new Error("LLM analysis output is not a valid JSON object.");
    error.statusCode = 502;
    throw error;
  }

  // Validate summary (Required non-empty string)
  if (typeof data.summary !== "string" || data.summary.trim() === "") {
    const error = new Error("LLM analysis output missing required 'summary' string.");
    error.statusCode = 502;
    throw error;
  }

  // Validate riskAssessment (Required object)
  if (!data.riskAssessment || typeof data.riskAssessment !== "object" || Array.isArray(data.riskAssessment)) {
    const error = new Error("LLM analysis output missing required 'riskAssessment' object.");
    error.statusCode = 502;
    throw error;
  }

  // Validate riskAssessment.level (Required enum: LOW, MEDIUM, HIGH, CRITICAL)
  const rawLevel = typeof data.riskAssessment.level === "string" ? data.riskAssessment.level.trim().toUpperCase() : "";
  if (!rawLevel || !VALID_RISK_LEVELS.has(rawLevel)) {
    const error = new Error(
      `LLM analysis output contains invalid riskAssessment level: '${data.riskAssessment.level}'. Must be LOW, MEDIUM, HIGH, or CRITICAL.`
    );
    error.statusCode = 502;
    throw error;
  }

  const reasoning = typeof data.riskAssessment.reasoning === "string"
    ? data.riskAssessment.reasoning.trim()
    : "";

  // Normalize all array fields
  const keyIndicators = normalizeStringArray(data.keyIndicators, "keyIndicators");
  const investigationSteps = normalizeStringArray(data.investigationSteps, "investigationSteps");
  const recommendedActions = normalizeStringArray(data.recommendedActions, "recommendedActions");
  const assumptions = normalizeStringArray(data.assumptions, "assumptions");
  const limitations = normalizeStringArray(data.limitations, "limitations");

  return {
    summary: data.summary.trim(),
    riskAssessment: {
      level: rawLevel,
      reasoning
    },
    keyIndicators,
    investigationSteps,
    recommendedActions,
    assumptions,
    limitations
  };
};
