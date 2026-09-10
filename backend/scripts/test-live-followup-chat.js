/**
 * Live End-to-End Test for AlertIQ Follow-Up Chat (POST /api/alerts/chat)
 *
 * Tests the real HTTP server, live Gemini API integration, and real PostgreSQL pgvector retrieval.
 */

import http from "http";
import app from "../src/app.js";
import { config } from "../src/config/env.js";
import { alertHistoryRepository } from "../src/repositories/alert-history.repository.js";

const sampleAlert = {
  title: "Multiple Failed SSH Login Attempts Followed by Sudo Elevation",
  severity: "HIGH",
  source: "AuthLog Sensor / SIEM",
  targetHost: "AUTH-SERVER-04",
  description: "Over 45 failed SSH login attempts detected from external IP 203.0.113.88 followed by sudo elevation to root.",
  evidence: [
    "14:20:01 - Failed SSH login for postgres from 203.0.113.88",
    "14:20:15 - Successful SSH login for postgres from 203.0.113.88",
    "14:20:18 - sudo: postgres : TTY=pts/1 ; PWD=/home/postgres ; USER=root ; COMMAND=/bin/bash"
  ]
};

const makePostRequest = (port, path, body) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(responseBody);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: responseBody });
          }
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
};

const runLiveVerification = async () => {
  console.log("\n==================================================================");
  console.log("   AlertIQ Follow-Up Chat (POST /api/alerts/chat) Live HTTP Test   ");
  console.log("==================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  console.log(`✓ Real Express server listening on ephemeral port ${port}`);

  try {
    // 1. Check initial history count to verify zero history pollution
    const initialHistory = await alertHistoryRepository.findAllAnalyses({ limit: 100 });
    const initialCount = initialHistory.pagination.total;
    console.log(`• Baseline database history records count: ${initialCount}`);

    // TEST 1: In-scope question (Alternative mitigations)
    console.log("\n--- [Test 1: Alternative Mitigation Query] ---");
    console.log("Question: 'What is a less disruptive alternative to network isolation?'");
    const res1 = await makePostRequest(port, "/api/alerts/chat", {
      alert: sampleAlert,
      prompt: "What is a less disruptive alternative to network isolation?",
      enableRag: true,
      topK: 3
    });

    console.log(`Status Code: ${res1.status}`);
    console.log(`isOutOfScope: ${res1.body.isOutOfScope}`);
    console.log(`RAG Status: ${res1.body.knowledgeContext?.status} (${res1.body.knowledgeContext?.matchesFound} matches found)`);
    console.log(`Citations: ${res1.body.citations?.map((c) => c.title).join(", ") || "None"}`);
    console.log("\nAI Response Preview:");
    console.log(res1.body.response?.slice(0, 300) + "...\n");

    if (res1.status !== 200 || res1.body.isOutOfScope === true || !res1.body.response) {
      throw new Error("Test 1 Failed!");
    }
    console.log("✓ Test 1 PASSED!");

    // TEST 2: False Positive / Verification question
    console.log("\n--- [Test 2: False-Positive Validation Query] ---");
    console.log("Question: 'Could this be our nightly automated database backup?'");
    const res2 = await makePostRequest(port, "/api/alerts/chat", {
      alert: sampleAlert,
      prompt: "Could this be our nightly automated database backup?",
      enableRag: true
    });

    console.log(`Status Code: ${res2.status}`);
    console.log(`isOutOfScope: ${res2.body.isOutOfScope}`);
    console.log("\nAI Response Preview:");
    console.log(res2.body.response?.slice(0, 300) + "...\n");

    if (res2.status !== 200 || res2.body.isOutOfScope === true) {
      throw new Error("Test 2 Failed!");
    }
    console.log("✓ Test 2 PASSED!");

    // TEST 3: Out-of-scope question (Scope redirection)
    console.log("\n--- [Test 3: Out-of-Scope Redirection Test] ---");
    console.log("Question: 'What is the recipe for pasta carbonara?'");
    const res3 = await makePostRequest(port, "/api/alerts/chat", {
      alert: sampleAlert,
      prompt: "What is the recipe for pasta carbonara?"
    });

    console.log(`Status Code: ${res3.status}`);
    console.log(`isOutOfScope: ${res3.body.isOutOfScope}`);
    console.log(`Response: "${res3.body.response}"`);

    if (res3.status !== 200 || res3.body.isOutOfScope !== true) {
      throw new Error("Test 3 Failed!");
    }
    console.log("✓ Test 3 PASSED!");

    // TEST 3b: Pure Greeting Test ("hello")
    console.log("\n--- [Test 3b: Pure Greeting Test ('hello')] ---");
    const res3b = await makePostRequest(port, "/api/alerts/chat", {
      alert: sampleAlert,
      prompt: "hello"
    });

    console.log(`Status Code: ${res3b.status}`);
    console.log(`isOutOfScope: ${res3b.body.isOutOfScope}`);
    console.log(`RAG Status: ${res3b.body.knowledgeContext?.status}`);
    console.log(`Response: "${res3b.body.response}"`);

    if (
      res3b.status !== 200 ||
      res3b.body.isOutOfScope !== false ||
      !res3b.body.response.toLowerCase().includes("hello") ||
      res3b.body.knowledgeContext?.status !== "disabled"
    ) {
      throw new Error("Test 3b Failed!");
    }
    console.log("✓ Test 3b PASSED!");

    // TEST 3c: Pure Acknowledgement Test ("thanks")
    console.log("\n--- [Test 3c: Pure Acknowledgement Test ('thanks')] ---");
    const res3c = await makePostRequest(port, "/api/alerts/chat", {
      alert: sampleAlert,
      prompt: "thanks"
    });

    console.log(`Status Code: ${res3c.status}`);
    console.log(`Response: "${res3c.body.response}"`);

    if (
      res3c.status !== 200 ||
      !res3c.body.response.toLowerCase().includes("welcome") ||
      res3c.body.knowledgeContext?.status !== "disabled"
    ) {
      throw new Error("Test 3c Failed!");
    }
    console.log("✓ Test 3c PASSED!");


    // TEST 4: Multi-turn conversation history test
    console.log("\n--- [Test 4: Multi-Turn Conversation Continuity Test] ---");
    const res4 = await makePostRequest(port, "/api/alerts/chat", {
      alert: sampleAlert,
      prompt: "What firewall command should I run to block that specific IP?",
      messages: [
        { role: "user", content: "What was the attacker IP?" },
        { role: "assistant", content: "The attacker IP identified in the telemetry is 203.0.113.88." }
      ]
    });

    console.log(`Status Code: ${res4.status}`);
    console.log(`History Messages Used: ${res4.body.conversation?.historyMessagesUsed}`);
    console.log("\nAI Response Preview:");
    console.log(res4.body.response?.slice(0, 300) + "...\n");

    if (res4.status !== 200 || res4.body.conversation?.historyMessagesUsed !== 2) {
      throw new Error("Test 4 Failed!");
    }
    console.log("✓ Test 4 PASSED!");

    // TEST 5: Verify zero database pollution
    console.log("\n--- [Test 5: Zero Database Pollution Verification] ---");
    const finalHistory = await alertHistoryRepository.findAllAnalyses({ limit: 100 });
    const finalCount = finalHistory.pagination.total;
    console.log(`• Final database history records count: ${finalCount}`);

    if (finalCount !== initialCount) {
      throw new Error(`Database pollution detected! Initial: ${initialCount}, Final: ${finalCount}`);
    }
    console.log("✓ Test 5 PASSED: Follow-up chat did NOT write any duplicate records to history database!");

    console.log("\n==================================================================");
    console.log("  ALL LIVE CHAT TESTS COMPLETED SUCCESSFULLY (100% OPERATIONAL)   ");
    console.log("==================================================================\n");
  } finally {
    server.close();
  }
};

runLiveVerification().catch((err) => {
  console.error("Live test execution error:", err);
  process.exit(1);
});
