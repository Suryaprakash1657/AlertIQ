/**
 * Module 3.20 Automated Test Suite: Semantic Knowledge Retrieval & RAG Context Assembly
 *
 * Deterministic, provider-independent verification suite testing:
 * 1. Vector mathematics (cosine similarity, dot product, magnitude, edge cases)
 * 2. Query embedding generation (taskType: RETRIEVAL_QUERY, dimensions, validation)
 * 3. Semantic similarity retrieval (ranking, Top-K, threshold filtering, status checks)
 * 4. RAG context construction (Markdown formatting, whole-chunk budget limits, source attribution)
 * 5. Alert query extraction (high-signal extraction, bounded evidence)
 * 6. Structured analysis integration with RAG & graceful degradation states
 * 7. POST /api/knowledge/search endpoint
 * 8. Error sanitization & secret protection
 * 9. Full backward compatibility with Modules 3.16–3.19
 */

import app from "../src/app.js";
import { config } from "../src/config/env.js";
import {
  generateQueryEmbedding,
  generateEmbedding,
  setEmbeddingProviderOverride,
  resetEmbeddingProviderOverride,
  sanitizeErrorMessage
} from "../src/services/embedding.service.js";
import {
  isValidVector,
  dotProduct,
  vectorMagnitude,
  cosineSimilarity
} from "../src/utils/vector.utils.js";
import { retrieveKnowledge } from "../src/services/retrieval.service.js";
import {
  constructRetrievalQueryFromAlert,
  buildRagContext
} from "../src/utils/rag.utils.js";
import {
  createKnowledgeDocument,
  clearKnowledgeBase
} from "../src/services/knowledge.service.js";
import { useInMemoryRepository } from "../src/repositories/knowledge.repository.js";
import { closePool } from "../src/config/db.js";

// Helper to create deterministic normalized mock vectors with keyword affinity
const createDeterministicVector = (text = "", dimensions = config.embeddingDimensions || 768) => {
  const vector = new Array(dimensions).fill(0);
  const lower = String(text).toLowerCase();

  // Create characteristic basis patterns for specific security concepts
  let conceptBase = 0;
  if (lower.includes("ransomware") || lower.includes("encryption") || lower.includes("vssadmin")) {
    conceptBase = 1;
  } else if (lower.includes("powershell") || lower.includes("script") || lower.includes("execution")) {
    conceptBase = 2;
  } else if (lower.includes("brute") || lower.includes("ssh") || lower.includes("password")) {
    conceptBase = 3;
  } else if (lower.includes("dns") || lower.includes("tunnel") || lower.includes("exfiltration")) {
    conceptBase = 4;
  } else {
    conceptBase = (text.length % 10) + 5;
  }

  for (let i = 0; i < dimensions; i++) {
    const val = Math.sin((conceptBase * 100 + i) * 0.1);
    vector[i] = parseFloat(val.toFixed(6));
  }

  // Normalize to unit vector
  const mag = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (mag > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = parseFloat((vector[i] / mag).toFixed(6));
    }
  }

  return vector;
};

// Deterministic mock provider that creates keyword-correlated embeddings
const mockSemanticProvider = async (text, options = {}) => {
  const dims = options.outputDimensionality || config.embeddingDimensions || 768;
  return {
    model: config.geminiEmbeddingModel || "gemini-embedding-2",
    dimensions: dims,
    vector: createDeterministicVector(text, dims),
    generatedAt: new Date().toISOString()
  };
};

async function runTests() {
  useInMemoryRepository();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}/api/knowledge`;
  const llmUrl = `http://localhost:${port}/api/llm`;

  console.log(`\n======================================================`);
  console.log(`Starting Module 3.20 Semantic Retrieval & RAG Test Suite`);
  console.log(`Base URL: ${baseUrl}`);
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

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  setEmbeddingProviderOverride(mockSemanticProvider);
  await clearKnowledgeBase();

  try {
    // ----------------------------------------------------
    // Section 1: Vector Mathematics Utility
    // ----------------------------------------------------
    console.log("--- Section 1: Vector Mathematics Utilities ---");
    const dims = config.embeddingDimensions || 768;

    const vecA = new Array(dims).fill(0);
    vecA[0] = 1.0; // Unit vector [1, 0, 0, ...]
    const vecB = new Array(dims).fill(0);
    vecB[0] = 1.0; // Identical unit vector
    const vecC = new Array(dims).fill(0);
    vecC[1] = 1.0; // Orthogonal unit vector [0, 1, 0, ...]
    const vecD = new Array(dims).fill(0);
    vecD[0] = -1.0; // Opposite unit vector [-1, 0, 0, ...]
    const zeroVec = new Array(dims).fill(0);

    assert(isValidVector(vecA, dims) === true, "isValidVector validates valid vector");
    assert(isValidVector([1, 2, 3], dims) === false, "isValidVector rejects dimension mismatch");
    assert(isValidVector("not_an_array", dims) === false, "isValidVector rejects non-array");
    assert(isValidVector([1, NaN, 3], 3) === false, "isValidVector rejects NaN values");

    const simIdentical = cosineSimilarity(vecA, vecB);
    assert(Math.abs(simIdentical - 1.0) < 1e-5, `Identical vectors have cosine similarity ≈ 1.0 (got ${simIdentical})`);

    const simOrthogonal = cosineSimilarity(vecA, vecC);
    assert(Math.abs(simOrthogonal - 0.0) < 1e-5, `Orthogonal vectors have cosine similarity ≈ 0.0 (got ${simOrthogonal})`);

    const simOpposite = cosineSimilarity(vecA, vecD);
    assert(Math.abs(simOpposite - -1.0) < 1e-5, `Opposite vectors have cosine similarity ≈ -1.0 (got ${simOpposite})`);

    const simZero = cosineSimilarity(vecA, zeroVec);
    assert(simZero === 0, `Zero-magnitude vector safely yields 0.0 (got ${simZero})`);

    const simMismatch = cosineSimilarity(vecA, [1, 2, 3]);
    assert(simMismatch === 0, `Mismatched dimensions safely yield 0.0 (got ${simMismatch})`);

    // ----------------------------------------------------
    // Section 2: Query Embedding Generation
    // ----------------------------------------------------
    console.log("\n--- Section 2: Query Embedding Generation ---");
    const queryResult = await generateQueryEmbedding("Investigate suspicious ransomware execution on host");
    assert(queryResult.dimensions === dims, `Query embedding dimension is ${queryResult.dimensions} (expected ${dims})`);
    assert(Array.isArray(queryResult.vector), "Query vector is an array");
    assert(queryResult.model === (config.geminiEmbeddingModel || "gemini-embedding-2"), "Query model matches configuration");

    let emptyQueryCaught = false;
    try {
      await generateQueryEmbedding("");
    } catch (err) {
      emptyQueryCaught = true;
      assert(err.statusCode === 400, "Empty query rejected with HTTP 400");
    }
    assert(emptyQueryCaught, "Empty query throws error");

    let whitespaceQueryCaught = false;
    try {
      await generateQueryEmbedding("   \t  ");
    } catch (err) {
      whitespaceQueryCaught = true;
      assert(err.statusCode === 400, "Whitespace query rejected with HTTP 400");
    }
    assert(whitespaceQueryCaught, "Whitespace query throws error");

    // ----------------------------------------------------
    // Section 3: Semantic Knowledge Retrieval Pipeline
    // ----------------------------------------------------
    console.log("\n--- Section 3: Semantic Retrieval Pipeline ---");
    // Ingest 3 distinct knowledge documents
    const doc1 = await createKnowledgeDocument({
      title: "Playbook - Ransomware Isolation Procedures",
      content:
        "1. Detection: Detect unauthorized file encryption and vssadmin delete shadows commands.\n" +
        "2. Containment: Disconnect network adapters immediately. Disable affected Active Directory accounts.\n" +
        "3. Eradication: Re-image compromised host from clean golden image.",
      source: "SOC Runbook IR-088",
      metadata: { category: "Ransomware", severity: "CRITICAL" }
    });

    const doc2 = await createKnowledgeDocument({
      title: "Playbook - Suspicious PowerShell Script Execution",
      content:
        "1. Detection: Monitor Event ID 4104 for encoded PowerShell download cradles.\n" +
        "2. Analysis: Extract base64 payload and check command line arguments.\n" +
        "3. Remediation: Terminate active PowerShell process IDs via EDR console.",
      source: "SOC Runbook IR-042",
      metadata: { category: "Execution", severity: "HIGH" }
    });

    const doc3 = await createKnowledgeDocument({
      title: "Guide - DNS Tunneling Detection",
      content:
        "1. Detection: Look for high-entropy subdomains and unusual TXT queries.\n" +
        "2. Remediation: Sinkhole malicious external domain on corporate DNS resolver.",
      source: "SOC Threat Intel",
      metadata: { category: "Exfiltration", severity: "MEDIUM" }
    });

    assert(Boolean(doc1.document.id) && Boolean(doc2.document.id) && Boolean(doc3.document.id), "Ingested 3 test documents");

    // Test retrieval for ransomware query
    const retrievalRansomware = await retrieveKnowledge("Ransomware unauthorized file encryption and vssadmin containment", {
      topK: 5,
      similarityThreshold: 0.5
    });

    assert(retrievalRansomware.totalIndexedChunks >= 3, `Total indexed chunks indexed >= 3 (got ${retrievalRansomware.totalIndexedChunks})`);
    assert(retrievalRansomware.matchedCount >= 1, `Matched count >= 1 (got ${retrievalRansomware.matchedCount})`);

    const topResult = retrievalRansomware.results[0];
    assert(topResult.metadata.documentTitle.includes("Ransomware"), `Top result is Ransomware playbook (got '${topResult.metadata.documentTitle}')`);
    assert(topResult.similarity >= 0.5, `Top similarity ${topResult.similarity} is >= threshold 0.5`);
    assert(topResult.vector === undefined, "Retrieval results do NOT expose raw float vectors");

    // Test descending sort order
    let isSorted = true;
    for (let i = 1; i < retrievalRansomware.results.length; i++) {
      if (retrievalRansomware.results[i].similarity > retrievalRansomware.results[i - 1].similarity) {
        isSorted = false;
        break;
      }
    }
    assert(isSorted, "Retrieval results are strictly sorted descending by similarity score");

    // Test Top-K capping
    const topK1Result = await retrieveKnowledge("Ransomware file encryption", { topK: 1, similarityThreshold: 0.1 });
    assert(topK1Result.results.length === 1, `Top-K=1 limits results to exactly 1 (got ${topK1Result.results.length})`);

    // Test high similarity threshold filtering out all results
    const highThresholdResult = await retrieveKnowledge("Completely unrelated query about baking bread", {
      similarityThreshold: 0.99
    });
    assert(highThresholdResult.matchedCount === 0, `High threshold (0.99) yields 0 matches for unrelated query (got ${highThresholdResult.matchedCount})`);

    // ----------------------------------------------------
    // Section 4: RAG Context Assembly
    // ----------------------------------------------------
    console.log("\n--- Section 4: RAG Context Assembly ---");
    const { ragContextText, sourcesUsed } = buildRagContext(retrievalRansomware.results, { maxChars: 5000 });
    assert(typeof ragContextText === "string" && ragContextText.length > 0, "buildRagContext generated non-empty context string");
    assert(ragContextText.includes("RETRIEVED KNOWLEDGE BASE RUNBOOKS"), "Context contains bounded reference header");
    assert(ragContextText.includes("Playbook - Ransomware Isolation"), "Context includes document title");
    assert(sourcesUsed.length > 0, `sourcesUsed contains ${sourcesUsed.length} cited source records`);
    assert(Boolean(sourcesUsed[0].chunkId) && Boolean(sourcesUsed[0].documentId), "Source records contain chunkId and documentId");

    // Empty retrieval produces empty context string
    const emptyRag = buildRagContext([]);
    assert(emptyRag.ragContextText === "" && emptyRag.sourcesUsed.length === 0, "Empty retrieval yields empty RAG context safely");

    // ----------------------------------------------------
    // Section 5: Alert Retrieval Query Construction
    // ----------------------------------------------------
    console.log("\n--- Section 5: Alert-Derived Retrieval Query Construction ---");
    const sampleAlert = {
      title: "Potential Ransomware Activity Detected",
      severity: "CRITICAL",
      source: "CrowdStrike Falcon EDR",
      description: "Multiple files encrypted with .lock extension and shadow copies deleted via vssadmin.",
      rawLogs: "vssadmin.exe delete shadows /all /quiet\ncmd.exe /c del /f /q C:\\*.backup"
    };

    const alertQuery = constructRetrievalQueryFromAlert(sampleAlert);
    assert(alertQuery.includes("[CRITICAL]"), "Query includes severity prefix");
    assert(alertQuery.includes("Potential Ransomware Activity"), "Query includes alert title");
    assert(alertQuery.includes("vssadmin.exe delete shadows"), "Query incorporates bounded evidence excerpt");
    assert(alertQuery.length <= 1000, `Query length is bounded <= 1000 characters (got ${alertQuery.length})`);

    // ----------------------------------------------------
    // Section 6: Structured Analysis Integration & RAG Execution
    // ----------------------------------------------------
    console.log("\n--- Section 6: Structured Analysis Integration (POST /api/llm/analyze) ---");

    // 6a: Analyze alert with RAG enabled (default)
    const analyzeWithRagRes = await post(`${llmUrl}/analyze`, {
      alert: sampleAlert
    });
    if (analyzeWithRagRes.status === 429) {
      console.log("  ⚠ Gemini API rate limit hit (429) on /api/llm/analyze, verifying error handling");
      assert(analyzeWithRagRes.data.success === false, "429 response handled gracefully");
    } else {
      assert(analyzeWithRagRes.status === 200, `POST /api/llm/analyze returned HTTP ${analyzeWithRagRes.status}`);
      assert(analyzeWithRagRes.data.success === true, "Analysis success is true");
      assert(Boolean(analyzeWithRagRes.data.analysis), "Analysis object present");
      assert(Boolean(analyzeWithRagRes.data.retrieval), "Retrieval metadata object present in response");
      assert(analyzeWithRagRes.data.retrieval.status === "success", "Retrieval status is 'success'");
      assert(analyzeWithRagRes.data.retrieval.matchesFound >= 1, `Matches found >= 1 (got ${analyzeWithRagRes.data.retrieval.matchesFound})`);
      assert(Array.isArray(analyzeWithRagRes.data.retrieval.sourcesUsed), "sourcesUsed is an array");
    }

    // 6b: Analyze alert with RAG explicitly disabled (enableRag: false)
    await new Promise((r) => setTimeout(r, 1000));
    const analyzeNoRagRes = await post(`${llmUrl}/analyze`, {
      alert: sampleAlert,
      enableRag: false
    });
    if (analyzeNoRagRes.status === 429) {
      console.log("  ⚠ Gemini API rate limit hit (429), verifying error shape");
      assert(analyzeNoRagRes.data.success === false, "429 response handled gracefully");
    } else {
      assert(analyzeNoRagRes.status === 200, `POST /api/llm/analyze with enableRag: false returned HTTP ${analyzeNoRagRes.status}`);
      assert(analyzeNoRagRes.data?.retrieval?.status === "disabled", "Retrieval status is 'disabled' when enableRag is false");
      assert(analyzeNoRagRes.data?.retrieval?.matchesFound === 0, "Matches found is 0 when RAG disabled");
      assert(analyzeNoRagRes.data?.retrieval?.sourcesUsed?.length === 0, "sourcesUsed is empty when RAG disabled");
    }

    // ----------------------------------------------------
    // Section 7: Knowledge Search Endpoint (POST /api/knowledge/search)
    // ----------------------------------------------------
    console.log("\n--- Section 7: Knowledge Search Endpoint (POST /api/knowledge/search) ---");
    const searchRes = await post(`${baseUrl}/search`, {
      query: "PowerShell encoded download cradle",
      topK: 3,
      similarityThreshold: 0.4
    });

    assert(searchRes.status === 200, `POST /api/knowledge/search returned HTTP ${searchRes.status}`);
    assert(searchRes.data.success === true, "Search endpoint success is true");
    assert(searchRes.data.matchedCount >= 1, `Search matchedCount >= 1 (got ${searchRes.data.matchedCount})`);
    assert(searchRes.data.results[0].metadata.documentTitle.includes("PowerShell"), "Top search result is PowerShell playbook");

    // Invalid search request (empty query)
    const invalidSearchRes = await post(`${baseUrl}/search`, { query: "" });
    assert(invalidSearchRes.status === 400, `Empty search query rejected with HTTP 400 (got ${invalidSearchRes.status})`);

    // ----------------------------------------------------
    // Section 8: Error Sanitization & Key Protection
    // ----------------------------------------------------
    console.log("\n--- Section 8: Error Sanitization & Key Protection ---");
    const sensitiveError =
      "Upstream error key=AIzaMockPlaceholderKey1234567890ABCDEF and bearer mock_sample_bearer_token_xyz";
    const sanitized = sanitizeErrorMessage(sensitiveError);
    assert(!sanitized.includes("AIzaMockPlaceholderKey"), "Scrubbed API key pattern");
    assert(!sanitized.includes("mock_sample_bearer_token_xyz"), "Scrubbed bearer token pattern");
    assert(sanitized.includes("[REDACTED"), "Replaced with redacted marker");


    // ----------------------------------------------------
    // Section 9: Backward Compatibility Checks
    // ----------------------------------------------------
    console.log("\n--- Section 9: Backward Compatibility Checks ---");
    // 9a: LLM Test completion endpoint validation check
    const badTestRes = await post(`${llmUrl}/test`, {});
    assert(badTestRes.status === 400, "POST /api/llm/test rejects empty payload with HTTP 400");

    // 9b: Knowledge documents listing
    const docsListRes = await fetch(`${baseUrl}/documents`);
    const docsListData = await docsListRes.json();
    assert(docsListRes.status === 200, "GET /api/knowledge/documents returns HTTP 200");
    assert(docsListData.total >= 3, `GET /api/knowledge/documents reports total >= 3 (got ${docsListData.total})`);

    console.log("\n======================================================");
    console.log(`Module 3.20 Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
    console.log("======================================================\n");
  } finally {
    resetEmbeddingProviderOverride();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  }

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
