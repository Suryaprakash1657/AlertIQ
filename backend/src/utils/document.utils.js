import crypto from "crypto";

/**
 * Maximum limits for document fields
 */
export const DOCUMENT_LIMITS = {
  TITLE_MAX_LENGTH: 255,
  SOURCE_MAX_LENGTH: 255,
  CONTENT_MIN_LENGTH: 1,
  CONTENT_MAX_LENGTH: 1000000, // 1 MB text limit for safety
  METADATA_MAX_KEYS: 50
};

/**
 * Validates a document ingestion payload.
 *
 * @param {any} payload - Incoming request body
 * @returns {{
 *   title: string,
 *   content: string,
 *   source: string,
 *   metadata: Object,
 *   chunkSize?: number,
 *   overlap?: number
 * }} Validated and normalized document parameters
 * @throws {Error} with statusCode 400 if validation fails
 */
export const validateDocumentPayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Invalid request payload: Request body must be a valid JSON object.");
    error.statusCode = 400;
    throw error;
  }

  // 1. Validate required title
  if (payload.title === undefined || payload.title === null) {
    const error = new Error("Invalid document: 'title' is required.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof payload.title !== "string" || payload.title.trim() === "") {
    const error = new Error("Invalid document: 'title' must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }

  const trimmedTitle = payload.title.trim();
  if (trimmedTitle.length > DOCUMENT_LIMITS.TITLE_MAX_LENGTH) {
    const error = new Error(
      `Invalid document: 'title' exceeds maximum length of ${DOCUMENT_LIMITS.TITLE_MAX_LENGTH} characters.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate required content
  if (payload.content === undefined || payload.content === null) {
    const error = new Error("Invalid document: 'content' is required.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof payload.content !== "string" || payload.content.trim() === "") {
    const error = new Error("Invalid document: 'content' must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }

  const trimmedContent = payload.content.trim();
  if (trimmedContent.length > DOCUMENT_LIMITS.CONTENT_MAX_LENGTH) {
    const error = new Error(
      `Invalid document: 'content' exceeds maximum allowed size of ${DOCUMENT_LIMITS.CONTENT_MAX_LENGTH} characters.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate optional source
  let validatedSource = "Internal Knowledge Base";
  if (payload.source !== undefined && payload.source !== null) {
    if (typeof payload.source !== "string") {
      const error = new Error("Invalid document: 'source' must be a string if provided.");
      error.statusCode = 400;
      throw error;
    }
    const trimmedSource = payload.source.trim();
    if (trimmedSource.length > DOCUMENT_LIMITS.SOURCE_MAX_LENGTH) {
      const error = new Error(
        `Invalid document: 'source' exceeds maximum length of ${DOCUMENT_LIMITS.SOURCE_MAX_LENGTH} characters.`
      );
      error.statusCode = 400;
      throw error;
    }
    if (trimmedSource.length > 0) {
      validatedSource = trimmedSource;
    }
  }

  // 4. Validate optional metadata
  let validatedMetadata = {};
  if (payload.metadata !== undefined && payload.metadata !== null) {
    if (typeof payload.metadata !== "object" || Array.isArray(payload.metadata)) {
      const error = new Error("Invalid document: 'metadata' must be a key-value object if provided.");
      error.statusCode = 400;
      throw error;
    }

    const keys = Object.keys(payload.metadata);
    if (keys.length > DOCUMENT_LIMITS.METADATA_MAX_KEYS) {
      const error = new Error(
        `Invalid document: 'metadata' exceeds maximum allowed key count of ${DOCUMENT_LIMITS.METADATA_MAX_KEYS}.`
      );
      error.statusCode = 400;
      throw error;
    }

    validatedMetadata = { ...payload.metadata };
  }

  // 5. Validate optional custom chunking options
  let chunkSize;
  let overlap;

  if (payload.chunkSize !== undefined && payload.chunkSize !== null) {
    const parsedChunkSize = Number(payload.chunkSize);
    if (!Number.isInteger(parsedChunkSize) || parsedChunkSize <= 0) {
      const error = new Error("Invalid document: 'chunkSize' must be a positive integer.");
      error.statusCode = 400;
      throw error;
    }
    chunkSize = parsedChunkSize;
  }

  if (payload.overlap !== undefined && payload.overlap !== null) {
    const parsedOverlap = Number(payload.overlap);
    if (!Number.isInteger(parsedOverlap) || parsedOverlap < 0) {
      const error = new Error("Invalid document: 'overlap' must be a non-negative integer.");
      error.statusCode = 400;
      throw error;
    }
    overlap = parsedOverlap;
  }

  if (chunkSize !== undefined && overlap !== undefined && overlap >= chunkSize) {
    const error = new Error("Invalid document: 'overlap' must be strictly less than 'chunkSize'.");
    error.statusCode = 400;
    throw error;
  }

  return {
    title: trimmedTitle,
    content: trimmedContent,
    source: validatedSource,
    metadata: validatedMetadata,
    ...(chunkSize !== undefined && { chunkSize }),
    ...(overlap !== undefined && { overlap })
  };
};

/**
 * Normalizes a validated payload into a complete Document schema object.
 *
 * @param {Object} validatedPayload
 * @returns {Object} Document entity
 */
export const normalizeDocument = (validatedPayload) => {
  const now = new Date().toISOString();
  const id = `doc_${crypto.randomUUID()}`;

  return {
    id,
    title: validatedPayload.title,
    content: validatedPayload.content,
    source: validatedPayload.source,
    metadata: validatedPayload.metadata,
    createdAt: now,
    updatedAt: now
  };
};
