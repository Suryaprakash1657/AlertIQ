#!/usr/bin/env node

/**
 * AlertIQ Threat Knowledge Corpus Seeding CLI
 *
 * Seeds the 8 core defensive cybersecurity playbooks into the AlertIQ knowledge base
 * through the existing validation, chunking, embedding generation, and repository indexing pipeline.
 *
 * Usage:
 *   node scripts/seed-threat-corpus.js           # Idempotent seed (skips already indexed documents)
 *   node scripts/seed-threat-corpus.js --force   # Force rebuild / re-embed all documents
 *   node scripts/seed-threat-corpus.js --status  # Check current corpus indexing status
 */

import { ingestThreatCorpus, getThreatCorpusStatus } from "../src/services/threat-corpus.service.js";
import { config } from "../src/config/env.js";
import { closePool } from "../src/config/db.js";

const args = process.argv.slice(2);
const force = args.includes("--force");
const statusOnly = args.includes("--status");

const run = async () => {
  console.log("===============================================================");
  console.log("          AlertIQ Threat Knowledge Corpus CLI                  ");
  console.log("===============================================================");

  try {
    if (statusOnly) {
      console.log("\n[Status] Querying Knowledge Base for threat corpus documents...");
      const status = await getThreatCorpusStatus();
      console.log(`\nTotal Corpus Documents: ${status.totalCorpusDocuments}`);
      console.log(`Indexed in Storage:     ${status.indexedCount}`);
      console.log(`Missing from Storage:   ${status.missingCount}\n`);

      console.table(
        status.documents.map((d) => ({
          ID: d.id,
          Threat: d.threatType,
          Authority: d.authority,
          Indexed: d.isIndexed ? "YES" : "NO",
          Chunks: d.chunkCount
        }))
      );
      return;
    }

    console.log(`\nConfiguration:`);
    console.log(`  Embedding Model: ${config.geminiEmbeddingModel}`);
    console.log(`  Dimensions:      ${config.embeddingDimensions}`);
    console.log(`  Force Mode:      ${force ? "ENABLED (rebuilding existing docs)" : "DISABLED (idempotent skip)"}`);
    console.log(`  API Key Set:     ${Boolean(config.geminiApiKey && config.geminiApiKey !== "your_gemini_api_key_here") ? "YES" : "NO"}`);
    console.log("---------------------------------------------------------------");

    const startTime = Date.now();

    const result = await ingestThreatCorpus({
      force,
      verbose: true
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n===============================================================");
    console.log("                    Ingestion Summary                          ");
    console.log("===============================================================");
    console.log(`Total Documents Evaluated: ${result.total}`);
    console.log(`Successfully Ingested:    ${result.ingested}`);
    console.log(`Skipped (Already Exists):  ${result.skipped}`);
    console.log(`Elapsed Execution Time:    ${elapsed}s`);
    console.log("===============================================================\n");

    console.table(
      result.results.map((r) => ({
        ID: r.id,
        Title: r.title.length > 40 ? `${r.title.slice(0, 37)}...` : r.title,
        Status: r.status.toUpperCase(),
        Chunks: r.chunkCount,
        Reason: r.reason || "N/A"
      }))
    );
  } catch (err) {
    console.error(`\n[FATAL] Ingestion failed: ${err.message}`);
    if (err.statusCode) {
      console.error(`Status Code: ${err.statusCode}`);
    }
    process.exitCode = 1;
  } finally {
    await closePool();
  }
};

run();
