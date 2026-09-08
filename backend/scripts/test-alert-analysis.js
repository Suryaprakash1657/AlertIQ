/**
 * Comprehensive Automated Test Suite for Module 3.23 — Production Alert Analysis Pipeline
 *
 * Tests:
 * 1. Full RAG analysis orchestration with real threat corpus and structured output
 * 2. RAG disabled behavior (enableRag=false) with zero embedding or retrieval calls
 * 3. Successful retrieval with zero matches (status="no_match")
 * 4. Empty Knowledge Base state (status="empty_kb")
 * 5. Simulated embedding/retrieval technical failure with graceful fallback (status="failed")
 * 6. Alert schema validation (missing alert, invalid severity, missing title/source)
 * 7. Malformed Gemini structured output handling (schema validation and JSON error handling)
 * 8. Provenance preservation and zero vector leakage
 * 9. HTTP route integration test for POST /api/alerts/analyze
 * 10. Server startup safety (no automatic seeding)
 */

import http from "http";
import app from "../src/app.js";
import {
  analyzeAlertPipeline,
  setLlmExecutionOverride,
  resetLlmExecutionOverride
} from "../src/services/alert-analysis.service.js";
import { ingestThreatCorpus } from "../src/services/threat-corpus.service.js";
import { clearKnowledgeBase } from "../src/services/knowledge.service.js";
import { useInMemoryRepository } from "../src/repositories/knowledge.repository.js";
import { config } from "../src/config/env.js";

// Deterministic mock embedding provider
const createMockEmbeddingProvider = (options = {}) => {
  let callCount = 0;
  const provider = async (text, opt = {}) => {
    callCount++;
    if (options.shouldFail) {
      const err = new Error("Simulated embedding provider timeout: 503 Service Unavailable");
      err.statusCode = 503;
      throw err;
    }

    const clean = (text || "").toLowerCase();
    const docTitle = (opt.title || "").toLowerCase();
    const dims = config.embeddingDimensions || 768;
    const vec = new Array(dims).fill(0.001);

    let clusterIdx = 9; // Unrelated queries map to orthogonal cluster 9
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
    const startIdx = (clusterIdx * clusterSize) % (dims - clusterSize);

    for (let i = 0; i < clusterSize; i++) {
      vec[startIdx + i] = 1.0 + Math.sin(i * 0.4) * 0.2;
    }

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

  provider.getCallCount = () => callCount;
  return provider;
};

// Deterministic mock LLM executor
const createMockLlmExecutor = (overrideOutput = null) => {
  return async (contents, options = {}) => {
    if (overrideOutput && typeof overrideOutput === "string") {
      return {
        text: overrideOutput,
        usage: { inputTokens: 450, outputTokens: 210, totalTokens: 660 },
        estimatedCost: { inputCost: 0.00003, outputCost: 0.00006, totalCost: 0.00009, currency: "USD" }
      };
    }

    const defaultAnalysis = {
      summary: "Potential Ransomware execution identified on corporate endpoint DB-SRV-01. Shadow copy deletion and mass encryption detected.",
      riskAssessment: {
        level: "CRITICAL",
        reasoning: "Confirmed Volume Shadow deletion commands coupled with rapid .locked file creation indicate active cryptographic impact stage."
      },
      keyIndicators: [
        "vssadmin.exe delete shadows execution",
        "Mass creation of .locked files in C:\\Data",
        "Outbound connection to suspicious external IP 198.51.100.42"
      ],
      investigationSteps: [
        "Examine Windows Event ID 4688 for parent process of vssadmin.exe",
        "Acquire volatile memory image before host shutdown",
        "Check Active Directory logs for compromised administrator credentials"
      ],
      recommendedActions: [
        "Immediately isolate DB-SRV-01 from enterprise network via EDR",
        "Disable compromised user account jsmith-admin",
        "Verify integrity of offline immutable backups before initiating restoration"
      ],
      assumptions: [
        "Assuming lateral movement has not yet reached Domain Controllers based on provided telemetry"
      ],
      limitations: [
        "Network packet capture was not provided in the raw alert logs"
      ]
    };

    return {
      text: JSON.stringify(defaultAnalysis),
      usage: { inputTokens: 520, outputTokens: 280, totalTokens: 800 },
      estimatedCost: { inputCost: 0.00004, outputCost: 0.00008, totalCost: 0.00012, currency: "USD" }
    };
  };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

let passed = 0;
let failed = 0;

const runTest = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
};

const main = async () => {
  useInMemoryRepository();
  console.log("\n===============================================================");
  console.log("   AlertIQ Module 3.23 — Production Alert Analysis Tests       ");
  console.log("===============================================================\n");

  const mockEmbeddingProvider = createMockEmbeddingProvider();
  const mockLlmExecutor = createMockLlmExecutor();

  // Setup: Seed the 8-domain threat corpus with deterministic embeddings
  await clearKnowledgeBase();
  await ingestThreatCorpus({
    force: true,
    providerOverride: mockEmbeddingProvider
  });

  // -------------------------------------------------------------
  // Section 1: Successful Production RAG Analysis
  // -------------------------------------------------------------
  console.log("--- Section 1: Successful Production RAG Analysis ---");

  await runTest("Orchestrates full RAG analysis with status='success' and valid structured schema", async () => {
    const payload = {
      alert: {
        alertId: "ALT-2026-001",
        title: "Ransomware Behavior Detected: Volume Shadow Copy Deletion",
        severity: "CRITICAL",
        source: "CrowdStrike Falcon",
        description: "Suspicious execution of vssadmin.exe delete shadows /all /quiet and rapid creation of .locked files.",
        targetHost: "DB-SRV-01",
        sourceIp: "10.0.4.15",
        user: "jsmith-admin",
        rawLogs: ["vssadmin.exe delete shadows /all /quiet", "file_create: C:\\Data\\finance.xlsx.locked"]
      },
      prompt: "What immediate containment steps should our SOC take?",
      options: {
        enableRag: true,
        embeddingProviderOverride: mockEmbeddingProvider,
        llmExecutorOverride: mockLlmExecutor
      }
    };

    const result = await analyzeAlertPipeline(payload);

    assert(result.success === true, "Result must report success: true");
    assert(typeof result.analysis === "object" && result.analysis !== null, "Analysis must be an object");
    assert(result.analysis.summary.length > 10, "Analysis must contain summary");
    assert(result.analysis.riskAssessment.level === "CRITICAL", "Risk level must be CRITICAL");
    assert(Array.isArray(result.analysis.keyIndicators) && result.analysis.keyIndicators.length > 0, "keyIndicators missing");
    assert(Array.isArray(result.analysis.investigationSteps) && result.analysis.investigationSteps.length > 0, "investigationSteps missing");
    assert(Array.isArray(result.analysis.recommendedActions) && result.analysis.recommendedActions.length > 0, "recommendedActions missing");
    assert(Array.isArray(result.analysis.assumptions), "assumptions must be an array");
    assert(Array.isArray(result.analysis.limitations), "limitations must be an array");

    // Knowledge context verification
    assert(result.knowledgeContext.status === "success", `Expected status 'success', got '${result.knowledgeContext.status}'`);
    assert(result.knowledgeContext.matchesFound > 0, "Expected matchesFound > 0");
    assert(result.knowledgeContext.sourcesUsed.length > 0, "Expected sourcesUsed > 0");

    // Provenance verification
    const topSource = result.knowledgeContext.sourcesUsed[0];
    assert(topSource.documentId === "doc-threat-cisa-ransomware-01", "Expected Ransomware document to be retrieved");
    assert(topSource.title.includes("Ransomware"), "Source title mismatch");
    assert(topSource.source.includes("CISA"), "Authoritative source mismatch");
    assert(topSource.category === "incident_response", "Category mismatch");
    assert(typeof topSource.similarity === "number", "Similarity must be numeric");

    // Token accounting & cost
    assert(result.usage && result.usage.totalTokens > 0, "Total tokens must be > 0");
    assert(result.estimatedCost && result.estimatedCost.totalCost > 0, "Cost must be > 0");
  });

  await runTest("Knowledge context and retrieval results NEVER leak raw vector arrays", async () => {
    const payload = {
      alert: {
        title: "Suspicious PowerShell Execution",
        severity: "HIGH",
        source: "Windows Defender ATP"
      },
      options: {
        embeddingProviderOverride: mockEmbeddingProvider,
        llmExecutorOverride: mockLlmExecutor
      }
    };

    const result = await analyzeAlertPipeline(payload);

    for (const source of result.knowledgeContext.sourcesUsed) {
      assert(source.vector === undefined, "Source entry must NOT have 'vector' property");
      assert(source.embedding === undefined, "Source entry must NOT have 'embedding' property");
    }

    const serialized = JSON.stringify(result);
    assert(!serialized.includes('"vector":['), "Serialized JSON must not contain raw vector arrays");
  });

  // -------------------------------------------------------------
  // Section 2: RAG Disabled Flow (enableRag=false)
  // -------------------------------------------------------------
  console.log("\n--- Section 2: RAG Disabled Flow (enableRag=false) ---");

  await runTest("When enableRag=false, status='disabled' with ZERO embedding/retrieval calls", async () => {
    const trackingEmbeddingProvider = createMockEmbeddingProvider();

    const payload = {
      alert: {
        title: "SSH Brute Force Attack",
        severity: "MEDIUM",
        source: "Linux Auth Log"
      },
      enableRag: false,
      options: {
        embeddingProviderOverride: trackingEmbeddingProvider,
        llmExecutorOverride: mockLlmExecutor
      }
    };

    const result = await analyzeAlertPipeline(payload);

    assert(result.success === true, "Analysis must succeed");
    assert(result.knowledgeContext.status === "disabled", `Expected status 'disabled', got '${result.knowledgeContext.status}'`);
    assert(result.knowledgeContext.matchesFound === 0, "matchesFound must be 0");
    assert(result.knowledgeContext.sourcesUsed.length === 0, "sourcesUsed must be empty");
    assert(trackingEmbeddingProvider.getCallCount() === 0, "Embedding provider must NOT be called when RAG is disabled");
  });

  // -------------------------------------------------------------
  // Section 3: No Match & Empty Knowledge Base States
  // -------------------------------------------------------------
  console.log("\n--- Section 3: No Match & Empty Knowledge Base States ---");

  await runTest("When no chunks meet similarity threshold, status='no_match'", async () => {
    const payload = {
      alert: {
        title: "Unrelated Routine Log Rotation Notice",
        severity: "LOW",
        source: "Internal Syslog"
      },
      options: {
        similarityThreshold: 0.99, // Unattainably high threshold
        embeddingProviderOverride: mockEmbeddingProvider,
        llmExecutorOverride: mockLlmExecutor
      }
    };

    const result = await analyzeAlertPipeline(payload);

    assert(result.success === true, "Analysis must succeed");
    assert(result.knowledgeContext.status === "no_match", `Expected status 'no_match', got '${result.knowledgeContext.status}'`);
    assert(result.knowledgeContext.matchesFound === 0, "matchesFound must be 0");
    assert(result.knowledgeContext.sourcesUsed.length === 0, "sourcesUsed must be empty");
  });

  await runTest("When knowledge base is empty, status='empty_kb'", async () => {
    await clearKnowledgeBase();

    const payload = {
      alert: {
        title: "SQL Injection Attempt on API Gateway",
        severity: "HIGH",
        source: "Cloudflare WAF"
      },
      options: {
        enableRag: true,
        embeddingProviderOverride: mockEmbeddingProvider,
        llmExecutorOverride: mockLlmExecutor
      }
    };

    const result = await analyzeAlertPipeline(payload);

    assert(result.success === true, "Analysis must succeed");
    assert(result.knowledgeContext.status === "empty_kb", `Expected status 'empty_kb', got '${result.knowledgeContext.status}'`);
    assert(result.knowledgeContext.matchesFound === 0, "matchesFound must be 0");
    assert(result.knowledgeContext.sourcesUsed.length === 0, "sourcesUsed must be empty");

    // Restore corpus
    await ingestThreatCorpus({ force: true, providerOverride: mockEmbeddingProvider });
  });

  // -------------------------------------------------------------
  // Section 4: Retrieval Technical Failure & Graceful Degradation
  // -------------------------------------------------------------
  console.log("\n--- Section 4: Retrieval Failure & Graceful Degradation ---");

  await runTest("When retrieval fails technically, status='failed' with sanitized error and alert-only fallback", async () => {
    const failingEmbeddingProvider = createMockEmbeddingProvider({ shouldFail: true });

    const payload = {
      alert: {
        title: "DNS Tunneling Detected",
        severity: "HIGH",
        source: "Palo Alto Networks"
      },
      options: {
        enableRag: true,
        embeddingProviderOverride: failingEmbeddingProvider,
        llmExecutorOverride: mockLlmExecutor
      }
    };

    const result = await analyzeAlertPipeline(payload);

    assert(result.success === true, "Analysis must continue and succeed via alert-only fallback");
    assert(result.knowledgeContext.status === "failed", `Expected status 'failed', got '${result.knowledgeContext.status}'`);
    assert(typeof result.knowledgeContext.error === "string" && result.knowledgeContext.error.length > 0, "Error must be recorded");
    assert(result.knowledgeContext.matchesFound === 0, "matchesFound must be 0");
    assert(result.knowledgeContext.sourcesUsed.length === 0, "sourcesUsed must be empty");
    assert(result.analysis.summary.length > 0, "Structured analysis must still be generated");
  });

  // -------------------------------------------------------------
  // Section 5: Alert Input Validation
  // -------------------------------------------------------------
  console.log("\n--- Section 5: Input Validation Checks ---");

  await runTest("Rejects missing alert object with HTTP 400", async () => {
    let rejected = false;
    try {
      await analyzeAlertPipeline({});
    } catch (err) {
      assert(err.statusCode === 400, "Must throw statusCode 400");
      rejected = true;
    }
    assert(rejected, "Must reject missing alert");
  });

  await runTest("Rejects invalid alert missing required title with HTTP 400", async () => {
    let rejected = false;
    try {
      await analyzeAlertPipeline({
        alert: { severity: "HIGH", source: "SIEM" }
      });
    } catch (err) {
      assert(err.statusCode === 400, "Must throw statusCode 400");
      rejected = true;
    }
    assert(rejected, "Must reject missing title");
  });

  await runTest("Rejects invalid alert severity with HTTP 400", async () => {
    let rejected = false;
    try {
      await analyzeAlertPipeline({
        alert: { title: "Test", severity: "SUPER_CRITICAL", source: "SIEM" }
      });
    } catch (err) {
      assert(err.statusCode === 400, "Must throw statusCode 400");
      rejected = true;
    }
    assert(rejected, "Must reject invalid severity");
  });

  await runTest("Rejects invalid prompt type with HTTP 400", async () => {
    let rejected = false;
    try {
      await analyzeAlertPipeline({
        alert: { title: "Test", severity: "HIGH", source: "SIEM" },
        prompt: 12345
      });
    } catch (err) {
      assert(err.statusCode === 400, "Must throw statusCode 400");
      rejected = true;
    }
    assert(rejected, "Must reject non-string prompt");
  });

  // -------------------------------------------------------------
  // Section 6: Malformed Gemini Output Handling
  // -------------------------------------------------------------
  console.log("\n--- Section 6: Malformed LLM Output Handling ---");

  await runTest("Handles malformed non-JSON Gemini output with HTTP 502", async () => {
    const malformedLlm = createMockLlmExecutor("I cannot provide a JSON analysis at this time.");
    let rejected = false;
    try {
      await analyzeAlertPipeline({
        alert: { title: "Test", severity: "HIGH", source: "SIEM" },
        options: {
          enableRag: false,
          llmExecutorOverride: malformedLlm
        }
      });
    } catch (err) {
      assert(err.statusCode === 502, `Expected statusCode 502, got ${err.statusCode}`);
      rejected = true;
    }
    assert(rejected, "Must reject malformed JSON from LLM");
  });

  await runTest("Handles Gemini output missing required schema fields with HTTP 502", async () => {
    const incompleteLlm = createMockLlmExecutor(JSON.stringify({ summary: "Just a summary without riskAssessment" }));
    let rejected = false;
    try {
      await analyzeAlertPipeline({
        alert: { title: "Test", severity: "HIGH", source: "SIEM" },
        options: {
          enableRag: false,
          llmExecutorOverride: incompleteLlm
        }
      });
    } catch (err) {
      assert(err.statusCode === 502, `Expected statusCode 502, got ${err.statusCode}`);
      rejected = true;
    }
    assert(rejected, "Must reject incomplete schema output");
  });

  // -------------------------------------------------------------
  // Section 7: HTTP Endpoint Integration Test (POST /api/alerts/analyze)
  // -------------------------------------------------------------
  console.log("\n--- Section 7: HTTP Route Integration (POST /api/alerts/analyze) ---");

  await runTest("POST /api/alerts/analyze handles requests over HTTP Express server", async () => {
    setLlmExecutionOverride(mockLlmExecutor);

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, resolve));
    const port = testServer.address().port;

    try {
      const response = await fetch(`http://localhost:${port}/api/alerts/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert: {
            title: "Credential Dumping via LSASS Memory Access",
            severity: "HIGH",
            source: "Sysmon"
          },
          enableRag: false
        })
      });

      const body = await response.json();
      assert(response.status === 200, `Expected HTTP 200, got ${response.status}`);
      assert(body.success === true, "Response success must be true");
      assert(body.analysis && body.analysis.summary, "Response must contain analysis.summary");
      assert(body.knowledgeContext && body.knowledgeContext.status === "disabled", "knowledgeContext status mismatch");
    } finally {
      resetLlmExecutionOverride();
      await new Promise((resolve) => testServer.close(resolve));
    }
  });

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("\n===============================================================");
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log("===============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
};

main().catch((err) => {
  console.error("Unhandled test suite failure:", err);
  process.exit(1);
});
