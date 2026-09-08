import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import app from "../src/app.js";
import { postgresKnowledgeRepository } from "../src/repositories/knowledge.repository.js";
import { retrieveKnowledge } from "../src/services/retrieval.service.js";
import { closePool } from "../src/config/db.js";
import { THREAT_CORPUS_DOCUMENTS } from "../src/knowledge/threat-corpus.js";
import { createDocumentChunks } from "../src/utils/chunking.utils.js";
import { setEmbeddingProviderOverride, resetEmbeddingProviderOverride } from "../src/services/embedding.service.js";
import { setLlmExecutionOverride, resetLlmExecutionOverride } from "../src/services/alert-analysis.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Deterministic 768-dim mock vector generator
function getMockVector(seed = 1) {
  const dim = 768;
  const values = [];
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(seed * (i + 1));
    values.push(val);
  }
  const norm = Math.sqrt(values.reduce((acc, v) => acc + v * v, 0));
  return values.map((v) => Number((v / norm).toFixed(6)));
}

// Maps threat topics to distinct deterministic vector seeds
const SEED_MAP = {
  ransomware: 101,
  powershell: 202,
  brute_force: 303,
  sql_injection: 404,
  dns_tunneling: 505,
  phishing: 606,
  credential_theft: 707,
  data_exfiltration: 808
};

function getSeedForText(text = "") {
  const lower = text.toLowerCase();
  for (const [key, seed] of Object.entries(SEED_MAP)) {
    if (lower.includes(key) || lower.includes(key.replace("_", " "))) {
      return seed;
    }
  }
  return 999;
}

const args = process.argv.slice(2);
const phase = args.find((a) => a.startsWith("--phase="))?.split("=")[1];

// =========================================================================
// PHASE 1: Run in Process 1 (Seed & Persist to PostgreSQL, then Exit)
// =========================================================================
if (phase === "1") {
  (async () => {
    console.log("[Process 1] Initializing and seeding PostgreSQL Knowledge Base...");
    const repo = postgresKnowledgeRepository;

    const testPrefix = "doc-persist-test-";
    let totalChunksCount = 0;

    for (const doc of THREAT_CORPUS_DOCUMENTS) {
      const testDocId = `${testPrefix}${doc.id}`;
      const docEntity = {
        ...doc,
        id: testDocId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const chunks = createDocumentChunks(docEntity);
      const seed = getSeedForText(doc.title + " " + (doc.metadata?.threatType || ""));

      const vectorReadyChunks = chunks.map((chunk, idx) => ({
        ...chunk,
        id: `${testDocId}_chk_${idx}`,
        documentId: testDocId,
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          generatedAt: new Date().toISOString(),
          vector: getMockVector(seed)
        }
      }));

      await repo.replaceDocument(docEntity, vectorReadyChunks);
      totalChunksCount += vectorReadyChunks.length;
    }

    console.log(`[Process 1] Successfully seeded ${THREAT_CORPUS_DOCUMENTS.length} documents (${totalChunksCount} chunks) into PostgreSQL.`);
    await closePool();
    process.exit(0);
  })();
}

// =========================================================================
// PHASE 2: Run in Process 2 (Fresh Process Verification & RAG HTTP Test)
// =========================================================================
else if (phase === "2") {
  (async () => {
    console.log("[Process 2] Starting verification in completely fresh Node.js process (PID: " + process.pid + ")...");
    const repo = postgresKnowledgeRepository;
    const testPrefix = "doc-persist-test-";

    let passed = 0;
    let failed = 0;

    const assert = (condition, name, extra = "") => {
      if (condition) {
        console.log(`  ✓ PASS: ${name}`);
        passed++;
      } else {
        console.error(`  ✖ FAIL: ${name} ${extra ? `(${extra})` : ""}`);
        failed++;
      }
    };

    let server;
    try {
      // 1. Verify Documents Persisted across process restart
      const docs = await repo.findAll();
      const testDocs = docs.filter((d) => d.id.startsWith(testPrefix));
      assert(testDocs.length === 8, `Process 2 found all 8 persisted threat documents in PostgreSQL (got ${testDocs.length})`);

      // 2. Verify Ready Chunks Persisted
      const allChunks = await repo.getAllIndexedChunks();
      const testChunks = allChunks.filter((c) => c.documentId.startsWith(testPrefix));
      assert(testChunks.length >= 45, `Process 2 found ${testChunks.length} persisted indexed chunks with ready embeddings`);
      assert(testChunks.every((c) => c.embedding.dimensions === 768), "All persisted chunks have 768-dimensional embeddings");

      // Set deterministic embedding provider for query embedding generation
      setEmbeddingProviderOverride(async (text) => {
        const seed = getSeedForText(text);
        return {
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: getMockVector(seed),
          generatedAt: new Date().toISOString()
        };
      });

      // 3. Perform Direct Semantic Retrieval against PostgreSQL
      const querySeed = SEED_MAP.ransomware;
      const queryVector = getMockVector(querySeed);

      const searchResults = await repo.searchSimilarChunks(queryVector, {
        topK: 5,
        similarityThreshold: 0.6
      });

      assert(searchResults.length > 0, "Semantic retrieval against persisted PostgreSQL chunks returns matches");
      const topMatch = searchResults[0];
      assert(
        topMatch.documentId.includes("ransomware"),
        `Top-1 ranked document is Ransomware playbook (got '${topMatch.documentId}')`
      );
      assert(topMatch.similarity > 0.99, `Top match similarity is high (got ${topMatch.similarity})`);

      // 4. Test Full Production HTTP Route (POST /api/alerts/analyze) against Fresh Server
      const mockAnalysisObj = {
        summary: "Confirmed ransomware incident targeting critical file shares on FILE-SRV-01.",
        riskAssessment: {
          level: "CRITICAL",
          reasoning: "Shadow copy deletion and mass encryption indicate active cryptographic impact stage."
        },
        keyIndicators: [
          "vssadmin delete shadows /all /quiet",
          "Mass file renaming detected with .locked extensions"
        ],
        investigationSteps: [
          "Examine parent process tree of vssadmin execution",
          "Collect memory dump and volatile artifacts from FILE-SRV-01"
        ],
        recommendedActions: [
          "Isolate FILE-SRV-01 from corporate network immediately",
          "Disable compromised credentials in Active Directory"
        ],
        assumptions: [
          "Assuming file server does not host active domain controller roles"
        ],
        limitations: [
          "Full memory dump telemetry not included in initial alert packet"
        ]
      };

      setLlmExecutionOverride(async () => ({
        text: JSON.stringify(mockAnalysisObj),
        usage: { inputTokens: 150, outputTokens: 250, totalTokens: 400 },
        estimatedCost: { inputCost: 0.00003, outputCost: 0.00015, totalCost: 0.00018, currency: "USD" }
      }));

      // Start Express server on ephemeral port
      const PORT = 7892;
      server = http.createServer(app);
      await new Promise((resolve) => server.listen(PORT, resolve));

      // Post alert to /api/alerts/analyze
      const alertPayload = {
        alert: {
          id: "ALERT-2026-PERSIST-01",
          title: "Suspected Ransomware File Encryption Activity Detected",
          description: "Massive file renaming and shadow copy deletion detected on file server.",
          severity: "critical",
          source: "CrowdStrike-EDR",
          timestamp: new Date().toISOString(),
          hostname: "FILE-SRV-01",
          rawLog: "vssadmin delete shadows /all /quiet; ransomware binary execution"
        },
        enableRag: true,
        similarityThreshold: 0.5
      };

      const response = await fetch(`http://localhost:${PORT}/api/alerts/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertPayload)
      });

      const data = await response.json();
      if (response.status !== 200) {
        console.error("HTTP Error Response:", response.status, JSON.stringify(data));
      }

      assert(response.status === 200, "POST /api/alerts/analyze returned HTTP 200 OK");
      assert(data.success === true, "Alert analysis response reports success: true");
      assert(data.knowledgeContext !== undefined, "Response includes knowledgeContext metadata");
      assert(
        data.knowledgeContext?.status === "success" || data.knowledgeContext?.status === "no_match",
        `knowledgeContext.status is valid (got '${data.knowledgeContext?.status}')`
      );
      assert(data.knowledgeContext?.status !== "empty_kb", "knowledgeContext.status is strictly NOT 'empty_kb'");
      assert(
        Array.isArray(data.knowledgeContext?.sourcesUsed) && data.knowledgeContext.sourcesUsed.length > 0,
        `sourcesUsed contains persisted document provenance (got ${data.knowledgeContext?.sourcesUsed?.length} sources)`
      );

      // Verify no raw vectors are leaked in response
      const rawJson = JSON.stringify(data);
      const hasVectorKey = /"vector":\s*\[/.test(rawJson);
      assert(!hasVectorKey, "Zero vector embeddings leaked in HTTP API response");

    } catch (err) {
      console.error("✖ Error during Process 2 execution:", err);
      failed++;
    } finally {
      // Clean up test documents created in Phase 1
      try {
        for (const doc of THREAT_CORPUS_DOCUMENTS) {
          await repo.deleteById(`${testPrefix}${doc.id}`);
        }
      } catch (_) {}

      resetEmbeddingProviderOverride();
      resetLlmExecutionOverride();
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      await closePool();
    }

    console.log("\n===============================================================");
    console.log(`Process 2 Verification: ${passed} passed, ${failed} failed`);
    console.log("===============================================================");

    if (failed > 0) {
      process.exit(1);
    }
  })();
}

// =========================================================================
// ORCHESTRATOR: Spawns Process 1, Waits for Exit, Spawns Process 2
// =========================================================================
else {
  (async () => {
    console.log("===============================================================");
    console.log(" AlertIQ Module 3.25 — Multi-Process Persistence Lifecycle Test");
    console.log("===============================================================\n");

    console.log("[Orchestrator] Step 1: Launching Process 1 (Seeding to PostgreSQL)...");
    const p1 = spawnSync(process.execPath, [__filename, "--phase=1"], {
      stdio: "inherit",
      env: process.env
    });

    if (p1.status !== 0) {
      console.error("✖ Process 1 failed with exit code:", p1.status);
      process.exit(1);
    }
    console.log("[Orchestrator] Process 1 successfully completed and terminated.\n");

    console.log("[Orchestrator] Step 2: Launching Process 2 (Independent Fresh Process Verification)...");
    const p2 = spawnSync(process.execPath, [__filename, "--phase=2"], {
      stdio: "inherit",
      env: process.env
    });

    if (p2.status !== 0) {
      console.error("✖ Process 2 failed with exit code:", p2.status);
      process.exit(1);
    }

    console.log("\n✔ MULTI-PROCESS PERSISTENCE LIFECYCLE TEST PASSED COMPLETELY!");
    console.log("===============================================================");
  })();
}
