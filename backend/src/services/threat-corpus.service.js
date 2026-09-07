/**
 * Threat Knowledge Corpus Ingestion Service for AlertIQ
 *
 * Implements deterministic, idempotent ingestion of authoritative threat documents
 * through the existing Knowledge Base validation, chunking, embedding, and repository pipeline.
 */

import { THREAT_CORPUS_DOCUMENTS, getAllThreatDocuments } from "../knowledge/threat-corpus.js";
import { createKnowledgeDocument } from "./knowledge.service.js";
import { knowledgeRepository } from "../repositories/knowledge.repository.js";
import { setEmbeddingProviderOverride, resetEmbeddingProviderOverride } from "./embedding.service.js";

/**
 * Ingests the curated cybersecurity threat knowledge corpus into the AlertIQ Knowledge Base.
 * Reuses the complete existing validation, chunking, embedding, and repository pipeline.
 *
 * Idempotency behavior:
 * - When force = false: If a document with the stable ID already exists, it is skipped (no duplicate chunks or API calls).
 * - When force = true: If a document exists, it is deleted and re-ingested with fresh chunks and embeddings.
 *
 * @param {Object} [options={}] - Ingestion configuration options.
 * @param {boolean} [options.force=false] - If true, replaces existing documents and regenerates chunks/embeddings.
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

      if (existing && !force) {
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

      if (existing && force) {
        await knowledgeRepository.deleteById(doc.id);
        if (verbose) {
          console.log(`[Threat Corpus] Rebuilding '${doc.id}' (force enabled).`);
        }
      }

      // Ingest document using existing knowledge service pipeline
      const created = await createKnowledgeDocument(doc);
      ingestedCount++;

      results.push({
        id: created.document.id,
        title: created.document.title,
        status: "ingested",
        chunkCount: created.chunkCount
      });

      if (verbose) {
        console.log(`[Threat Corpus] Successfully indexed '${created.document.id}' (${created.chunkCount} chunks).`);
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
    const isIndexed = Boolean(existing);

    if (isIndexed) {
      indexedCount++;
    }

    documentStatuses.push({
      id: doc.id,
      title: doc.title,
      authority: doc.metadata?.authority || doc.source || "N/A",
      threatType: doc.metadata?.threatType || "unknown",
      isIndexed,
      chunkCount: existing?.chunkCount || 0,
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
