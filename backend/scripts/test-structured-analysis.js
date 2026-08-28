/**
 * Module 3.17 Verification Script: Structured AI Analysis Output
 *
 * Tests:
 * 1. Valid full structured alert analysis (POST /api/llm/analyze)
 * 2. Minimal alert with only required fields (title, severity, source)
 * 3. Structured analysis with custom prompt focus
 * 4. Structured analysis with multi-turn conversation history
 * 5. Missing alert validation error (HTTP 400)
 * 6. Invalid alert validation error (missing title / bad severity - HTTP 400)
 * 7. Invalid messages validation error (HTTP 400)
 * 8. Backward compatibility: POST /api/llm/test prompt-only
 * 9. Backward compatibility: POST /api/llm/test with alert context
 * 10. Schema verification: summary, riskAssessment, and 5 array fields
 * 11. Risk assessment verification: level in LOW|MEDIUM|HIGH|CRITICAL and non-empty reasoning
 * 12. Token usage metrics and estimated cost verification
 */

import app from "../src/app.js";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function runTests() {
  const server = app.listen(0);
  const { port } = server.address();
  const analyzeUrl = `http://localhost:${port}/api/llm/analyze`;
  const testUrl = `http://localhost:${port}/api/llm/test`;

  console.log(`\n======================================================`);
  console.log(`Starting Module 3.17 Structured AI Analysis Test Suite`);
  console.log(`Analyze Endpoint: ${analyzeUrl}`);
  console.log(`Test Endpoint:    ${testUrl}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  async function post(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  // Helper schema validator
  function validateAnalysisSchema(analysis) {
    if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
      return { valid: false, reason: "analysis is not an object" };
    }
    if (typeof analysis.summary !== "string" || analysis.summary.trim() === "") {
      return { valid: false, reason: "summary is missing or not a string" };
    }
    if (!analysis.riskAssessment || typeof analysis.riskAssessment !== "object") {
      return { valid: false, reason: "riskAssessment is missing or not an object" };
    }
    const validLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    if (!validLevels.includes(analysis.riskAssessment.level)) {
      return { valid: false, reason: `riskAssessment.level '${analysis.riskAssessment.level}' is not in ${validLevels.join(", ")}` };
    }
    if (typeof analysis.riskAssessment.reasoning !== "string") {
      return { valid: false, reason: "riskAssessment.reasoning is not a string" };
    }

    const arrayFields = ["keyIndicators", "investigationSteps", "recommendedActions", "assumptions", "limitations"];
    for (const field of arrayFields) {
      if (!Array.isArray(analysis[field])) {
        return { valid: false, reason: `${field} is not an array` };
      }
    }

    return { valid: true };
  }

  // --- Test 1: Full Structured Alert Analysis ---
  try {
    console.log("[Test 1] Full Structured Alert Analysis (POST /api/llm/analyze)");
    const { status, data } = await post(analyzeUrl, {
      alert: {
        alertId: "ALT-2099",
        title: "Multiple Failed SSH Authentication Attempts Followed by Sudo Elevation",
        severity: "CRITICAL",
        source: "AuthLog Sensor / SIEM",
        timestamp: "2026-08-28T14:22:00Z",
        sourceIp: "203.0.113.88",
        destinationIp: "10.0.1.15",
        targetHost: "prod-db-master",
        user: "postgres",
        status: "OPEN",
        description: "Over 40 failed SSH logins followed by successful login and immediate sudo root shell execution.",
        evidence: [
          "14:20:01 - Failed SSH login for postgres from 203.0.113.88",
          "14:21:45 - Accepted password for postgres from 203.0.113.88 port 54822 ssh2",
          "14:22:00 - sudo: postgres : TTY=pts/0 ; PWD=/home/postgres ; USER=root ; COMMAND=/bin/bash"
        ],
        additionalDetails: {
          externalGeoLocation: "Unknown ASN",
          mfaTriggered: false
        }
      }
    });

    const schemaCheck = validateAnalysisSchema(data?.analysis);

    if (status === 200 && data.success && schemaCheck.valid && data.usage?.totalTokens > 0 && data.estimatedCost) {
      console.log("  PASS: Received 200 OK with valid structured analysis schema");
      console.log(`  Summary: "${data.analysis.summary.slice(0, 100)}..."`);
      console.log(`  Risk Assessment: [${data.analysis.riskAssessment.level}] ${data.analysis.riskAssessment.reasoning.slice(0, 80)}...`);
      console.log(`  Key Indicators count: ${data.analysis.keyIndicators.length}`);
      console.log(`  Investigation Steps count: ${data.analysis.investigationSteps.length}`);
      console.log(`  Recommended Actions count: ${data.analysis.recommendedActions.length}`);
      console.log(`  Assumptions count: ${data.analysis.assumptions.length}`);
      console.log(`  Limitations count: ${data.analysis.limitations.length}`);
      console.log(`  Tokens: ${data.usage.totalTokens}, Est Cost: $${data.estimatedCost.totalCostUsd}`);
      passed++;
    } else {
      console.error("  FAIL: Schema validation or response error", { status, data, schemaCheck });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 1):", err.message);
    failed++;
  }

  await delay(1200);

  // --- Test 2: Minimal Alert (Only Required Fields) ---
  try {
    console.log("\n[Test 2] Minimal Alert (Required fields only: title, severity, source)");
    const { status, data } = await post(analyzeUrl, {
      alert: {
        title: "Suspicious DNS Tunneling Query Patterns",
        severity: "HIGH",
        source: "CoreDNS Sensor"
      }
    });

    const schemaCheck = validateAnalysisSchema(data?.analysis);

    if (status === 200 && data.success && schemaCheck.valid) {
      console.log("  PASS: Minimal alert produced valid structured analysis");
      console.log(`  Summary: "${data.analysis.summary.slice(0, 90)}..."`);
      console.log(`  Risk Assessment Level: ${data.analysis.riskAssessment.level}`);
      passed++;
    } else {
      console.error("  FAIL: Minimal alert failed", { status, data, schemaCheck });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 2):", err.message);
    failed++;
  }

  await delay(1200);

  // --- Test 3: Structured Analysis with Optional Custom Prompt ---
  try {
    console.log("\n[Test 3] Structured Analysis with Custom Investigation Prompt");
    const { status, data } = await post(analyzeUrl, {
      prompt: "Focus specifically on whether data exfiltration or credential dumping may have occurred.",
      alert: {
        title: "LSASS Memory Dump Attempt",
        severity: "CRITICAL",
        source: "Endpoint EDR",
        targetHost: "WIN-SRV-DC01",
        user: "SYSTEM",
        description: "Process procdump.exe initiated against lsass.exe"
      }
    });

    const schemaCheck = validateAnalysisSchema(data?.analysis);

    if (status === 200 && data.success && schemaCheck.valid) {
      console.log("  PASS: Custom prompt successfully integrated with structured analysis");
      console.log(`  Summary: "${data.analysis.summary.slice(0, 100)}..."`);
      console.log(`  Risk Level: ${data.analysis.riskAssessment.level}`);
      passed++;
    } else {
      console.error("  FAIL: Custom prompt request failed", { status, data, schemaCheck });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 3):", err.message);
    failed++;
  }

  await delay(1200);

  // --- Test 4: Structured Analysis with Conversation History ---
  try {
    console.log("\n[Test 4] Structured Analysis with Multi-Turn Conversation History");
    const { status, data } = await post(analyzeUrl, {
      prompt: "Re-evaluate the risk assuming the destination host was an isolated sandbox.",
      alert: {
        title: "Ransomware Canary File Renamed",
        severity: "CRITICAL",
        source: "File Integrity Monitor",
        targetHost: "SANDBOX-09"
      },
      messages: [
        { role: "user", content: "We suspect this alert is from a sandbox detonation test." },
        { role: "assistant", content: "Understood. If the machine is isolated in a malware sandbox, containment risk is reduced." }
      ]
    });

    const schemaCheck = validateAnalysisSchema(data?.analysis);

    if (
      status === 200 &&
      data.success &&
      schemaCheck.valid &&
      data.conversation?.historyMessagesUsed === 2
    ) {
      console.log("  PASS: Conversation history utilized and tracked in metadata");
      console.log(`  History Used: ${data.conversation.historyMessagesUsed}, Trimmed: ${data.conversation.historyTrimmed}`);
      console.log(`  Risk Assessment: [${data.analysis.riskAssessment.level}] ${data.analysis.riskAssessment.reasoning.slice(0, 80)}...`);
      passed++;
    } else {
      console.error("  FAIL: Conversation history test failed", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 4):", err.message);
    failed++;
  }

  // --- Test 5: Missing Alert Returns 400 (Local validation - fast) ---
  try {
    console.log("\n[Test 5] Validation: Missing Alert Payload (HTTP 400)");
    const { status, data } = await post(analyzeUrl, {
      prompt: "Analyze this alert"
    });

    if (status === 400 && data.success === false && data.error.includes("'alert' is required")) {
      console.log(`  PASS: Correctly returned 400 Bad Request - "${data.error}"`);
      passed++;
    } else {
      console.error("  FAIL: Expected 400 missing alert error", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 5):", err.message);
    failed++;
  }

  // --- Test 6: Invalid Alert (Missing Title & Invalid Severity) ---
  try {
    console.log("\n[Test 6] Validation: Invalid Alert Fields (HTTP 400)");
    const { status, data } = await post(analyzeUrl, {
      alert: {
        title: "",
        severity: "INVALID_SEVERITY",
        source: "Firewall"
      }
    });

    if (status === 400 && data.success === false) {
      console.log(`  PASS: Correctly rejected invalid alert with 400 - "${data.error}"`);
      passed++;
    } else {
      console.error("  FAIL: Expected 400 for invalid alert", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 6):", err.message);
    failed++;
  }

  // --- Test 7: Invalid Messages Array Format (HTTP 400) ---
  try {
    console.log("\n[Test 7] Validation: Invalid Messages Format (HTTP 400)");
    const { status, data } = await post(analyzeUrl, {
      alert: {
        title: "Unauthorized Access",
        severity: "HIGH",
        source: "IAM"
      },
      messages: "not-an-array"
    });

    if (status === 400 && data.success === false && data.error.includes("'messages' must be an array")) {
      console.log(`  PASS: Correctly rejected invalid messages with 400 - "${data.error}"`);
      passed++;
    } else {
      console.error("  FAIL: Expected 400 for invalid messages", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 7):", err.message);
    failed++;
  }

  await delay(1200);

  // --- Test 8: Backward Compatibility - POST /api/llm/test (Prompt-Only) ---
  try {
    console.log("\n[Test 8] Backward Compatibility: POST /api/llm/test (Prompt-Only)");
    const { status, data } = await post(testUrl, {
      prompt: "State AlertIQ's primary mission in one short sentence."
    });

    if (
      status === 200 &&
      data.success &&
      data.alertContextUsed === false &&
      typeof data.response === "string" &&
      data.usage?.totalTokens > 0
    ) {
      console.log("  PASS: /api/llm/test remains fully operational");
      console.log(`  Response preview: "${data.response.slice(0, 80).replace(/\n/g, " ")}..."`);
      passed++;
    } else {
      console.error("  FAIL: /api/llm/test prompt-only failed", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 8):", err.message);
    failed++;
  }

  await delay(1200);

  // --- Test 9: Backward Compatibility - POST /api/llm/test with Alert Context ---
  try {
    console.log("\n[Test 9] Backward Compatibility: POST /api/llm/test with Alert Context");
    const { status, data } = await post(testUrl, {
      prompt: "What is the source IP in this alert?",
      alert: {
        title: "Brute Force Attack",
        severity: "HIGH",
        source: "Suricata IDS",
        sourceIp: "198.51.100.42"
      }
    });

    if (
      status === 200 &&
      data.success &&
      data.alertContextUsed === true &&
      typeof data.response === "string" &&
      data.response.includes("198.51.100.42")
    ) {
      console.log("  PASS: /api/llm/test correctly incorporates alert context into free-form response");
      console.log(`  Response: "${data.response.slice(0, 80).replace(/\n/g, " ")}..."`);
      passed++;
    } else {
      console.error("  FAIL: /api/llm/test with alert context failed", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 9):", err.message);
    failed++;
  }

  await delay(1200);

  // --- Test 10: Array Elements Are Strings ---
  try {
    console.log("\n[Test 10] Validation: Verification of Array Elements Types");
    const { status, data } = await post(analyzeUrl, {
      alert: {
        title: "Malicious PowerShell Encoded Command Execution",
        severity: "HIGH",
        source: "Sysmon",
        description: "powershell.exe -enc SQBFAFgA..."
      }
    });

    const analysis = data?.analysis;
    const arrayFields = ["keyIndicators", "investigationSteps", "recommendedActions", "assumptions", "limitations"];
    let allStringArrays = true;
    for (const field of arrayFields) {
      if (!Array.isArray(analysis?.[field]) || !analysis[field].every((item) => typeof item === "string")) {
        allStringArrays = false;
        break;
      }
    }

    if (status === 200 && data.success && allStringArrays) {
      console.log("  PASS: All 5 array fields strictly contain string elements");
      passed++;
    } else {
      console.error("  FAIL: Array fields did not contain pure strings", { status, analysis });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 10):", err.message);
    failed++;
  }

  // --- Test 11: Unit Validation of Normalization & Risk Level ---
  try {
    console.log("\n[Test 11] Validation: Direct Unit Validation of Normalizer Logic");
    const { validateAndNormalizeAnalysis } = await import("../src/utils/analysis.utils.js");
    const normalized = validateAndNormalizeAnalysis({
      summary: "  Suspicious outbound beacon detected.  ",
      riskAssessment: {
        level: "critical", // lowercase to test uppercase normalization
        reasoning: "  Confirmed C2 traffic to known malicious host.  "
      },
      keyIndicators: ["C2 IP: 198.51.100.5", 12345], // tests number conversion
      investigationSteps: ["Review firewall logs"],
      recommendedActions: ["Block IP on edge firewall"],
      assumptions: null, // tests null fallback to []
      limitations: undefined // tests undefined fallback to []
    });

    if (
      normalized.summary === "Suspicious outbound beacon detected." &&
      normalized.riskAssessment.level === "CRITICAL" &&
      normalized.riskAssessment.reasoning === "Confirmed C2 traffic to known malicious host." &&
      normalized.keyIndicators.length === 2 &&
      normalized.keyIndicators[1] === "12345" &&
      Array.isArray(normalized.assumptions) &&
      normalized.assumptions.length === 0 &&
      Array.isArray(normalized.limitations) &&
      normalized.limitations.length === 0
    ) {
      console.log("  PASS: validateAndNormalizeAnalysis handles casing, whitespace, and null arrays correctly");
      passed++;
    } else {
      console.error("  FAIL: Normalizer unit test failed", normalized);
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 11):", err.message);
    failed++;
  }

  // --- Test 12: Controlled Error on Critical Invalid AI Output ---
  try {
    console.log("\n[Test 12] Validation: Controlled Backend Error on Malformed AI JSON");
    const { validateAndNormalizeAnalysis, parseAnalysisResponse } = await import("../src/utils/analysis.utils.js");

    let parseErrorThrown = false;
    try {
      parseAnalysisResponse("This is not JSON at all");
    } catch (e) {
      if (e.statusCode === 502) parseErrorThrown = true;
    }

    let schemaErrorThrown = false;
    try {
      validateAndNormalizeAnalysis({
        summary: "", // empty summary should fail
        riskAssessment: { level: "INVALID_LEVEL" }
      });
    } catch (e) {
      if (e.statusCode === 502) schemaErrorThrown = true;
    }

    if (parseErrorThrown && schemaErrorThrown) {
      console.log("  PASS: Malformed or invalid AI outputs throw controlled 502 errors");
      passed++;
    } else {
      console.error("  FAIL: Error handling verification failed", { parseErrorThrown, schemaErrorThrown });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 12):", err.message);
    failed++;
  }

  console.log(`\n======================================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
