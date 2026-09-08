
/**
 * AlertIQ Module 3.26 — Deterministic HTTP History API Test Suite
 *
 * Verifies:
 * 1. POST /api/alerts/analyze saves analysis into PostgreSQL and returns persistence metadata
 * 2. GET /api/history returns paginated lightweight history records
 * 3. GET /api/history query filtering (severity, riskLevel, ragStatus)
 * 4. GET /api/history/:analysisId returns full detailed analysis with RAG provenance
 * 5. GET /api/history/:analysisId validation & 404 handling
 * 6. Vector hygiene (no vectors in HTTP API responses)
 * 7. Graceful degradation when persistence fails (analysis succeeds, persistence.saved === false)
 * 8. Clean isolated cleanup
 */

import http from "http";
import app from "../src/app.js";
import { testConnection, closePool, query } from "../src/config/db.js";
import {
  setLlmExecutionOverride,
  resetLlmExecutionOverride
} from "../src/services/alert-analysis.service.js";
import {
  setAlertHistoryRepository,
  postgresAlertHistoryRepository
} from "../src/repositories/alert-history.repository.js";

const TEST_ID_PREFIX = `test-http-alert-${Date.now()}`;
let server;
let baseUrl;
let passed = 0;
let failed = 0;

const assert = (condition, testName, details = "") => {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${testName} ${details ? `(${details})` : ""}`);
    failed++;
  }
};

const makeRequest = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
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

async function runHttpTests() {
  console.log("===============================================================");
  console.log("   AlertIQ Module 3.26 — Deterministic HTTP History Tests      ");
  console.log("===============================================================\n");

  const conn = await testConnection();
  if (!conn.ok) {
    console.error(`✖ Database connection failed: ${conn.error}`);
    process.exit(1);
  }
  console.log(`✓ Connected to PostgreSQL (${conn.host}:${conn.port}/${conn.database})\n`);

  // Start ephemeral HTTP server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`✓ Ephemeral test server running at ${baseUrl}\n`);

  const createdAnalysisIds = [];

  try {
    // -------------------------------------------------------------
    // Set deterministic LLM mock response
    // -------------------------------------------------------------
    const mockStructuredAnalysis = {
      summary: "Critical credential dump attempt identified via LSASS memory access.",
      riskAssessment: {
        level: "CRITICAL",
        reasoning: "Process accessed LSASS memory without authorized signature."
      },
      keyIndicators: ["LSASS memory access", "Non-standard caller PID 4812", "Privilege escalation token detected"],
      investigationSteps: ["Dump process lineage for PID 4812", "Inspect parent powershell.exe invocation"],
      recommendedActions: ["Isolate host immediately", "Initiate credential revocation for logged-in users"],
      assumptions: ["Caller is malicious utility mimicking standard binary"],
      limitations: ["Endpoint sensor captured partial command line arguments"]
    };

    setLlmExecutionOverride(async () => {
      return {
        text: JSON.stringify(mockStructuredAnalysis),
        usage: { inputTokens: 520, outputTokens: 240, totalTokens: 760 },
        estimatedCost: { inputCost: 0.000078, outputCost: 0.000144, totalCost: 0.000222 }
      };
    });

    // -------------------------------------------------------------
    // Test 1: POST /api/alerts/analyze persists record
    // -------------------------------------------------------------
    console.log("[Test Suite 1: POST /api/alerts/analyze & Persistence]");
    const alertPayload = {
      alert: {
        alertId: `${TEST_ID_PREFIX}-001`,
        title: "LSASS Memory Access by Unsigned Binary",
        severity: "CRITICAL",
        source: "Sysmon",
        timestamp: new Date().toISOString(),
        description: "Process procdump64.exe attempted memory dump of lsass.exe",
        sourceIp: "10.0.1.50",
        destinationIp: "10.0.1.1",
        targetHost: "win-domain-ctrl-01",
        user: "svc_backup",
        status: "NEW",
        evidence: { process: "procdump64.exe", target: "lsass.exe", pid: 4812 }
      },
      enableRag: false // test cleanly without live embedding API requirement
    };

    const analyzeRes = await makeRequest("POST", "/api/alerts/analyze", alertPayload);

    assert(analyzeRes.status === 200, "POST /api/alerts/analyze returns status 200");
    assert(analyzeRes.data.success === true, "Response has success === true");
    assert(analyzeRes.data.analysis !== undefined, "Response contains analysis object");
    assert(analyzeRes.data.analysis.riskAssessment.level === "CRITICAL", "Response analysis.riskAssessment.level is CRITICAL");
    assert(analyzeRes.data.persistence !== undefined, "Response contains persistence section");
    assert(analyzeRes.data.persistence.saved === true, "Response persistence.saved === true");
    assert(Number.isInteger(analyzeRes.data.persistence.analysisId), "persistence.analysisId is numeric");
    assert(Number.isInteger(analyzeRes.data.persistence.alertRecordId), "persistence.alertRecordId is numeric");

    const savedAnalysisId = analyzeRes.data.persistence.analysisId;
    createdAnalysisIds.push(savedAnalysisId);

    // -------------------------------------------------------------
    // Test 2: GET /api/history list endpoint
    // -------------------------------------------------------------
    console.log("\n[Test Suite 2: GET /api/history List Endpoint]");
    const historyListRes = await makeRequest("GET", "/api/history?page=1&limit=20");

    assert(historyListRes.status === 200, "GET /api/history returns status 200");
    assert(historyListRes.data.success === true, "History list response success === true");
    assert(Array.isArray(historyListRes.data.data), "History list data is an array");
    assert(historyListRes.data.pagination !== undefined, "History list includes pagination object");
    assert(historyListRes.data.pagination.page === 1, "Pagination page is 1");
    assert(historyListRes.data.pagination.limit === 20, "Pagination limit is 20");
    assert(historyListRes.data.pagination.total >= 1, "Pagination total is >= 1");

    const foundItem = historyListRes.data.data.find((item) => item.analysisId === savedAnalysisId);
    assert(foundItem !== undefined, "Newly saved analysis appears in history list");
    assert(foundItem.externalAlertId === alertPayload.alert.alertId, "History item externalAlertId matches");
    assert(foundItem.title === alertPayload.alert.title, "History item title matches");
    assert(foundItem.severity === alertPayload.alert.severity, "History item severity matches");
    assert(foundItem.riskLevel === "CRITICAL", "History item riskLevel matches");
    assert(foundItem.ragStatus === "disabled", "History item ragStatus matches");

    // Verify lightweight list (no evidence, no raw vectors)
    assert(foundItem.evidence === undefined, "List item omits raw alert evidence");
    assert(foundItem.vector === undefined, "List item omits vector property");

    // -------------------------------------------------------------
    // Test 3: GET /api/history with Filtering
    // -------------------------------------------------------------
    console.log("\n[Test Suite 3: GET /api/history Filtering]");
    const filteredRes = await makeRequest("GET", `/api/history?severity=CRITICAL&riskLevel=CRITICAL`);
    assert(filteredRes.status === 200, "Filtered history query returns status 200");
    assert(
      filteredRes.data.data.length > 0 && filteredRes.data.data.every((i) => i.severity === "CRITICAL" && i.riskLevel === "CRITICAL"),
      "Filtering returns only matching CRITICAL records"
    );

    // Filter with no match
    const noMatchRes = await makeRequest("GET", `/api/history?source=NonExistentSource999`);
    assert(noMatchRes.status === 200, "No-match filter query returns status 200");
    assert(noMatchRes.data.data.length === 0, "No-match filter returns empty array");
    assert(noMatchRes.data.pagination.total === 0, "No-match filter total is 0");

    // -------------------------------------------------------------
    // Test 4: GET /api/history/:analysisId Detailed Endpoint
    // -------------------------------------------------------------
    console.log("\n[Test Suite 4: GET /api/history/:analysisId Detailed Endpoint]");
    const detailRes = await makeRequest("GET", `/api/history/${savedAnalysisId}`);

    assert(detailRes.status === 200, "GET /api/history/:id returns status 200");
    assert(detailRes.data.success === true, "Detail response success === true");
    const record = detailRes.data.data;
    assert(record.analysisId === savedAnalysisId, "Detail record analysisId matches");
    assert(record.alert.alertId === alertPayload.alert.alertId, "Detail alert.alertId matches");
    assert(record.alert.title === alertPayload.alert.title, "Detail alert.title matches");
    assert(record.alert.userName === alertPayload.alert.user, "Detail alert.userName matches");
    assert(record.alert.evidence.process === "procdump64.exe", "Detail alert.evidence contains full JSONB");
    assert(record.analysis.riskAssessment.level === "CRITICAL", "Detail analysis risk level is CRITICAL");
    assert(record.analysis.keyIndicators.length === 3, "Detail keyIndicators length is 3");
    assert(record.model === "gemini-2.5-flash" || typeof record.model === "string", "Detail model is present");
    assert(record.usage !== null, "Detail usage metadata is present");
    assert(Array.isArray(record.sources), "Detail sources is an array");

    // Vector hygiene check
    assert(record.sources.every((s) => s.vector === undefined && s.embedding === undefined), "No vectors in detail sources");

    // -------------------------------------------------------------
    // Test 5: Validation & Error Handling on History Endpoints
    // -------------------------------------------------------------
    console.log("\n[Test Suite 5: Validation & Error Handling]");
    const invalidIdRes = await makeRequest("GET", "/api/history/not-a-number");
    assert(invalidIdRes.status === 400, "GET /api/history/invalid-id returns 400 Bad Request");
    assert(invalidIdRes.data.success === false, "400 response has success === false");

    const nonExistentRes = await makeRequest("GET", "/api/history/999999999");
    assert(nonExistentRes.status === 404, "GET /api/history/999999999 returns 404 Not Found");
    assert(nonExistentRes.data.success === false, "404 response has success === false");

    // -------------------------------------------------------------
    // Test 6: Graceful Degradation on Persistence Failure
    // -------------------------------------------------------------
    console.log("\n[Test Suite 6: Graceful Persistence Failure Degradation]");
    // Mock failing repository
    const failingRepoMock = {
      saveAlertAnalysis: async () => {
        throw new Error("Simulated database connection pool exhaustion or constraint error.");
      }
    };
    setAlertHistoryRepository(failingRepoMock);

    const failAlertPayload = {
      alert: {
        alertId: `${TEST_ID_PREFIX}-fail-persist`,
        title: "Test Alert When DB Persistence Fails",
        severity: "MEDIUM",
        source: "WAF"
      },
      enableRag: false
    };

    const failAnalyzeRes = await makeRequest("POST", "/api/alerts/analyze", failAlertPayload);

    assert(failAnalyzeRes.status === 200, "Pipeline returns status 200 even if persistence fails");
    assert(failAnalyzeRes.data.success === true, "Analysis success is preserved");
    assert(failAnalyzeRes.data.analysis !== undefined, "Analysis object is present in response");
    assert(failAnalyzeRes.data.persistence !== undefined, "Persistence section is present");
    assert(failAnalyzeRes.data.persistence.saved === false, "persistence.saved is false when DB persistence fails");
    assert(failAnalyzeRes.data.persistence.analysisId === undefined, "No analysisId returned when persistence failed");

    // Restore standard postgres repository
    setAlertHistoryRepository(postgresAlertHistoryRepository);

  } finally {
    resetLlmExecutionOverride();

    // Clean up created records
    console.log("\n[Cleanup] Cleaning up test analyses...");
    for (const analysisId of createdAnalysisIds) {
      try {
        await postgresAlertHistoryRepository.deleteAnalysisById(analysisId);
      } catch (_) {}
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  }

  console.log("\n===============================================================");
  console.log(`HTTP History Test Results: ${passed} passed, ${failed} failed`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runHttpTests();
