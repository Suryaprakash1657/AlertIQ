/**
 * Centralized API Client for AlertIQ Frontend
 *
 * Provides a robust fetch wrapper for all backend API interactions:
 * - Supports GET, POST, DELETE methods
 * - Transparent support for Vite `/api` proxy & configurable `VITE_API_BASE_URL`
 * - Safe JSON parsing with fallback
 * - Preserves structured backend error messages
 * - Distinguishes HTTP error responses from network/connectivity failures
 * - Zero secret leakage
 */

export class ApiError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {Object} [options]
   * @param {number} [options.status=0] - HTTP status code (0 for network/abort errors).
   * @param {any} [options.data=null] - Parsed response payload from backend if available.
   * @param {boolean} [options.isNetworkError=false] - True if connection failed/dropped.
   */
  constructor(message, { status = 0, data = null, isNetworkError = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
    this.isRateLimit = status === 429 || status === 503;
    this.isNotFound = status === 404;
    this.isBadRequest = status === 400;
  }
}

/**
 * Resolves the target URL given the endpoint and environment configuration.
 *
 * @param {string} endpoint - Path such as "/api/health" or "health"
 * @returns {string} Fully-qualified or proxy-compatible relative URL
 */
const buildUrl = (endpoint) => {
  const rawBase = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  let normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // If using Vite dev proxy and endpoint doesn't start with /api, ensure /api prefix
  if (!rawBase && !normalizedEndpoint.startsWith("/api")) {
    normalizedEndpoint = `/api${normalizedEndpoint}`;
  }

  return rawBase ? `${rawBase}${normalizedEndpoint}` : normalizedEndpoint;
};

/**
 * Executes an HTTP request and parses the response safely.
 *
 * @param {string} endpoint - Target API endpoint (e.g. "/api/alerts/analyze")
 * @param {Object} [options] - Fetch options (method, headers, body, etc.)
 * @returns {Promise<any>} Parsed response data
 * @throws {ApiError} Structured error with status and backend details
 */
export const request = async (endpoint, options = {}) => {
  const url = buildUrl(endpoint);

  const headers = {
    "Accept": "application/json",
    ...options.headers
  };

  if (options.body && !(options.body instanceof FormData) && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
  }

  const fetchConfig = {
    ...options,
    headers,
    body: options.body && typeof options.body === "object" && !(options.body instanceof FormData)
      ? JSON.stringify(options.body)
      : options.body
  };

  let response;
  try {
    response = await fetch(url, fetchConfig);
  } catch (netErr) {
    const errorMsg = netErr.name === "AbortError"
      ? "Request timed out or was aborted."
      : "Unable to connect to AlertIQ backend server. Please verify backend is running.";
    throw new ApiError(errorMsg, { status: 0, isNetworkError: true });
  }

  // Safe JSON extraction
  let responseData = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      const text = await response.text();
      responseData = text ? { message: text } : null;
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const backendMessage =
      responseData?.error ||
      responseData?.message ||
      `HTTP ${response.status}: ${response.statusText || "Request failed"}`;

    throw new ApiError(backendMessage, {
      status: response.status,
      data: responseData,
      isNetworkError: false
    });
  }

  return responseData;
};

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: "POST", body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: "DELETE" })
};

export default apiClient;
