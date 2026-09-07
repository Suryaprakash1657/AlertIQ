/**
 * Chunking Utilities for AlertIQ Knowledge Base
 *
 * Provides configurable sliding-window text chunking with boundary awareness
 * and metadata preservation for downstream embedding generation and RAG retrieval.
 */

export const CHUNK_CONFIG = {
  DEFAULT_CHUNK_SIZE: 800,
  DEFAULT_OVERLAP: 150,
  MIN_CHUNK_SIZE: 50,
  MAX_CHUNK_SIZE: 10000
};

/**
 * Splits a long text string into an array of string chunks using a sliding window
 * with boundary detection (paragraphs, sentences, word spaces).
 *
 * @param {string} text - Raw text to chunk.
 * @param {Object} [options] - Chunking configuration options.
 * @param {number} [options.chunkSize=800] - Target maximum size of each chunk in characters.
 * @param {number} [options.overlap=150] - Number of characters to overlap between consecutive chunks.
 * @returns {string[]} Array of non-empty text chunks.
 */
export const chunkText = (text, options = {}) => {
  if (typeof text !== "string") {
    return [];
  }

  const cleanText = text.trim();
  if (cleanText.length === 0) {
    return [];
  }

  const rawChunkSize = options.chunkSize !== undefined ? Number(options.chunkSize) : CHUNK_CONFIG.DEFAULT_CHUNK_SIZE;
  const rawOverlap = options.overlap !== undefined ? Number(options.overlap) : CHUNK_CONFIG.DEFAULT_OVERLAP;

  const chunkSize = Math.max(
    CHUNK_CONFIG.MIN_CHUNK_SIZE,
    Math.min(CHUNK_CONFIG.MAX_CHUNK_SIZE, Number.isInteger(rawChunkSize) ? rawChunkSize : CHUNK_CONFIG.DEFAULT_CHUNK_SIZE)
  );

  let overlap = Number.isInteger(rawOverlap) && rawOverlap >= 0 ? rawOverlap : CHUNK_CONFIG.DEFAULT_OVERLAP;
  if (overlap >= chunkSize) {
    overlap = Math.floor(chunkSize / 4); // Safe fallback to 25% overlap
  }

  // If text is already within single chunk limit, return it directly
  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }

  const chunks = [];
  let startIndex = 0;
  const textLength = cleanText.length;

  while (startIndex < textLength) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= textLength) {
      const finalChunk = cleanText.slice(startIndex).trim();
      if (finalChunk.length > 0) {
        chunks.push(finalChunk);
      }
      break;
    }

    // Attempt to locate a natural boundary within the latter half of the window
    const lookbackWindow = cleanText.slice(startIndex, endIndex);
    const searchFrom = Math.max(0, chunkSize - overlap);
    const candidateSlice = lookbackWindow.slice(searchFrom);

    let naturalBreakOffset = -1;

    // Boundary priority: Paragraph -> Line Break -> Sentence Boundary -> Punctuation -> Space
    const boundaryPatterns = [
      /\n\n+/g,
      /\n+/g,
      /(?<=[.?!])\s+/g,
      /(?<=[;:])\s+/g,
      /\s+/g
    ];

    for (const pattern of boundaryPatterns) {
      let match;
      let lastMatchIndex = -1;
      let matchLength = 0;

      while ((match = pattern.exec(candidateSlice)) !== null) {
        lastMatchIndex = match.index;
        matchLength = match[0].length;
      }

      if (lastMatchIndex !== -1) {
        naturalBreakOffset = searchFrom + lastMatchIndex + matchLength;
        break;
      }
    }

    let actualEndIndex;
    if (naturalBreakOffset > 0 && naturalBreakOffset < chunkSize) {
      actualEndIndex = startIndex + naturalBreakOffset;
    } else {
      actualEndIndex = endIndex;
    }

    const chunkContent = cleanText.slice(startIndex, actualEndIndex).trim();
    if (chunkContent.length > 0) {
      chunks.push(chunkContent);
    }

    // Advance start index ensuring strictly positive forward progress
    const nextStartIndex = actualEndIndex - overlap;
    if (nextStartIndex <= startIndex) {
      startIndex = actualEndIndex;
    } else {
      startIndex = nextStartIndex;
    }
  }

  return chunks.filter((c) => c && c.trim().length > 0);
};

/**
 * Takes a normalized document entity and generates structured, metadata-enriched chunk objects.
 *
 * @param {Object} document - Normalized document object.
 * @param {string} document.id - Document identifier.
 * @param {string} document.title - Document title.
 * @param {string} document.content - Raw document content.
 * @param {string} [document.source] - Document source.
 * @param {Object} [document.metadata] - Optional document metadata.
 * @param {Object} [options] - Optional chunking parameters (chunkSize, overlap).
 * @returns {Array<{
 *   id: string,
 *   documentId: string,
 *   chunkIndex: number,
 *   totalChunks: number,
 *   content: string,
 *   metadata: Object,
 *   charCount: number,
 *   tokenEstimate: number
 * }>} Array of enriched chunk objects.
 */
export const createDocumentChunks = (document, options = {}) => {
  if (!document || !document.content) {
    return [];
  }

  const rawChunks = chunkText(document.content, options);
  const totalChunks = rawChunks.length;

  return rawChunks.map((content, index) => {
    return {
      id: `${document.id}_chk_${index}`,
      documentId: document.id,
      chunkIndex: index,
      totalChunks,
      content,
      metadata: {
        documentTitle: document.title,
        source: document.source || "Internal Knowledge Base",
        ...(document.metadata || {})
      },
      charCount: content.length,
      tokenEstimate: Math.ceil(content.length / 4),
      embedding: {
        status: "pending",
        model: null,
        dimensions: null,
        vector: null,
        generatedAt: null
      }
    };
  });
};

