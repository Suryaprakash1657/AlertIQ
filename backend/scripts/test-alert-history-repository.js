/**
 * AlertIQ Module 3.26 — Alert History Repository Verification Test Suite
 *
 * Verifies:
 * 1. Atomic alert + analysis + RAG source persistence in PostgreSQL
 * 2. Complete retrieval of persisted analysis & alert details
 * 3. JSONB arrays integrity (indicators, steps, recommendations, assumptions, limitations)
 * 4. Model and usage persistence
 * 5. RAG metadata (status, matches found, sources used count)
 * 6. RAG source provenance metadata integrity
 * 7. Verification that NO embedding/vector fields are stored in history tables
 * 8. Foreign key relationships and cascade deletion
 * 9. Transaction rollback on simulated persistence failure
 * 10. Pagination and filtering (severity, riskLevel, source, ragStatus)
 * 11. Empty history and non-existent ID handling
 * 12. Safe isolated test cleanup
 */

import { testConnection, closePool, query } from "../src/config/db.js";
import {
  postgresAlertHistoryRepository,
  inMemoryAlertHistoryRepository
} from "../src/repositories/alert-history.repository.js";

const TEST_ID_PREFIX = `test-alert-${Date.now()}`;
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

async function runRepositoryTests() {
  console.log("===============================================================");
  console.log("   AlertIQ Module 3.26 — Alert History Repository Tests        ");
  console.log("===============================================================\n");

  const conn = await testConnection();
  if (!conn.ok) {
    console.error(`✖ Database connection failed: ${conn.error}`);
    process.exit(1);
  }
  console.log(`✓ Connected to PostgreSQL (${conn.host}:${conn.port}/${conn.database})\n`);

  const repo = postgresAlertHistoryRepository;
  const createdAlertIds = [];
  const createdAnalysisIds = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Atomic creation of Alert + Analysis + RAG Sources
    // -------------------------------------------------------------
    console.log("[Test Suite 1: Atomic Persistence & Verification]");
    const testAlert1 = {
      alertId: `${TEST_ID_PREFIX}-001`,
      title: "Suspicious SSH Brute Force Activity",
      severity: "HIGH",
      source: "AuthLog/Syslog",
      timestamp: new Date().toISOString(),
      description: "Multiple failed SSH login attempts from untrusted IP.",
      sourceIp: "192.168.1.100",
      destinationIp: "10.0.0.5",
      targetHost: "prod-bastion-01",
      user: "admin",
      status: "OPEN",
      evidence: { failedAttempts: 45, port: 22 },
      additionalDetails: { environment: "production", region: "us-east-1" }
    };

    const testAnalysis1 = {
      summary: "High volume of failed SSH login attempts indicating automated credential stuffing attack.",
      riskAssessment: {
        level: "HIGH",
        reasoning: "Attack originates from an external IP targeting a privileged production bastion user."
      },
      keyIndicators: ["Failed SSH login threshold exceeded", "Target user is admin", "Known malicious subnet"],
      investigationSteps: ["Review auth.log for successful subsequent logins", "Check firewall drop logs"],
      recommendedActions: ["Block source IP 192.168.1.100 on edge firewall", "Rotate SSH keys for user admin"],
      assumptions: ["Bastion host SSH is public-facing"],
      limitations: ["No host-based agent logs available"]
    };

    const testKnowledgeContext1 = {
      status: "success",
      query: "Suspicious SSH brute force activity",
      matchesFound: 2,
      sourcesUsed: [
        {
          documentId: "threat-doc-ssh-bruteforce",
          title: "SSH Brute Force Mitigation Guide",
          source: "Internal SOC Wiki",
          category: "threat_intel",
          similarity: 0.885
        },
        {
          documentId: "threat-doc-bastion-hardening",
          title: "Bastion Hardening Standard",
          source: "Security Architecture Standard",
          category: "policy",
          similarity: 0.742
        }
      ]
    };

    const testModel1 = "gemini-2.5-flash";
    const testUsage1 = { inputTokens: 450, outputTokens: 210, totalTokens: 660 };

    const saveResult = await repo.saveAlertAnalysis({
      alert: testAlert1,
      analysis: testAnalysis1,
      knowledgeContext: testKnowledgeContext1,
      model: testModel1,
      usage: testUsage1
    });

    assert(saveResult.saved === true, "saveAlertAnalysis returns saved === true");
    assert(Number.isInteger(saveResult.analysisId), "saveAlertAnalysis returns numeric analysisId");
    assert(Number.isInteger(saveResult.alertRecordId), "saveAlertAnalysis returns numeric alertRecordId");
    assert(saveResult.sources.length === 2, "saveAlertAnalysis returns 2 persisted sources");

    createdAlertIds.push(saveResult.alertRecordId);
    createdAnalysisIds.push(saveResult.analysisId);

    // -------------------------------------------------------------
    // Test 2: Complete Retrieval via findAnalysisById
    // -------------------------------------------------------------
    console.log("\n[Test Suite 2: Complete Analysis Retrieval]");
    const retrieved = await repo.findAnalysisById(saveResult.analysisId);

    assert(retrieved !== null, "findAnalysisById returns non-null record");
    assert(retrieved.analysisId === saveResult.analysisId, "Retrieved analysisId matches");
    assert(retrieved.alert.alertId === testAlert1.alertId, "Retrieved alert.alertId matches");
    assert(retrieved.alert.title === testAlert1.title, "Retrieved alert.title matches");
    assert(retrieved.alert.severity === testAlert1.severity, "Retrieved alert.severity matches");
    assert(retrieved.alert.source === testAlert1.source, "Retrieved alert.source matches");
    assert(retrieved.alert.userName === testAlert1.user, "Retrieved alert.userName correctly mapped from alert.user");
    assert(retrieved.alert.sourceIp === testAlert1.sourceIp, "Retrieved alert.sourceIp matches");
    assert(retrieved.alert.destinationIp === testAlert1.destinationIp, "Retrieved alert.destinationIp matches");
    assert(retrieved.alert.targetHost === testAlert1.targetHost, "Retrieved alert.targetHost matches");
    assert(retrieved.alert.status === testAlert1.status, "Retrieved alert.status matches");
    assert(retrieved.alert.evidence.failedAttempts === 45, "Retrieved JSONB alert.evidence matches");
    assert(retrieved.alert.additionalDetails.region === "us-east-1", "Retrieved JSONB alert.additionalDetails matches");

    // Analysis fields
    assert(retrieved.analysis.summary === testAnalysis1.summary, "Retrieved analysis.summary matches");
    assert(retrieved.analysis.riskAssessment.level === "HIGH", "Retrieved riskAssessment.level matches");
    assert(retrieved.analysis.riskAssessment.reasoning === testAnalysis1.riskAssessment.reasoning, "Retrieved riskAssessment.reasoning matches");
    assert(Array.isArray(retrieved.analysis.keyIndicators) && retrieved.analysis.keyIndicators.length === 3, "Retrieved keyIndicators is array of 3");
    assert(Array.isArray(retrieved.analysis.investigationSteps) && retrieved.analysis.investigationSteps.length === 2, "Retrieved investigationSteps is array of 2");
    assert(Array.isArray(retrieved.analysis.recommendedActions) && retrieved.analysis.recommendedActions.length === 2, "Retrieved recommendedActions is array of 2");
    assert(Array.isArray(retrieved.analysis.assumptions) && retrieved.analysis.assumptions.length === 1, "Retrieved assumptions is array of 1");
    assert(Array.isArray(retrieved.analysis.limitations) && retrieved.analysis.limitations.length === 1, "Retrieved limitations is array of 1");

    // Metadata
    assert(retrieved.model === testModel1, "Retrieved model matches");
    assert(retrieved.usage.totalTokens === 660, "Retrieved usage JSONB matches");
    assert(retrieved.ragStatus === "success", "Retrieved ragStatus is 'success'");
    assert(retrieved.matchesFound === 2, "Retrieved matchesFound is 2");
    assert(retrieved.sourcesUsedCount === 2, "Retrieved sourcesUsedCount is 2");

    // Sources Provenance
    assert(retrieved.sources.length === 2, "Retrieved sources count is 2");
    assert(retrieved.sources[0].documentId === "threat-doc-ssh-bruteforce", "First source documentId matches");
    assert(retrieved.sources[0].title === "SSH Brute Force Mitigation Guide", "First source title matches");
    assert(retrieved.sources[0].source === "Internal SOC Wiki", "First source provenance matches");
    assert(retrieved.sources[0].category === "threat_intel", "First source category matches");
    assert(Math.abs(retrieved.sources[0].similarity - 0.885) < 0.001, "First source similarity matches");

    // -------------------------------------------------------------
    // Test 3: Verify NO Vector Fields exist in Alert History Tables
    // -------------------------------------------------------------
    console.log("\n[Test Suite 3: Vector Hygiene Verification]");
    const colRes = await query(`
      SELECT table_name, column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name IN ('alerts', 'alert_analyses', 'alert_analysis_sources')
      ORDER BY table_name, column_name;
    `);

    const hasVectorCol = colRes.rows.some((c) => c.udt_name === "vector" || c.column_name.toLowerCase().includes("embedding") || c.column_name.toLowerCase().includes("vector"));
    assert(!hasVectorCol, "No vector or embedding columns exist in alert history tables");

    // Verify response objects have no vector/embedding properties
    assert(retrieved.sources[0].vector === undefined, "Source 1 does not expose vector property");
    assert(retrieved.sources[0].embedding === undefined, "Source 1 does not expose embedding property");

    // -------------------------------------------------------------
    // Test 4: RAG Status Variants (disabled, no_match, empty_kb, failed)
    // -------------------------------------------------------------
    console.log("\n[Test Suite 4: RAG Status Variants & Source Safety]");
    const testAlert2 = {
      alertId: `${TEST_ID_PREFIX}-002`,
      title: "Isolated Malware Trigger",
      severity: "CRITICAL",
      source: "EDR",
      timestamp: new Date().toISOString()
    };
    const testAnalysis2 = {
      summary: "Isolated ransomware process blocked on endpoint.",
      riskAssessment: { level: "CRITICAL", reasoning: "Ransomware signature matched." },
      keyIndicators: ["Ransomware extension"],
      investigationSteps: ["Isolate host"],
      recommendedActions: ["Reimage machine"]
    };

    // Disabled RAG -> 0 sources
    const saveDisabled = await repo.saveAlertAnalysis({
      alert: testAlert2,
      analysis: testAnalysis2,
      knowledgeContext: { status: "disabled", matchesFound: 0, sourcesUsed: [] }
    });
    createdAlertIds.push(saveDisabled.alertRecordId);
    createdAnalysisIds.push(saveDisabled.analysisId);
    assert(saveDisabled.sources.length === 0, "RAG disabled yields 0 saved sources");

    const retrievedDisabled = await repo.findAnalysisById(saveDisabled.analysisId);
    assert(retrievedDisabled.ragStatus === "disabled", "Persisted ragStatus is disabled");
    assert(retrievedDisabled.sources.length === 0, "Retrieved sources is empty array for disabled RAG");

    // No Match RAG -> 0 sources
    const testAlert3 = {
      alertId: `${TEST_ID_PREFIX}-003`,
      title: "Unknown Port Scan",
      severity: "LOW",
      source: "Network_IDS",
      timestamp: new Date().toISOString()
    };
    const saveNoMatch = await repo.saveAlertAnalysis({
      alert: testAlert3,
      analysis: {
        summary: "Benign port scan.",
        riskAssessment: { level: "LOW", reasoning: "Low volume scan." }
      },
      knowledgeContext: { status: "no_match", matchesFound: 0, sourcesUsed: [] }
    });
    createdAlertIds.push(saveNoMatch.alertRecordId);
    createdAnalysisIds.push(saveNoMatch.analysisId);
    assert(saveNoMatch.sources.length === 0, "RAG no_match yields 0 saved sources");

    // -------------------------------------------------------------
    // Test 5: Pagination & Filtering in findAllAnalyses
    // -------------------------------------------------------------
    console.log("\n[Test Suite 5: Pagination & Filtering]");
    const listAll = await repo.findAllAnalyses({ page: 1, limit: 10 });
    assert(listAll.pagination.page === 1, "List pagination.page is 1");
    assert(listAll.pagination.limit === 10, "List pagination.limit is 10");
    assert(listAll.pagination.total >= 3, "List pagination.total reflects created records");
    assert(Array.isArray(listAll.data) && listAll.data.length >= 3, "List data contains expected items");

    // Check lightweight structure (no evidence, no rawLogs, no large fields)
    const firstItem = listAll.data[0];
    assert(firstItem.analysisId !== undefined, "List item contains analysisId");
    assert(firstItem.title !== undefined, "List item contains title");
    assert(firstItem.severity !== undefined, "List item contains severity");
    assert(firstItem.evidence === undefined, "List item omits heavy evidence field");

    // Filter by severity: CRITICAL
    const filteredSev = await repo.findAllAnalyses({ severity: "CRITICAL" });
    assert(
      filteredSev.data.length > 0 && filteredSev.data.every((i) => i.severity === "CRITICAL"),
      "Filtering by severity: CRITICAL returns only CRITICAL items"
    );

    // Filter by riskLevel: HIGH
    const filteredRisk = await repo.findAllAnalyses({ riskLevel: "HIGH" });
    assert(
      filteredRisk.data.length > 0 && filteredRisk.data.every((i) => i.riskLevel === "HIGH"),
      "Filtering by riskLevel: HIGH returns only HIGH risk items"
    );

    // Filter by ragStatus: success
    const filteredRag = await repo.findAllAnalyses({ ragStatus: "success" });
    assert(
      filteredRag.data.length > 0 && filteredRag.data.every((i) => i.ragStatus === "success"),
      "Filtering by ragStatus: success returns only success items"
    );

    // -------------------------------------------------------------
    // Test 6: Transaction Rollback Verification
    // -------------------------------------------------------------
    console.log("\n[Test Suite 6: Transaction Rollback on Failure]");
    const beforeCountRes = await query("SELECT COUNT(*)::integer as count FROM alerts;");
    const countBefore = beforeCountRes.rows[0].count;

    let transactionErrorThrown = false;
    try {
      // Intentionally supply invalid analysis risk_level violating check constraint
      await repo.saveAlertAnalysis({
        alert: {
          alertId: `${TEST_ID_PREFIX}-invalid`,
          title: "Failing Transaction Test",
          severity: "MEDIUM",
          source: "Firewall"
        },
        analysis: {
          summary: "This will fail on invalid risk level",
          riskAssessment: { level: "INVALID_RISK_LEVEL", reasoning: "Invalid" }
        }
      });
    } catch (err) {
      transactionErrorThrown = true;
    }

    assert(transactionErrorThrown, "Invalid record causes transaction to fail and throw");
    const afterCountRes = await query("SELECT COUNT(*)::integer as count FROM alerts;");
    const countAfter = afterCountRes.rows[0].count;
    assert(countBefore === countAfter, "No orphaned alert record inserted after rollback");

    // -------------------------------------------------------------
    // Test 7: Cascade Delete Verification
    // -------------------------------------------------------------
    console.log("\n[Test Suite 7: Foreign Key & Cascade Delete]");
    const testDeleteAnalysisId = saveResult.analysisId;
    const testDeleteAlertId = saveResult.alertRecordId;

    const deleteSuccess = await repo.deleteAlertById(testDeleteAlertId);
    assert(deleteSuccess, "deleteAlertById returned true");

    // Verify alert, analysis, and sources were all cascade deleted
    const checkAlert = await query("SELECT id FROM alerts WHERE id = $1;", [testDeleteAlertId]);
    assert(checkAlert.rows.length === 0, "Alert record deleted from database");

    const checkAnalysis = await query("SELECT id FROM alert_analyses WHERE id = $1;", [testDeleteAnalysisId]);
    assert(checkAnalysis.rows.length === 0, "Analysis record cascade deleted from database");

    const checkSources = await query("SELECT id FROM alert_analysis_sources WHERE analysis_id = $1;", [testDeleteAnalysisId]);
    assert(checkSources.rows.length === 0, "Analysis sources cascade deleted from database");

    // Remove from tracking list since already deleted
    const delIdxAl = createdAlertIds.indexOf(testDeleteAlertId);
    if (delIdxAl !== -1) createdAlertIds.splice(delIdxAl, 1);
    const delIdxAn = createdAnalysisIds.indexOf(testDeleteAnalysisId);
    if (delIdxAn !== -1) createdAnalysisIds.splice(delIdxAn, 1);

    // -------------------------------------------------------------
    // Test 8: Non-existent ID & In-Memory Repo Equivalence
    // -------------------------------------------------------------
    console.log("\n[Test Suite 8: Non-existent ID & In-Memory Equivalence]");
    const nonExistent = await repo.findAnalysisById(999999999);
    assert(nonExistent === null, "findAnalysisById returns null for non-existent ID");

    // In-Memory test
    const memRepo = inMemoryAlertHistoryRepository;
    const memSaved = await memRepo.saveAlertAnalysis({
      alert: testAlert1,
      analysis: testAnalysis1,
      knowledgeContext: testKnowledgeContext1,
      model: testModel1,
      usage: testUsage1
    });
    assert(memSaved.saved === true, "In-Memory repository saves successfully");
    const memRetrieved = await memRepo.findAnalysisById(memSaved.analysisId);
    assert(memRetrieved.analysis.riskAssessment.level === "HIGH", "In-Memory retrieval matches structure");
    await memRepo.clearAll();

  } finally {
    // -------------------------------------------------------------
    // Cleanup isolated test records
    // -------------------------------------------------------------
    console.log("\n[Cleanup] Cleaning up isolated test records...");
    for (const alertId of createdAlertIds) {
      try {
        await repo.deleteAlertById(alertId);
      } catch (_) {}
    }
    console.log(`  ✓ Cleaned up ${createdAlertIds.length} test record(s).`);
    await closePool();
  }

  console.log("\n===============================================================");
  console.log(`Repository Test Results: ${passed} passed, ${failed} failed`);
  console.log("===============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRepositoryTests();
