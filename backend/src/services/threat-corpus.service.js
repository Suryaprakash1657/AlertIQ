/**
 * Threat Knowledge Corpus Ingestion Service for AlertIQ
 *
 * Implements deterministic, idempotent ingestion of authoritative threat documents
 * through the existing Knowledge Base validation, chunking, embedding, and repository pipeline.
 */

import { THREAT_CORPUS_DOCUMENTS, getAllThreatDocuments } from "../knowledge/threat-corpus.js";
import { validateDocumentPayload, normalizeDocument } from "../utils/document.utils.js";
import { createDocumentChunks } from "../utils/chunking.utils.js";
import { generateEmbeddingsForChunks, setEmbeddingProviderOverride, resetEmbeddingProviderOverride } from "./embedding.service.js";
import { knowledgeRepository } from "../repositories/knowledge.repository.js";

/**
 * Ingests the curated cybersecurity threat knowledge corpus into the AlertIQ Knowledge Base.
 * Reuses the complete existing validation, chunking, embedding, and repository pipeline.
 *
 * Idempotency behavior:
 * - When force = false: If a document with the stable ID already exists with chunks, it is skipped (no duplicate chunks or API calls).
 * - When force = true: Existing document is replaced atomically in PostgreSQL only after all embeddings are generated and validated.
 *
 * @param {Object} [options={}] - Ingestion configuration options.
 * @param {boolean} [options.force=false] - If true, replaces existing documents and regenerates chunks/embeddings atomically.
 * @param {Array<Object>} [options.documents] - Optional custom document list (defaults to all 8 threat documents).
 * @param {Function} [options.providerOverride] - Optional custom embedding provider override (for deterministic tests).
 * @param {boolean} [options.verbose=false] - If true, outputs console progress logs during CLI execution.
 * @returns {Promise<{
 *   total: number,
 *   ingested: number,
 *   skipped: number,
 *   results: Array<{
 *     id: string,
 *     title: string,
 *     status: "ingested"|"skipped",
 *     reason?: string,
 *     chunkCount: number
 *   }>
 * }>}
 */
export const ingestThreatCorpus = async (options = {}) => {
  const force = Boolean(options.force);
  const verbose = Boolean(options.verbose);
  const corpusDocs = Array.isArray(options.documents) && options.documents.length > 0
    ? options.documents
    : getAllThreatDocuments();

  if (typeof options.providerOverride === "function") {
    setEmbeddingProviderOverride(options.providerOverride);
  }

  const results = [];
  let ingestedCount = 0;
  let skippedCount = 0;

  try {
    for (const doc of corpusDocs) {
      const existing = await knowledgeRepository.findById(doc.id);

      // Idempotent skip when already indexed and not in force mode
      if (existing && !force && existing.chunkCount > 0) {
        skippedCount++;
        results.push({
          id: doc.id,
          title: doc.title,
          status: "skipped",
          reason: "already_indexed",
          chunkCount: existing.chunkCount || 0
        });

        if (verbose) {
          console.log(`[Threat Corpus] Skipped '${doc.id}' (already indexed). Use --force to rebuild.`);
        }
        continue;
      }

      if (verbose && existing && force) {
        console.log(`[Threat Corpus] Rebuilding '${doc.id}' (force enabled, atomic replacement).`);
      }

      // Step 1: Validate & normalize document entity
      const validatedPayload = validateDocumentPayload(doc);
      const documentEntity = normalizeDocument(validatedPayload);

      // Step 2: Chunk document
      const initialChunks = createDocumentChunks(documentEntity, {
        chunkSize: validatedPayload.chunkSize,
        overlap: validatedPayload.overlap
      });

      // Step 3: Generate and validate embeddings for all chunks before modifying database
      const vectorReadyChunks = await generateEmbeddingsForChunks(initialChunks, {
        title: documentEntity.title
      });

      // Step 4: Atomic storage operation (replace if existed, or create if new)
      let saved;
      if (typeof knowledgeRepository.replaceDocument === "function") {
        saved = await knowledgeRepository.replaceDocument(documentEntity, vectorReadyChunks);
      } else {
        if (existing) {
          await knowledgeRepository.deleteById(doc.id);
        }
        saved = await knowledgeRepository.create(documentEntity, vectorReadyChunks);
      }

      ingestedCount++;

      results.push({
        id: saved.document.id,
        title: saved.document.title,
        status: "ingested",
        chunkCount: saved.chunks.length
      });

      if (verbose) {
        console.log(`[Threat Corpus] Successfully indexed '${saved.document.id}' (${saved.chunks.length} chunks).`);
      }
    }
  } finally {
    if (typeof options.providerOverride === "function") {
      resetEmbeddingProviderOverride();
    }
  }

  return {
    total: corpusDocs.length,
    ingested: ingestedCount,
    skipped: skippedCount,
    results
  };
};

/**
 * Returns the indexing status of all threat corpus documents in the current repository.
 *
 * @returns {Promise<{
 *   totalCorpusDocuments: number,
 *   indexedCount: number,
 *   missingCount: number,
 *   documents: Array<{
 *     id: string,
 *     title: string,
 *     authority: string,
 *     threatType: string,
 *     isIndexed: boolean,
 *     chunkCount: number,
 *     createdAt?: string
 *   }>
 * }>}
 */
export const getThreatCorpusStatus = async () => {
  const corpusDocs = getAllThreatDocuments();
  const documentStatuses = [];
  let indexedCount = 0;

  for (const doc of corpusDocs) {
    const existing = await knowledgeRepository.findById(doc.id);
    const isIndexed = Boolean(existing && (existing.chunkCount > 0 || (existing.chunks && existing.chunks.length > 0)));

    if (isIndexed) {
      indexedCount++;
    }

    documentStatuses.push({
      id: doc.id,
      title: doc.title,
      authority: doc.metadata?.authority || doc.source || "N/A",
      threatType: doc.metadata?.threatType || "unknown",
      isIndexed,
      chunkCount: existing?.chunkCount || existing?.chunks?.length || 0,
      createdAt: existing?.createdAt
    });
  }

  return {
    totalCorpusDocuments: corpusDocs.length,
    indexedCount,
    missingCount: corpusDocs.length - indexedCount,
    documents: documentStatuses
  };
};
