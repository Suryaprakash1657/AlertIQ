/**
 * AlertIQ Follow-Up Chat Test Suite
 *
 * Validates dedicated conversational Follow-Up Chat pipeline:
 * - Dynamic RAG query construction
 * - Scope limitation & out-of-scope redirection
 * - Contextual reasoning (alternatives, trade-offs, false positives)
 * - Zero database history pollution
 * - Multi-turn conversation normalization
 * - Graceful degradation (disabled RAG, no match)
 */

import assert from "assert";
import { config } from "../src/config/env.js";
import {
  chatWithAlertPipeline,
  setChatLlmExecutionOverride,
  resetChatLlmExecutionOverride,
  isPromptOutOfScope
} from "../src/services/alert-chat.service.js";
import { constructDynamicChatQuery } from "../src/utils/rag.utils.js";
import { SCOPE_REDIRECTION_MESSAGE } from "../src/utils/prompts.js";
import { alertHistoryRepository } from "../src/repositories/alert-history.repository.js";
import { setKnowledgeRepository, inMemoryKnowledgeRepository } from "../src/repositories/knowledge.repository.js";

const sampleAlert = {
  id: "ALT-TEST-SSH-01",
  title: "Multiple Failed SSH Login Attempts Followed by Sudo Elevation",
  severity: "HIGH",
  source: "AuthLog Sensor / SIEM",
  targetHost: "AUTH-SERVER-04",
  description: "Repeated failed SSH logins detected from external IP 203.0.113.88 against user postgres followed by immediate sudo elevation.",
  evidence: [
    "14:20:01 - Failed SSH password for postgres from 203.0.113.88 port 48212",
    "14:20:15 - Successful SSH login for postgres from 203.0.113.88",
    "14:20:18 - sudo: postgres : TTY=pts/1 ; PWD=/home/postgres ; USER=root ; COMMAND=/bin/bash"
  ]
};

let passed = 0;
let failed = 0;

const runTest = async (name, fn) => {
  try {
    process.stdout.write(`• ${name}... `);
    await fn();
    console.log("\x1b[32mPASSED\x1b[0m");
    passed++;
  } catch (err) {
    console.log("\x1b[31mFAILED\x1b[0m");
    console.error(`  Error: ${err.message}`);
    failed++;
  }
};

const runAllTests = async () => {
  console.log("\n=======================================================");
  console.log("  AlertIQ Follow-Up Chat Pipeline Verification Suite");
  console.log("=======================================================\n");

  // Setup in-memory repo for deterministic testing
  setKnowledgeRepository(inMemoryKnowledgeRepository);
  await inMemoryKnowledgeRepository.clear();

  // Seed sample knowledge chunk
  await inMemoryKnowledgeRepository.create(
    {
      id: "doc_ssh_runbook",
      title: "SSH Brute Force Mitigation Playbook",
      source: "Internal Knowledge Base",
      content: "For SSH brute force attacks, isolate the host at the perimeter switch, disable affected user accounts in PAM, and inspect /etc/sudoers.d and ~/.ssh/authorized_keys for persistent backdoors.",
      metadata: { category: "Incident Runbook" }
    },
    [
      {
        id: "doc_ssh_runbook_chk_0",
        documentId: "doc_ssh_runbook",
        chunkIndex: 0,
        totalChunks: 1,
        content: "For SSH brute force attacks, isolate the host at the perimeter switch, disable affected user accounts in PAM, and inspect /etc/sudoers.d and ~/.ssh/authorized_keys for persistent backdoors.",
        metadata: { documentTitle: "SSH Brute Force Mitigation Playbook", category: "Incident Runbook" },
        charCount: 220,
        tokenEstimate: 55,
        embedding: {
          status: "ready",
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: new Array(768).fill(0.05)
        }
      }
    ]
  );

  // Setup deterministic LLM mock executor
  setChatLlmExecutionOverride(async (contents, options) => {
    const userTurn = contents[contents.length - 1]?.parts?.[0]?.text || "";

    if (userTurn.includes("less disruptive") || userTurn.includes("contain")) {
      return {
        text: "Yes, instead of full network isolation, you can apply a targeted host firewall drop (`iptables -A INPUT -s 203.0.113.88 -j DROP`) and lock the `postgres` account. This maintains operational uptime for other services while eliminating the active intruder vector.",
        usage: { inputTokens: 450, outputTokens: 80, totalTokens: 530 },
        estimatedCost: { totalCost: 0.0001 }
      };
    }

    if (userTurn.includes("legitimate automated activity") || userTurn.includes("false positive")) {
      return {
        text: "To verify if this is a legitimate automated administrative script, false positive, or cron job, check the scheduled cron entries in `/etc/crontab` and `/etc/cron.*`, compare the source IP against known management jump-boxes, and verify if the sudo timestamp corresponds with scheduled maintenance windows.",
        usage: { inputTokens: 480, outputTokens: 90, totalTokens: 570 },
        estimatedCost: { totalCost: 0.00012 }
      };
    }


    if (userTurn.includes("risks of immediately terminating")) {
      return {
        text: "The primary risk of terminating all active sessions is disrupting concurrent legitimate database administrative tasks. Additionally, if the attacker has already spawned detached background processes or root daemons, session termination alone will not stop the background payload from executing.",
        usage: { inputTokens: 460, outputTokens: 85, totalTokens: 545 },
        estimatedCost: { totalCost: 0.00011 }
      };
    }

    if (userTurn.includes("persistence was established")) {
      return {
        text: "To check for persistence on Linux following sudo root elevation:\n1. Audit `~/.ssh/authorized_keys` for newly added public keys.\n2. Inspect `/etc/cron*` and `/var/spool/cron/crontabs`.\n3. Check newly registered systemd services in `/etc/systemd/system/`.\n4. Check `/etc/ld.so.preload` for userland rootkits.",
        usage: { inputTokens: 490, outputTokens: 100, totalTokens: 590 },
        estimatedCost: { totalCost: 0.00013 }
      };
    }

    return {
      text: "Guidance provided for incident triage.",
      usage: { inputTokens: 300, outputTokens: 40, totalTokens: 340 },
      estimatedCost: { totalCost: 0.00008 }
    };
  });

  // TEST 1: Alternative mitigation question
  await runTest("Test 1: Alternative mitigation reasoning & in-scope response", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "What is a less disruptive alternative to network isolation?",
      enableRag: false
    });

    assert.strictEqual(res.success, true, "Request should succeed");
    assert.strictEqual(res.isOutOfScope, false, "Should be in scope");
    assert(typeof res.response === "string" && res.response.length > 20, "Response should be substantive");
    assert(res.response.toLowerCase().includes("less disruptive") || res.response.toLowerCase().includes("firewall") || res.response.toLowerCase().includes("iptables"), "Should discuss alternative mitigation");
  });

  // TEST 2: False-positive investigation
  await runTest("Test 2: False-positive investigation guidance", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "Could this be legitimate automated activity, and how can I verify that?",
      enableRag: false
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isOutOfScope, false);
    assert(res.response.toLowerCase().includes("cron") || res.response.toLowerCase().includes("verify"), "Should provide false-positive validation steps");
  });

  // TEST 3: Operational trade-off
  await runTest("Test 3: Operational trade-off analysis", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "What are the risks of immediately terminating all active SSH sessions?",
      enableRag: false
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isOutOfScope, false);
    assert(res.response.toLowerCase().includes("risk") || res.response.toLowerCase().includes("disrupt"), "Should explain trade-offs");
  });

  // TEST 4: Contextual question without alert keywords
  await runTest("Test 4: Contextual question without alert keywords", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "How do I check whether persistence was established?",
      enableRag: false
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isOutOfScope, false);
    assert(res.response.toLowerCase().includes("ssh") || res.response.toLowerCase().includes("cron") || res.response.toLowerCase().includes("systemd"), "Should contextualize persistence to Linux");
  });

  // TEST 5: Clearly unrelated question (Out-of-Scope Gating)
  await runTest("Test 5: Out-of-scope redirection (e.g. recipe/weather)", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "What is the recipe for chocolate chip cookies?"
    });

    assert.strictEqual(res.success, true, "Request should succeed");
    assert.strictEqual(res.isOutOfScope, true, "isOutOfScope must be true");
    assert.strictEqual(res.response, SCOPE_REDIRECTION_MESSAGE, "Should return exact scope redirection message");
    assert.strictEqual(res.citations.length, 0, "No citations for out of scope queries");
    assert.strictEqual(res.knowledgeContext.status, "disabled", "Knowledge retrieval disabled for out of scope");
  });

  // TEST 5b: Pure greeting test ("hello")
  await runTest("Test 5b: Pure greeting handling ('hello')", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "hello"
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isOutOfScope, false);
    assert(res.response.toLowerCase().includes("hello") && res.response.includes(sampleAlert.id), "Response should greet and mention alert");
    assert.strictEqual(res.knowledgeContext.status, "disabled", "RAG should be disabled for pure greetings");
    assert.strictEqual(res.citations.length, 0, "Zero citations for pure greetings");
  });

  // TEST 5c: Pure greeting test ("hi")
  await runTest("Test 5c: Pure greeting handling ('hi')", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "hi"
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isOutOfScope, false);
    assert(res.response.toLowerCase().includes("hello") || res.response.toLowerCase().includes("ready"), "Response should acknowledge readiness");
  });

  // TEST 5d: Pure acknowledgement test ("thanks")
  await runTest("Test 5d: Pure acknowledgement handling ('thanks')", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "thanks"
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isOutOfScope, false);
    assert(res.response.toLowerCase().includes("welcome"), "Response should acknowledge thanks");
    assert.strictEqual(res.knowledgeContext.status, "disabled", "RAG should be disabled for pure thanks");
  });

  // TEST 5e: Mixed greeting + security question ("hello, what is another way to contain this?")
  await runTest("Test 5e: Mixed greeting + security inquiry ('hello, what is another way to contain this?')", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "hello, what is another way to contain this?",
      enableRag: false
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isOutOfScope, false);
    assert(res.response.toLowerCase().includes("less disruptive") || res.response.toLowerCase().includes("firewall") || res.response.toLowerCase().includes("iptables"), "Should process the security question rather than returning pure greeting");
  });

  // TEST 5f: Mixed thanks + security question ("thanks, could this be a false positive?")
  await runTest("Test 5f: Mixed thanks + security inquiry ('thanks, could this be a false positive?')", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "thanks, could this be a false positive?",
      enableRag: false
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isOutOfScope, false);
    assert(res.response.toLowerCase().includes("cron") || res.response.toLowerCase().includes("verify"), "Should process false-positive question rather than returning pure thanks");
  });


  // TEST 6: Dynamic retrieval query difference test
  await runTest("Test 6: Dynamic retrieval queries differ based on user prompt", async () => {
    const query1 = constructDynamicChatQuery(sampleAlert, "What is the standard containment action?");
    const query2 = constructDynamicChatQuery(sampleAlert, "What is a less disruptive alternative?");

    assert(typeof query1 === "string" && query1.length > 0, "Query 1 must be non-empty");
    assert(typeof query2 === "string" && query2.length > 0, "Query 2 must be non-empty");
    assert.notStrictEqual(query1, query2, "Constructed retrieval queries MUST differ for different user questions");
    assert(query1.includes("standard containment action"), "Query 1 must include Question 1 focus");
    assert(query2.includes("less disruptive alternative"), "Query 2 must include Question 2 focus");
  });

  // TEST 7: Conversation history normalization
  await runTest("Test 7: Prior conversation history normalization & multi-turn support", async () => {
    const messages = [
      { role: "user", content: "What is the source IP?" },
      { role: "assistant", content: "The source IP is 203.0.113.88." }
    ];

    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "What is a less disruptive alternative to network isolation?",
      messages,
      enableRag: false
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.conversation.historyMessagesReceived, 2);
    assert.strictEqual(res.conversation.historyMessagesUsed, 2);
    assert.strictEqual(res.conversation.historyTrimmed, false);
  });

  // TEST 8: RAG disabled test
  await runTest("Test 8: RAG disabled configuration (enableRag: false)", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "What are the risks of immediately terminating all active SSH sessions?",
      enableRag: false
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.knowledgeContext.status, "disabled");
    assert.strictEqual(res.knowledgeContext.matchesFound, 0);
  });

  // TEST 9: No-match behavior
  await runTest("Test 9: No-match behavior with low similarity threshold", async () => {
    const res = await chatWithAlertPipeline({
      alert: sampleAlert,
      prompt: "What are the risks of immediately terminating all active SSH sessions?",
      enableRag: true,
      similarityThreshold: 0.60,
      options: {
        embeddingProviderOverride: async () => ({
          model: "gemini-embedding-2",
          dimensions: 768,
          vector: new Array(768).fill(-0.05), // Inverted vector resulting in negative cosine similarity (-1.0)
          generatedAt: new Date().toISOString()
        })
      }
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isOutOfScope, false);
    assert.strictEqual(res.knowledgeContext.status, "no_match");
    assert.strictEqual(res.knowledgeContext.matchesFound, 0);
  });


  // TEST 10: Zero database history pollution
  await runTest("Test 10: Chat calls do NOT write to alert history database", async () => {
    let saveCalled = false;
    const originalSave = alertHistoryRepository.saveAlertAnalysis;
    alertHistoryRepository.saveAlertAnalysis = async () => {
      saveCalled = true;
      return originalSave.apply(alertHistoryRepository, arguments);
    };

    try {
      await chatWithAlertPipeline({
        alert: sampleAlert,
        prompt: "What is a less disruptive alternative to network isolation?",
        enableRag: false
      });

      assert.strictEqual(saveCalled, false, "chatWithAlertPipeline must NEVER call alertHistoryRepository.saveAlertAnalysis");
    } finally {
      alertHistoryRepository.saveAlertAnalysis = originalSave;
    }
  });

  // Reset test override
  resetChatLlmExecutionOverride();

  console.log("\n=======================================================");
  console.log(`  Results: \x1b[32m${passed} Passed\x1b[0m | \x1b[${failed > 0 ? "31" : "32"}m${failed} Failed\x1b[0m`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
};

runAllTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
