/**
 * AlertIQ Module 3.26 — Live Alert History End-to-End Test Suite
 *
 * Verifies the end-to-end flow:
 * Real Alert Pipeline -> Real PostgreSQL Persistence -> Real History Retrieval -> Vector Hygiene -> Isolated Cleanup
 */

import { testConnection, closePool } from "../src/config/db.js";
import { config } from "../src/config/env.js";
import { analyzeAlertPipeline } from "../src/services/alert-analysis.service.js";
import { postgresAlertHistoryRepository } from "../src/repositories/alert-history.repository.js";

const TEST_ID_PREFIX = `test-live-alert-${Date.now()}`;
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

async function runLiveHistoryTest() {
  console.log("===============================================================");
  console.log("   AlertIQ Module 3.26 — Live Alert History Persistence Test   ");
  console.log("===============================================================\n");

  const conn = await testConnection();
  if (!conn.ok) {
    console.error(`✖ Database connection failed: ${conn.error}`);
    process.exit(1);
  }
  console.log(`✓ Connected to PostgreSQL (${conn.host}:${conn.port}/${conn.database})\n`);

  const createdAnalysisIds = [];

  try {
    const liveAlert = {
      alertId: `${TEST_ID_PREFIX}-001`,
      title: "Suspicious Kerberoasting Activity via SPN Query",
      severity: "HIGH",
      source: "ActiveDirectory/SecurityLog",
      timestamp: new Date().toISOString(),
      description: "TGS request ticket requested with RC4 encryption for sensitive service account.",
      sourceIp: "10.0.4.15",
      destinationIp: "10.0.1.5",
      targetHost: "dc01.corp.internal",
      user: "jdoe",
      status: "OPEN",
      evidence: { EventID: 4769, ServiceName: "MSSQLSvc/db01.corp", TicketEncryptionType: "0x17" },
      additionalDetails: { domain: "corp.internal", forest: "corp.internal" }
    };

    console.log("[1/3] Running alert analysis pipeline (enableRag: false for offline reliability)...");
    
    // Test with mock or live depending on apiKey presence
    const result = await analyzeAlertPipeline({
      alert: liveAlert,
      enableRag: false
    });

    assert(result.success === true, "Pipeline execution returned success === true");
    assert(result.analysis !== undefined, "Pipeline returned validated analysis");
    assert(result.persistence !== undefined, "Pipeline returned persistence metadata");
    assert(result.persistence.saved === true, "Pipeline persisted record successfully (saved === true)");
    assert(Number.isInteger(result.persistence.analysisId), "persistence.analysisId is numeric");
    assert(Number.isInteger(result.persistence.alertRecordId), "persistence.alertRecordId is numeric");

    const savedAnalysisId = result.persistence.analysisId;
    createdAnalysisIds.push(savedAnalysisId);

    console.log("\n[2/3] Retrieving persisted analysis from PostgreSQL...");
    const retrieved = await postgresAlertHistoryRepository.findAnalysisById(savedAnalysisId);

    assert(retrieved !== null, "Analysis record retrieved successfully from PostgreSQL");
    assert(retrieved.analysisId === savedAnalysisId, "Retrieved analysisId matches");
    assert(retrieved.alert.alertId === liveAlert.alertId, "Retrieved alertId matches");
    assert(retrieved.alert.title === liveAlert.title, "Retrieved title matches");
    assert(retrieved.alert.userName === liveAlert.user, "Retrieved user matches");
    assert(retrieved.alert.evidence.EventID === 4769, "Retrieved evidence JSONB matches");
    assert(retrieved.analysis.summary === result.analysis.summary, "Retrieved summary matches pipeline output");
    assert(retrieved.analysis.riskAssessment.level === result.analysis.riskAssessment.level, "Retrieved risk level matches");

    console.log("\n[3/3] Verifying zero vector leakage in history retrieval...");
    assert(retrieved.vector === undefined, "Top-level object has no vector");
    assert(retrieved.embedding === undefined, "Top-level object has no embedding");
    assert(retrieved.sources.every((s) => s.vector === undefined && s.embedding === undefined), "Sources have no vectors");

  } catch (err) {
    console.error("✖ Live test encountered error:", err.message);
    failed++;
  } finally {
    console.log("\n[Cleanup] Cleaning up live test analysis records...");
    for (const id of createdAnalysisIds) {
      try {
        await postgresAlertHistoryRepository.deleteAnalysisById(id);
      } catch (_) {}
    }
    console.log(`  ✓ Cleaned up ${createdAnalysisIds.length} test record(s).`);
    await closePool();
  }

  console.log("\n===============================================================");
  console.log(`Live Persistence Test Results: ${passed} passed, ${failed} failed`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveHistoryTest();
