import mammoth from "mammoth";
import { DOCUMENT_LIMITS } from "./document.utils.js";

/**
 * Validates that a buffer has valid ZIP archive magic bytes (PK..)
 * Standard OpenXML DOCX files are ZIP packages.
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
export const isValidZipBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return false;
  }
  // 0x50 0x4B (PK)
  return buffer[0] === 0x50 && buffer[1] === 0x4b;
};

/**
 * Normalizes extracted text by standardizing line endings, collapsing
 * consecutive empty lines, and trimming outer whitespace.
 *
 * @param {string} text
 * @returns {string}
 */
export const normalizeExtractedText = (text) => {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Extracts raw textual content from a DOCX buffer using Mammoth,
 * validates against size limits, and returns normalized plain text.
 *
 * @param {Buffer} buffer - In-memory file buffer from multer.
 * @param {Object} [options={}] - Extraction options.
 * @returns {Promise<{ text: string, charCount: number, messages: Array<any> }>}
 * @throws {Error} with statusCode 400 for corrupt, password-protected, empty, or oversized documents.
 */
export const extractTextFromDocx = async (buffer, options = {}) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error("Invalid document buffer: File buffer is empty or missing.");
    error.statusCode = 400;
    throw error;
  }

  // 1. Validate magic bytes
  if (!isValidZipBuffer(buffer)) {
    const error = new Error("Invalid file content: The uploaded file does not have a valid DOCX/OpenXML archive signature.");
    error.statusCode = 400;
    throw error;
  }

  // 2. Perform Mammoth raw text extraction
  let extractionResult;
  try {
    extractionResult = await mammoth.extractRawText({ buffer });
  } catch (err) {
    const error = new Error(`Failed to extract text from DOCX document: ${err.message || "File may be corrupt, password-protected, or unreadable."}`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Normalize extracted text
  const cleanText = normalizeExtractedText(extractionResult?.value || "");

  // 4. Validate non-empty content
  if (!cleanText || cleanText.length === 0) {
    const error = new Error("The uploaded DOCX document contains no readable text content (it may contain only images, shapes, or unsupported macros).");
    error.statusCode = 400;
    throw error;
  }

  // 5. Enforce safety limit
  if (cleanText.length > DOCUMENT_LIMITS.CONTENT_MAX_LENGTH) {
    const error = new Error(
      `Extracted text exceeds the maximum allowed content size of ${DOCUMENT_LIMITS.CONTENT_MAX_LENGTH} characters (extracted ${cleanText.length} characters).`
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    text: cleanText,
    charCount: cleanText.length,
    messages: extractionResult?.messages || []
  };
};

export default {
  extractTextFromDocx,
  isValidZipBuffer,
  normalizeExtractedText
};
