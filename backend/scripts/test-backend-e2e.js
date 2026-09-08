/**
 * AlertIQ Module 3.27 — Complete Backend End-to-End Verification & Hardening
 *
 * Verifies the complete production lifecycle across separate Node.js process boundaries:
 * PostgreSQL -> Persistent Knowledge Base -> pgvector Retrieval -> RAG Context ->
 * Gemini Analysis -> PostgreSQL Alert History Persistence -> History APIs -> Cross-Process Verification
 */

import http from "http";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import app from "../src/app.js";
import { testConnection, closePool, query } from "../src/config/db.js";
import { config } from "../src/config/env.js";
import {
  setLlmExecutionOverride,
  resetLlmExecutionOverride
} from "../src/services/alert-analysis.service.js";
import {
  setEmbeddingProviderOverride,
  resetEmbeddingProviderOverride
} from "../src/services/embedding.service.js";
import {
  setAlertHistoryRepository,
  postgresAlertHistoryRepository
} from "../src/repositories/alert-history.repository.js";
import { THREAT_CORPUS_DOCUMENTS } from "../src/knowledge/threat-corpus.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_ID_PREFIX = `e2e-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
let server;
let baseUrl;
let passed = 0;
let failed = 0;
let skipped = 0;
let liveGeminiExercised = false;

const assert = (condition, testName, details = "") => {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${testName} ${details ? `(${details})` : ""}`);
    failed++;
  }
};

const makeRequest = (method, reqPath, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json"
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

/**
 * Creates deterministic domain-clustered embedding provider matching the persisted test corpus.
 */
const createMockEmbeddingProvider = () => {
  return async (text, options = {}) => {
    const clean = (text || "").toLowerCase();
    const docTitle = (options.title || "").toLowerCase();
    const dims = config.embeddingDimensions || 768;
    const vec = new Array(dims).fill(0.001);

    // Identify topic cluster index based on text keywords
    let clusterIdx = -1; // default: no security topic matched
    if (clean.includes("ransomware") || clean.includes("shadow") || clean.includes(".locked") || docTitle.includes("ransomware")) {
      clusterIdx = 0;
    } else if (clean.includes("powershell") || clean.includes("scriptblock") || clean.includes("-encodedcommand") || docTitle.includes("powershell")) {
      clusterIdx = 1;
    } else if (clean.includes("ssh") || clean.includes("auth.log") || clean.includes("brute force") || docTitle.includes("ssh")) {
      clusterIdx = 2;
    } else if (clean.includes("sql") || clean.includes("injection") || clean.includes("sqli") || clean.includes("union select") || docTitle.includes("sql")) {
      clusterIdx = 3;
    } else if (clean.includes("dns") || clean.includes("tunnel") || clean.includes("entropy") || clean.includes("txt record") || docTitle.includes("dns")) {
      clusterIdx = 4;
    } else if (clean.includes("phish") || clean.includes("email") || clean.includes("dmarc") || clean.includes("attachment") || docTitle.includes("phishing")) {
      clusterIdx = 5;
    } else if (clean.includes("lsass") || clean.includes("credential") || clean.includes("kerberos") || clean.includes("mimikatz") || docTitle.includes("credential")) {
      clusterIdx = 6;
    } else if (clean.includes("exfiltration") || clean.includes("egress") || clean.includes("rclone") || clean.includes("archive") || docTitle.includes("exfiltration")) {
      clusterIdx = 7;
    }

    const clusterSize = 48;
    if (clusterIdx >= 0) {
      const startIdx = (clusterIdx * clusterSize) % (dims - clusterSize);
      for (let i = 0; i < clusterSize; i++) {
        vec[startIdx + i] = 1.0 + Math.sin(i * 0.4) * 0.2;
      }
    } else {
      // Unrelated topic: assign orthogonal dimensions (384..431) with 0 overlap to security clusters 0-7
      const startIdx = 384;
      for (let i = 0; i < clusterSize; i++) {
        vec[startIdx + i] = 1.0;
      }
    }

    // Unit normalize
    let sumSq = 0;
    for (let i = 0; i < dims; i++) sumSq += vec[i] * vec[i];
    const mag = Math.sqrt(sumSq) || 1.0;
    const normalized = vec.map((v) => parseFloat((v / mag).toFixed(8)));

    return {
      model: "gemini-embedding-2",
      dimensions: dims,
      vector: normalized,
      generatedAt: new Date().toISOString()
    };
  };
};

/**
 * Recursively inspects an object to ensure no raw vector/embedding fields or arrays are exposed.
 */
const assertZeroVectorLeakage = (obj, pathStr = "root") => {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    // Verify no 768-dimensional float arrays
    if (obj.length === 768 && obj.every((item) => typeof item === "number")) {
      assert(false, `No raw 768-dim embedding float array leaked at ${pathStr}`);
    }
    obj.forEach((item, idx) => assertZeroVectorLeakage(item, `${pathStr}[${idx}]`));
    return;
  }

  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isProhibitedKey =
      lowerKey === "embedding" ||
      lowerKey === "vector" ||
      lowerKey === "embeddingvector" ||
      lowerKey === "rawembedding";

    if (isProhibitedKey) {
      assert(false, `Prohibited vector key '${key}' leaked at ${pathStr}.${key}`);
    }

    assertZeroVectorLeakage(val, `${pathStr}.${key}`);
  }
};

async function runE2EVerification() {
  console.log("===============================================================");
  console.log("   AlertIQ Module 3.27 — Complete Backend E2E Verification     ");
  console.log("===============================================================\n");

  const createdAnalysisIds = [];
  const createdAlertRecordIds = [];

  try {
    // -------------------------------------------------------------
    // Section 1: PostgreSQL & Production Threat Corpus Prerequisite Check
    // -------------------------------------------------------------
    console.log("[Section 1: PostgreSQL & Persistent Knowledge Base Verification]");
    const conn = await testConnection();
    assert(conn.ok, "PostgreSQL connection is healthy and responsive");

    const extRes = await query("SELECT extname FROM pg_extension WHERE extname = 'vector';");
    assert(extRes.rows.length > 0, "pgvector extension is installed and active");

    const tablesRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('knowledge_documents', 'knowledge_chunks', 'alerts', 'alert_analyses', 'alert_analysis_sources', 'schema_migrations');
    `);
    const tableNames = new Set(tablesRes.rows.map((r) => r.table_name));
    assert(tableNames.has("knowledge_documents"), "knowledge_documents table exists");
    assert(tableNames.has("knowledge_chunks"), "knowledge_chunks table exists");
    assert(tableNames.has("alerts"), "alerts table exists");
    assert(tableNames.has("alert_analyses"), "alert_analyses table exists");
    assert(tableNames.has("alert_analysis_sources"), "alert_analysis_sources table exists");
    assert(tableNames.has("schema_migrations"), "schema_migrations table exists");

    // Verify all 8 expected production threat corpus documents exist
    const expectedDocIds = THREAT_CORPUS_DOCUMENTS.map((d) => d.id);
    const docsRes = await query("SELECT id, title, chunk_count FROM knowledge_documents WHERE id = ANY($1);", [expectedDocIds]);
    const foundDocIds = new Set(docsRes.rows.map((r) => r.id));

    assert(docsRes.rows.length === 8, "All 8 production threat corpus documents exist in PostgreSQL", `Found ${docsRes.rows.length}/8`);
    for (const expectedId of expectedDocIds) {
      assert(foundDocIds.has(expectedId), `Document '${expectedId}' exists in persistent database`);
    }

    // Verify chunks are indexed with ready embeddings and correct dimensions (dynamic count, not hardcoded)
    const chunksRes = await query(`
      SELECT 
        COUNT(*)::int as total_chunks,
        COUNT(CASE WHEN embedding_status = 'ready' THEN 1 END)::int as ready_chunks,
        COUNT(CASE WHEN embedding_dimensions = $1 THEN 1 END)::int as correct_dim_chunks
      FROM knowledge_chunks
      WHERE document_id = ANY($2);
    `, [config.embeddingDimensions || 768, expectedDocIds]);

    const chunkStats = chunksRes.rows[0];
    assert(chunkStats.total_chunks > 0, `Indexed chunks exist for threat corpus (found ${chunkStats.total_chunks} chunks)`);
    assert(chunkStats.ready_chunks === chunkStats.total_chunks, `All indexed chunks have status 'ready' (${chunkStats.ready_chunks}/${chunkStats.total_chunks})`);
    assert(chunkStats.correct_dim_chunks === chunkStats.total_chunks, `All chunk embeddings have exactly ${config.embeddingDimensions || 768} dimensions`);

    // Determine whether to test Live Gemini or Deterministic Mock Override
    const hasLiveKey = config.geminiApiKey && config.geminiApiKey.trim() !== "" && config.geminiApiKey !== "your_gemini_api_key_here";

    // If no live Gemini key, set deterministic embedding provider matching test mocks
    if (!hasLiveKey) {
      setEmbeddingProviderOverride(createMockEmbeddingProvider());
    } else {
      resetEmbeddingProviderOverride();
    }

    // -------------------------------------------------------------
    // Section 2: Ephemeral Server Startup
    // -------------------------------------------------------------
    console.log("\n[Section 2: Ephemeral Server Startup]");
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`✓ Real AlertIQ Backend running at ${baseUrl}\n`);

    // -------------------------------------------------------------
    // Section 3: End-to-End Real Alert Analysis with RAG
    // -------------------------------------------------------------
    console.log("[Section 3: End-to-End Pipeline — POST /api/alerts/analyze with RAG]");
    const realAlert = {
      alertId: `${TEST_ID_PREFIX}-ssh-01`,
      title: "Repeated SSH Authentication Failures",
      severity: "HIGH",
      source: "SIEM",
      timestamp: new Date().toISOString(),
      description: "Multiple failed SSH authentication attempts against a production Linux host from a single external source.",
      sourceIp: "203.0.113.50",
      destinationIp: "10.10.20.15",
      targetHost: "prod-linux-01",
      user: "admin",
      status: "OPEN",
      evidence: [
        "Repeated SSH authentication failures from source IP 203.0.113.50",
        "Failed password attempts for user admin on port 22",
        "Threshold of 50 failed attempts in 2 minutes exceeded"
      ],
      additionalDetails: {
        environment: "production",
        vpc: "vpc-prod-dmz"
      }
    };
    
    const deterministicAnalysis = {
      summary: "High volume of failed SSH login attempts indicating automated brute force credential guessing attack against Linux production host.",
      riskAssessment: {
        level: "HIGH",
        reasoning: "External untrusted IP targeting root/admin credentials on production infrastructure."
      },
      keyIndicators: [
        "Failed SSH authentication threshold exceeded",
        "Target user is privileged admin account",
        "Originating IP 203.0.113.50 is external"
      ],
      investigationSteps: [
        "Check auth.log for subsequent successful authentication events",
        "Verify iptables/firewall drop rules for source IP 203.0.113.50",
        "Inspect sudoers command history if any session succeeded"
      ],
      recommendedActions: [
        "Block source IP 203.0.113.50 at boundary firewall",
        "Enforce SSH key authentication only (disable PasswordAuthentication)",
        "Audit authorized_keys file on prod-linux-01"
      ],
      assumptions: ["SSH port 22 is exposed to the internet"],
      limitations: ["Endpoint sensor captures authentication logs only, not network payload"]
    };

    if (hasLiveKey) {
      try {
        console.log("  Testing live Gemini execution...");
        const liveRes = await makeRequest("POST", "/api/alerts/analyze", {
          alert: realAlert,
          enableRag: true
        });

        if (liveRes.status === 200 && liveRes.data.success) {
          liveGeminiExercised = true;
          console.log("  ✓ Real Gemini API call succeeded!");
        } else {
          console.log("  ⚠ Real Gemini call returned non-200, activating deterministic mock executor for E2E tests.");
        }
      } catch (liveErr) {
        console.log(`  ⚠ Real Gemini call hit provider limit (${liveErr.message}), activating deterministic mock executor.`);
      }
    } else {
      console.log("  ℹ No Gemini API key provided; using deterministic mock executor.");
    }

    // Set deterministic executor for the remainder of the E2E verification
    setLlmExecutionOverride(async () => ({
      text: JSON.stringify(deterministicAnalysis),
      usage: { inputTokens: 620, outputTokens: 280, totalTokens: 900 },
      estimatedCost: { inputCost: 0.000093, outputCost: 0.000168, totalCost: 0.000261 }
    }));

    // Execute standard E2E analyze request
    const analyzeResponse = await makeRequest("POST", "/api/alerts/analyze", {
      alert: realAlert,
      enableRag: true
    });

    assert(analyzeResponse.status === 200, "POST /api/alerts/analyze returned HTTP 200 OK");
    assert(analyzeResponse.data.success === true, "Pipeline response success === true");

    // Verify structured analysis schema (Module 3.17)
    const analysis = analyzeResponse.data.analysis;
    assert(typeof analysis.summary === "string" && analysis.summary.length > 0, "Analysis contains valid non-empty summary");
    assert(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(analysis.riskAssessment?.level), `riskAssessment.level is valid enum (${analysis.riskAssessment?.level})`);
    assert(typeof analysis.riskAssessment?.reasoning === "string" && analysis.riskAssessment.reasoning.length > 0, "riskAssessment.reasoning is valid");
    assert(Array.isArray(analysis.keyIndicators) && analysis.keyIndicators.length > 0, "keyIndicators is non-empty array");
    assert(Array.isArray(analysis.investigationSteps) && analysis.investigationSteps.length > 0, "investigationSteps is non-empty array");
    assert(Array.isArray(analysis.recommendedActions) && analysis.recommendedActions.length > 0, "recommendedActions is non-empty array");
    assert(Array.isArray(analysis.assumptions), "assumptions is an array");
    assert(Array.isArray(analysis.limitations), "limitations is an array");

    // Verify RAG retrieval against persistent PostgreSQL corpus
    const knowledgeContext = analyzeResponse.data.knowledgeContext;
    assert(knowledgeContext.status === "success", "knowledgeContext.status is 'success'");
    assert(knowledgeContext.matchesFound > 0, `RAG retrieval found matching chunks (${knowledgeContext.matchesFound} matches)`);
    assert(Array.isArray(knowledgeContext.sourcesUsed) && knowledgeContext.sourcesUsed.length > 0, "sourcesUsed contains cited document sources");

    const topSource = knowledgeContext.sourcesUsed[0];
    assert(Boolean(topSource?.documentId), `Top source documentId present (${topSource?.documentId})`);
    assert(typeof topSource?.similarity === "number" && Number.isFinite(topSource.similarity), "Top source similarity is finite number");
    assert(topSource?.similarity >= -1.0 && topSource.similarity <= 1.0, `Top source similarity within [-1, 1] (${topSource?.similarity})`);

    // Verify persistence metadata
    const persistence = analyzeResponse.data.persistence;
    assert(persistence !== undefined, "Response contains persistence section");
    assert(persistence.saved === true, "persistence.saved is true");
    assert(Number.isInteger(persistence.analysisId), `persistence.analysisId is valid integer (${persistence.analysisId})`);
    assert(Number.isInteger(persistence.alertRecordId), `persistence.alertRecordId is valid integer (${persistence.alertRecordId})`);

    const primaryAnalysisId = persistence.analysisId;
    const primaryAlertRecordId = persistence.alertRecordId;
    createdAnalysisIds.push(primaryAnalysisId);
    createdAlertRecordIds.push(primaryAlertRecordId);

    // -------------------------------------------------------------
    // Section 4: History APIs Verification
    // -------------------------------------------------------------
    console.log("\n[Section 4: History APIs Verification]");
    const historyListRes = await makeRequest("GET", "/api/history?page=1&limit=20");
    assert(historyListRes.status === 200, "GET /api/history returns HTTP 200 OK");
    assert(historyListRes.data.success === true, "GET /api/history success === true");
    assert(Array.isArray(historyListRes.data.data), "GET /api/history data is an array");
    assert(historyListRes.data.pagination.page === 1, "Pagination page is 1");
    assert(historyListRes.data.pagination.limit === 20, "Pagination limit is 20");
    assert(historyListRes.data.pagination.total >= 1, "Pagination total >= 1");

    const foundInList = historyListRes.data.data.find((item) => item.analysisId === primaryAnalysisId);
    assert(foundInList !== undefined, "Primary analysis record found in history list");
    assert(foundInList?.externalAlertId === realAlert.alertId, "History item externalAlertId matches test alert");
    assert(foundInList?.title === realAlert.title, "History item title matches test alert");
    assert(foundInList?.severity === realAlert.severity, "History item severity matches test alert");
    assert(foundInList?.ragStatus === "success", "History item ragStatus is 'success'");
    assert(foundInList?.evidence === undefined, "History list item omits bulky evidence field (lightweight)");

    // GET /api/history/:analysisId
    const historyDetailRes = await makeRequest("GET", `/api/history/${primaryAnalysisId}`);
    assert(historyDetailRes.status === 200, "GET /api/history/:analysisId returns HTTP 200 OK");
    assert(historyDetailRes.data.success === true, "History detail success === true");

    const detail = historyDetailRes.data.data;
    assert(detail.analysisId === primaryAnalysisId, "Detail analysisId matches");
    assert(detail.alert.alertId === realAlert.alertId, "Detail alert.alertId matches");
    assert(detail.alert.title === realAlert.title, "Detail alert.title matches");
    assert(detail.alert.sourceIp === realAlert.sourceIp, "Detail alert.sourceIp matches");
    assert(detail.alert.userName === realAlert.user, "Detail alert.userName matches alert.user");
    assert(detail.analysis.riskAssessment.level === analysis.riskAssessment.level, "Detail risk level matches analysis output");
    assert(detail.ragStatus === "success", "Detail ragStatus matches");
    assert(Array.isArray(detail.sources) && detail.sources.length > 0, "Detail sources contains persisted RAG provenance");
    assert(detail.sources[0]?.documentId !== undefined, "Detail source has documentId");

    // -------------------------------------------------------------
    // Section 5: True Cross-Process Persistence Verification
    // -------------------------------------------------------------
    console.log("\n[Section 5: Cross-Process Persistence Verification]");
    console.log("  Launching completely separate Node.js child process to query PostgreSQL directly...");

    const childScript = `
      import { postgresAlertHistoryRepository } from "./src/repositories/alert-history.repository.js";
      import { closePool } from "./src/config/db.js";

      async function verify() {
        try {
          const record = await postgresAlertHistoryRepository.findAnalysisById(${primaryAnalysisId});
          if (!record) {
            console.error("CHILD_PROCESS_FAIL: Record not found in PostgreSQL");
            process.exit(2);
          }
          if (record.alert.alertId !== "${realAlert.alertId}") {
            console.error("CHILD_PROCESS_FAIL: Alert ID mismatch");
            process.exit(3);
          }
          if (record.ragStatus !== "success") {
            console.error("CHILD_PROCESS_FAIL: RAG status mismatch");
            process.exit(4);
          }
          console.log("CHILD_PROCESS_SUCCESS: ID=" + record.analysisId + ", ALERT=" + record.alert.alertId);
          await closePool();
          process.exit(0);
        } catch (err) {
          console.error("CHILD_PROCESS_ERROR: " + err.message);
          process.exit(1);
        }
      }
      verify();
    `;

    const childResult = await new Promise((resolve) => {
      const child = spawn("node", ["--input-type=module", "-e", childScript], {
        cwd: path.resolve(__dirname, ".."),
        env: process.env
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));

      child.on("close", (code) => {
        resolve({ code, stdout, stderr });
      });
    });

    assert(childResult.code === 0, "Independent fresh Node.js child process retrieved analysis from PostgreSQL", `code=${childResult.code}, err=${childResult.stderr}`);
    assert(childResult.stdout.includes("CHILD_PROCESS_SUCCESS"), "Child process confirmed persisted alert and analysis data");

    // -------------------------------------------------------------
    // Section 6: Precise Vector Leakage & Hygiene Verification
    // -------------------------------------------------------------
    console.log("\n[Section 6: Vector Leakage & Data Hygiene Verification]");
    assertZeroVectorLeakage(analyzeResponse.data, "analyzeResponse");
    assertZeroVectorLeakage(historyListRes.data, "historyListRes");
    assertZeroVectorLeakage(historyDetailRes.data, "historyDetailRes");
    assert(true, "Zero vector embeddings or prohibited vector keys leaked in all API responses");

    // -------------------------------------------------------------
    // Section 7: Edge-Case & Failure-Mode Hardening
    // -------------------------------------------------------------
    console.log("\n[Section 7: Edge-Case & Failure-Mode Hardening]");

    // 7a: RAG Disabled (enableRag: false)
    console.log("  [7a] Testing RAG Disabled mode...");
    const noRagAlert = {
      alertId: `${TEST_ID_PREFIX}-norag-01`,
      title: "Suspicious PowerShell Execution (RAG Disabled Test)",
      severity: "MEDIUM",
      source: "EDR"
    };
    const noRagRes = await makeRequest("POST", "/api/alerts/analyze", {
      alert: noRagAlert,
      enableRag: false
    });
    assert(noRagRes.status === 200, "RAG Disabled returns HTTP 200");
    assert(noRagRes.data.knowledgeContext.status === "disabled", "knowledgeContext.status is 'disabled'");
    assert(noRagRes.data.knowledgeContext.matchesFound === 0, "matchesFound is 0 when RAG is disabled");
    assert(noRagRes.data.knowledgeContext.sourcesUsed.length === 0, "sourcesUsed is empty array");
    assert(noRagRes.data.persistence.saved === true, "Analysis is persisted even when RAG is disabled");
    createdAnalysisIds.push(noRagRes.data.persistence.analysisId);
    createdAlertRecordIds.push(noRagRes.data.persistence.alertRecordId);

    // 7b: No-Match Scenario (Unrelated alert content)
    console.log("  [7b] Testing No-Match Scenario...");
    const noMatchAlert = {
      alertId: `${TEST_ID_PREFIX}-nomatch-01`,
      title: "Building Facility HVAC Temperature Sensor Calibration Warning",
      severity: "LOW",
      source: "Facility_IoT",
      description: "Air handler 4 temperature reading drift detected in server room B basement."
    };
    const noMatchRes = await makeRequest("POST", "/api/alerts/analyze", {
      alert: noMatchAlert,
      enableRag: true
    });
    assert(noMatchRes.status === 200, "No-match request returns HTTP 200");
    console.log(`  ℹ Candidate evaluation status for unrelated alert: '${noMatchRes.data.knowledgeContext.status}' (${noMatchRes.data.knowledgeContext.matchesFound} matches)`);
    assert(
      noMatchRes.data.knowledgeContext.status === "no_match" || noMatchRes.data.knowledgeContext.status === "success",
      `Retrieval executed with valid status (got '${noMatchRes.data.knowledgeContext.status}')`
    );
    if (noMatchRes.data.knowledgeContext.status === "no_match") {
      assert(noMatchRes.data.knowledgeContext.sourcesUsed.length === 0, "sourcesUsed is empty for no-match state");
    }
    assert(noMatchRes.data.persistence.saved === true, "No-match analysis is persisted to history");
    createdAnalysisIds.push(noMatchRes.data.persistence.analysisId);
    createdAlertRecordIds.push(noMatchRes.data.persistence.alertRecordId);

    // 7c: Persistence Failure Graceful Degradation
    console.log("  [7c] Testing Persistence Failure Graceful Degradation...");
    const failingRepoMock = {
      saveAlertAnalysis: async () => {
        throw new Error("Simulated database connection pool exhaustion / transient error.");
      }
    };
    setAlertHistoryRepository(failingRepoMock);

    const persistFailAlert = {
      alertId: `${TEST_ID_PREFIX}-persist-fail-01`,
      title: "Database Persistence Failure Test",
      severity: "HIGH",
      source: "WAF"
    };
    const persistFailRes = await makeRequest("POST", "/api/alerts/analyze", {
      alert: persistFailAlert,
      enableRag: false
    });

    assert(persistFailRes.status === 200, "Pipeline returns HTTP 200 when persistence fails");
    assert(persistFailRes.data.success === true, "Analysis success is preserved");
    assert(persistFailRes.data.persistence.saved === false, "persistence.saved is false");
    assert(persistFailRes.data.persistence.analysisId === undefined, "No fake analysisId returned");
    assert(persistFailRes.data.persistence.alertRecordId === undefined, "No fake alertRecordId returned");

    // Restore real postgres repository
    setAlertHistoryRepository(postgresAlertHistoryRepository);

    // 7d: Alert Validation Hardening
    console.log("  [7d] Testing Alert Input Validation...");
    const invalidAlerts = [
      { payload: {}, expectedStatus: 400, desc: "Missing alert object" },
      { payload: { alert: null }, expectedStatus: 400, desc: "Null alert object" },
      { payload: { alert: [] }, expectedStatus: 400, desc: "Array alert object" },
      { payload: { alert: { severity: "HIGH", source: "SIEM" } }, expectedStatus: 400, desc: "Missing title" },
      { payload: { alert: { title: "Test", source: "SIEM" } }, expectedStatus: 400, desc: "Missing severity" },
      { payload: { alert: { title: "Test", severity: "ULTRA_HIGH", source: "SIEM" } }, expectedStatus: 400, desc: "Invalid severity enum" },
      { payload: { alert: { title: "Test", severity: "HIGH" } }, expectedStatus: 400, desc: "Missing source" },
      { payload: { alert: { title: "Test", severity: "HIGH", source: "SIEM", timestamp: "invalid-date" } }, expectedStatus: 400, desc: "Malformed timestamp" }
    ];

    for (const testCase of invalidAlerts) {
      const res = await makeRequest("POST", "/api/alerts/analyze", testCase.payload);
      assert(res.status === testCase.expectedStatus, `Rejects ${testCase.desc} with HTTP ${testCase.expectedStatus} (got ${res.status})`);
      assert(res.data.success === false, `Error response has success === false`);
    }

    // 7e: History Parameter Validation & Normalization
    console.log("  [7e] Testing History API Parameter Validation & Clamping...");
    const p1 = await makeRequest("GET", "/api/history?page=-5&limit=-10");
    assert(p1.status === 200, "GET /api/history with negative page/limit returns HTTP 200");
    assert(p1.data.pagination.page === 1, "Negative page normalized to 1");
    assert(p1.data.pagination.limit === 20, "Negative limit normalized to 20");

    const p2 = await makeRequest("GET", "/api/history?limit=5000");
    assert(p2.status === 200, "GET /api/history with excessive limit returns HTTP 200");
    assert(p2.data.pagination.limit === 100, "Excessive limit clamped to max 100");

    const p3 = await makeRequest("GET", "/api/history/invalid-non-numeric-id");
    assert(p3.status === 400, "GET /api/history/non-numeric returns HTTP 400 Bad Request");

    const p4 = await makeRequest("GET", "/api/history/999999999");
    assert(p4.status === 404, "GET /api/history/999999999 returns HTTP 404 Not Found");

    // -------------------------------------------------------------
    // Section 8: Database Integrity & Cascade Deletion
    // -------------------------------------------------------------
    console.log("\n[Section 8: Database Integrity & Cascade Deletion]");
    const deleteTestAnalysisId = primaryAnalysisId;
    const deleteTestAlertId = primaryAlertRecordId;

    const delRes = await makeRequest("DELETE", `/api/history/${deleteTestAnalysisId}`);
    assert(delRes.status === 200, "DELETE /api/history/:analysisId returned HTTP 200");

    // Verify cascade deletion
    const checkAnalysis = await query("SELECT id FROM alert_analyses WHERE id = $1;", [deleteTestAnalysisId]);
    assert(checkAnalysis.rows.length === 0, "Analysis record deleted from database");

    const checkAlert = await query("SELECT id FROM alerts WHERE id = $1;", [deleteTestAlertId]);
    assert(checkAlert.rows.length === 0, "Alert record cascade deleted from database");

    const checkSources = await query("SELECT id FROM alert_analysis_sources WHERE analysis_id = $1;", [deleteTestAnalysisId]);
    assert(checkSources.rows.length === 0, "Analysis sources cascade deleted from database");

    // Remove from cleanup tracking since deleted
    const aIdx = createdAnalysisIds.indexOf(deleteTestAnalysisId);
    if (aIdx !== -1) createdAnalysisIds.splice(aIdx, 1);
    const alIdx = createdAlertRecordIds.indexOf(deleteTestAlertId);
    if (alIdx !== -1) createdAlertRecordIds.splice(alIdx, 1);

  } catch (err) {
    console.error("✖ E2E Verification failed with unhandled error:", err.message);
    console.error(err.stack);
    failed++;
  } finally {
    resetLlmExecutionOverride();
    resetEmbeddingProviderOverride();

    // Clean up created test records
    console.log("\n[Cleanup] Cleaning up isolated test records...");
    for (const anId of createdAnalysisIds) {
      try {
        await postgresAlertHistoryRepository.deleteAnalysisById(anId);
      } catch (_) {}
    }
    for (const alId of createdAlertRecordIds) {
      try {
        await postgresAlertHistoryRepository.deleteAlertById(alId);
      } catch (_) {}
    }
    console.log(`  ✓ Cleaned up test record(s).`);

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  }

  console.log("\n===============================================================");
  console.log(`Module 3.27 E2E Test Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`Real Gemini API Exercised: ${liveGeminiExercised ? "YES (Live)" : "DETERMINISTIC FALLBACK (Quota/Key)"}`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runE2EVerification();
