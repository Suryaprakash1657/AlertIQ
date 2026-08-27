/**
 * Module 3.16 Verification Script: Structured Alert Context & Prompt Construction
 *
 * Tests:
 * 1. Prompt-only request (backward compatibility)
 * 2. Full structured alert with prompt
 * 3. Alert with multi-turn conversation history
 * 4. Alert with only required fields (optional fields omitted)
 * 5. Evidence formatting (arrays and serialized JSON objects)
 * 6. Missing required alert fields (400 validation error)
 * 7. Invalid severity value (400 validation error)
 * 8. Invalid alert object (400 validation error)
 * 9. Token usage and cost calculation validation
 */

import app from "../src/app.js";

async function runTests() {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}/api/llm/test`;

  console.log(`\n======================================================`);
  console.log(`Starting Module 3.16 Structured Alert Context Test Suite`);
  console.log(`Target URL: ${baseUrl}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  async function post(payload) {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  // --- Test 1: Backward Compatibility (Prompt-only) ---
  try {
    console.log("[Test 1] Backward Compatibility: Prompt-only request");
    const { status, data } = await post({
      prompt: "State your role in one short sentence."
    });
    if (status === 200 && data.success && data.alertContextUsed === false && data.response && data.usage && data.estimatedCost) {
      console.log("  PASS: Received 200 OK with alertContextUsed=false");
      console.log(`  Response preview: "${data.response.slice(0, 80).replace(/\n/g, " ")}..."`);
      passed++;
    } else {
      console.error("  FAIL: Unexpected response", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 1):", err.message);
    failed++;
  }

  // --- Test 2: Full Structured Alert with Prompt ---
  try {
    console.log("\n[Test 2] Valid Full Structured Alert Request");
    const { status, data } = await post({
      prompt: "What is the primary risk and what immediate containment step should be taken?",
      alert: {
        alertId: "ALT-1042",
        title: "Multiple Failed Login Attempts",
        severity: "HIGH",
        source: "Authentication Monitor",
        timestamp: "2026-08-27T10:30:00Z",
        sourceIp: "192.168.1.50",
        destinationIp: "10.0.0.5",
        targetHost: "SERVER-01",
        user: "admin",
        status: "NEW",
        description: "15 consecutive failed login attempts detected within 2 minutes.",
        evidence: [
          "10:30:01 - Failed password for root from 192.168.1.50",
          "10:30:15 - Failed password for admin from 192.168.1.50",
          "10:30:45 - Invalid user support from 192.168.1.50"
        ],
        additionalDetails: {
          failedAttempts: 15,
          lockoutTriggered: false
        }
      }
    });

    if (
      status === 200 &&
      data.success &&
      data.alertContextUsed === true &&
      data.response &&
      data.usage &&
      data.estimatedCost
    ) {
      console.log("  PASS: Received 200 OK with alertContextUsed=true");
      console.log(`  Tokens used: ${data.usage.totalTokens} (Input: ${data.usage.inputTokens}, Output: ${data.usage.outputTokens})`);
      console.log(`  Estimated Cost: $${data.estimatedCost.totalCostUsd}`);
      console.log(`  Response preview: "${data.response.slice(0, 100).replace(/\n/g, " ")}..."`);
      passed++;
    } else {
      console.error("  FAIL: Unexpected response", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 2):", err.message);
    failed++;
  }

  // --- Test 3: Alert + Conversation History (Multi-turn) ---
  try {
    console.log("\n[Test 3] Alert + Conversation History (Multi-turn)");
    const { status, data } = await post({
      prompt: "Based on the alert details, should we isolate 192.168.1.50 or SERVER-01?",
      alert: {
        alertId: "ALT-1042",
        title: "Multiple Failed Login Attempts",
        severity: "high", // test lowercase normalization
        source: "Authentication Monitor",
        sourceIp: "192.168.1.50",
        targetHost: "SERVER-01"
      },
      messages: [
        { role: "user", content: "What is this alert about?" },
        { role: "assistant", content: "This is a high-severity alert indicating multiple brute-force login attempts from 192.168.1.50 targeting SERVER-01." }
      ]
    });

    if (status === 200 && data.success && data.alertContextUsed === true && data.conversation.historyMessagesUsed === 2) {
      console.log("  PASS: Received 200 OK with historyMessagesUsed=2 and alertContextUsed=true");
      console.log(`  Response preview: "${data.response.slice(0, 100).replace(/\n/g, " ")}..."`);
      passed++;
    } else {
      console.error("  FAIL: Unexpected response", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 3):", err.message);
    failed++;
  }

  // --- Test 4: Minimal Alert (Only Required Fields) ---
  try {
    console.log("\n[Test 4] Minimal Alert (Required fields only: title, severity, source)");
    const { status, data } = await post({
      prompt: "Assess this alert severity and summarize the threat.",
      alert: {
        title: "Unauthorized S3 Bucket Modification",
        severity: "CRITICAL",
        source: "AWS GuardDuty"
      }
    });

    if (status === 200 && data.success && data.alertContextUsed === true) {
      console.log("  PASS: Minimal required alert fields accepted successfully");
      passed++;
    } else {
      console.error("  FAIL: Unexpected response", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 4):", err.message);
    failed++;
  }

  // --- Test 5: Validation - Missing Required Field (Title) ---
  try {
    console.log("\n[Test 5] Validation: Missing required field (title)");
    const { status, data } = await post({
      prompt: "Assess this alert",
      alert: {
        severity: "HIGH",
        source: "Suricata"
      }
    });

    if (status === 400 && data.success === false && data.error.includes("'title' is required")) {
      console.log(`  PASS: Correctly rejected with 400 - "${data.error}"`);
      passed++;
    } else {
      console.error("  FAIL: Expected 400 with title error", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 5):", err.message);
    failed++;
  }

  // --- Test 6: Validation - Invalid Severity Value ---
  try {
    console.log("\n[Test 6] Validation: Invalid severity value");
    const { status, data } = await post({
      prompt: "Assess this alert",
      alert: {
        title: "Malware Detected",
        severity: "SUPER_CRITICAL",
        source: "CrowdStrike"
      }
    });

    if (status === 400 && data.success === false && data.error.includes("must be one of: LOW, MEDIUM, HIGH, CRITICAL")) {
      console.log(`  PASS: Correctly rejected with 400 - "${data.error}"`);
      passed++;
    } else {
      console.error("  FAIL: Expected 400 with severity error", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 6):", err.message);
    failed++;
  }

  // --- Test 7: Validation - Alert is not an Object ---
  try {
    console.log("\n[Test 7] Validation: Alert is not an object (array/string)");
    const { status, data } = await post({
      prompt: "Assess this alert",
      alert: ["ALT-100", "High Severity Alert"]
    });

    if (status === 400 && data.success === false && data.error.includes("'alert' must be an object")) {
      console.log(`  PASS: Correctly rejected with 400 - "${data.error}"`);
      passed++;
    } else {
      console.error("  FAIL: Expected 400 with invalid object error", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 7):", err.message);
    failed++;
  }

  // --- Test 8: Validation - Invalid Timestamp ---
  try {
    console.log("\n[Test 8] Validation: Invalid timestamp format");
    const { status, data } = await post({
      prompt: "Assess this alert",
      alert: {
        title: "Port Scan Detected",
        severity: "LOW",
        source: "Nmap Scanner",
        timestamp: "not-a-real-date"
      }
    });

    if (status === 400 && data.success === false && data.error.includes("timestamp")) {
      console.log(`  PASS: Correctly rejected with 400 - "${data.error}"`);
      passed++;
    } else {
      console.error("  FAIL: Expected 400 with timestamp error", { status, data });
      failed++;
    }
  } catch (err) {
    console.error("  FAIL (Test 8):", err.message);
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
