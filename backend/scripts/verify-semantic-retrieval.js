import http from "http";
import app from "../src/app.js";
import { retrieveKnowledge } from "../src/services/retrieval.service.js";
import { config } from "../src/config/env.js";
import { closePool } from "../src/config/db.js";

async function runSemanticVerification() {
  console.log("\n===============================================================");
  console.log("     AlertIQ Semantic Retrieval & Full Pipeline Verification    ");
  console.log("===============================================================\n");

  let server;
  try {
    // -------------------------------------------------------------
    // Test 1: Direct Semantic Retrieval via retrieveKnowledge
    // -------------------------------------------------------------
    console.log("--- 1. Direct Semantic Retrieval (Gemini Query -> pgvector) ---");
    
    // Query 1: SSH Brute Force
    const sshQuery = "multiple failed SSH login attempts from an external IP address";
    console.log(`\n[Test 1.1] Query: "${sshQuery}"`);
    const sshResult = await retrieveKnowledge(sshQuery, {
      similarityThreshold: config.similarityThreshold || 0.60,
      topK: 5
    });

    console.log(`Matched Chunks Count: ${sshResult.matchedCount}`);
    console.log(`Top Matched Chunks:`);
    sshResult.results.forEach((c, i) => {
      console.log(`  [${i + 1}] Doc: ${c.documentId} | Chunk ${c.chunkIndex} | Similarity: ${c.similarity} | Content Preview: ${c.content.slice(0, 60)}...`);
    });

    // Query 2: Ransomware Containment
    const ransomwareQuery = "ransomware incident response and containment";
    console.log(`\n[Test 1.2] Query: "${ransomwareQuery}"`);
    const rResult = await retrieveKnowledge(ransomwareQuery, {
      similarityThreshold: config.similarityThreshold || 0.60,
      topK: 5
    });

    console.log(`Matched Chunks Count: ${rResult.matchedCount}`);
    console.log(`Top Matched Chunks:`);
    rResult.results.forEach((c, i) => {
      console.log(`  [${i + 1}] Doc: ${c.documentId} | Chunk ${c.chunkIndex} | Similarity: ${c.similarity} | Content Preview: ${c.content.slice(0, 60)}...`);
    });

    // -------------------------------------------------------------
    // Test 2: HTTP API — POST /api/knowledge/search
    // -------------------------------------------------------------
    console.log("\n--- 2. HTTP Endpoint: POST /api/knowledge/search ---");
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const searchRes = await fetch(`${baseUrl}/api/knowledge/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "multiple failed SSH login attempts from an external IP address",
        topK: 5
      })
    });

    const searchData = await searchRes.json();
    console.log(`HTTP Status: ${searchRes.status}`);
    console.log(`API Response Success: ${searchData.success}`);
    console.log(`Matched Count: ${searchData.matchedCount}`);
    console.log(`Results:`);
    searchData.results?.forEach((r, i) => {
      console.log(`  [${i + 1}] Doc: ${r.documentId} | Chunk ${r.chunkIndex} | Similarity: ${r.similarity}`);
    });

    // -------------------------------------------------------------
    // Test 3: HTTP API — POST /api/alerts/analyze with RAG & Persistence
    // -------------------------------------------------------------
    console.log("\n--- 3. HTTP Endpoint: POST /api/alerts/analyze (Full RAG Pipeline) ---");
    const testAlert = {
      alertId: `ALT-VERIFY-${Date.now()}`,
      title: "Repeated SSH Authentication Failures",
      severity: "HIGH",
      source: "SIEM",
      timestamp: new Date().toISOString(),
      description: "Multiple failed SSH authentication attempts against a production Linux host from a single external source 203.0.113.50.",
      sourceIp: "203.0.113.50",
      destinationIp: "10.10.20.15",
      targetHost: "prod-linux-01",
      user: "root",
      evidence: [
        "50 failed SSH authentication attempts in 2 minutes on port 22",
        "Source IP 203.0.113.50 not in allowlist"
      ]
    };

    const analyzeRes = await fetch(`${baseUrl}/api/alerts/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alert: testAlert,
        enableRag: true
      })
    });

    const analyzeData = await analyzeRes.json();
    console.log(`Analyze HTTP Status: ${analyzeRes.status}`);
    console.log(`Pipeline Success: ${analyzeData.success}`);
    console.log(`Knowledge Context Status: ${analyzeData.knowledgeContext?.status}`);
    console.log(`Matches Found: ${analyzeData.knowledgeContext?.matchesFound}`);
    console.log(`Retrieved Sources:`, analyzeData.knowledgeContext?.sources?.map(s => `${s.documentId} (${s.similarity})`));
    console.log(`Persistence Status:`, analyzeData.persistence);
    console.log(`Analysis Summary:`, analyzeData.analysis?.summary);
    console.log(`Risk Assessment:`, analyzeData.analysis?.riskAssessment);

    console.log("\n===============================================================");
    console.log("              ALL VERIFICATIONS COMPLETED                      ");
    console.log("===============================================================\n");
  } catch (err) {
    console.error("Verification failed with error:", err);
  } finally {
    if (server) server.close();
    await closePool();
  }
}

runSemanticVerification();
