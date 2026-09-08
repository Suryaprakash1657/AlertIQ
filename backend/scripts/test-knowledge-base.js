/**
 * Module 3.18 Automated Verification Suite: Knowledge Base Backend Foundation
 *
 * Tests:
 * 1. Valid document ingestion and automatic chunking (POST /api/knowledge/documents)
 * 2. Missing title validation error (HTTP 400)
 * 3. Empty/whitespace-only title validation error (HTTP 400)
 * 4. Missing content validation error (HTTP 400)
 * 5. Empty/whitespace-only content validation error (HTTP 400)
 * 6. Non-object metadata validation error (HTTP 400)
 * 7. Invalid chunking configuration validation error (overlap >= chunkSize - HTTP 400)
 * 8. Long document chunking and metadata preservation
 * 9. Empty chunk filtering (no blank chunks generated)
 * 10. Listing documents lightweight summary (GET /api/knowledge/documents)
 * 11. Retrieving document by ID with full chunks (GET /api/knowledge/documents/:id)
 * 12. Nonexistent document ID retrieval error (HTTP 404)
 * 13. Deleting a document and its chunks (DELETE /api/knowledge/documents/:id)
 * 14. Verification that deleted document cannot be retrieved (HTTP 404)
 * 15. Deleting nonexistent document error (HTTP 404)
 * 16. Backward compatibility: Existing LLM endpoints remain intact
 */

import app from "../src/app.js";
import { clearKnowledgeBase } from "../src/services/knowledge.service.js";
import { useInMemoryRepository } from "../src/repositories/knowledge.repository.js";
import { closePool } from "../src/config/db.js";

async function runTests() {
  useInMemoryRepository();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}/api/knowledge`;
  const llmUrl = `http://localhost:${port}/api/llm`;

  console.log(`\n======================================================`);
  console.log(`Starting Module 3.18 Knowledge Base Test Suite`);
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

  async function get(url) {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  async function del(url) {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
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

  // Clear repository before starting
  await clearKnowledgeBase();

  try {
    // ----------------------------------------------------
    // Test 1: Valid Document Creation with Default Chunking
    // ----------------------------------------------------
    console.log("Test 1: Ingesting valid security runbook document...");
    const validDocPayload = {
      title: "Playbook - PowerShell Execution Containment",
      content: `1. Overview: This runbook details immediate isolation and containment procedures for unauthorized PowerShell scripts.
2. Step 1: Immediately isolate host from corporate VLAN.
3. Step 2: Terminate active PowerShell process IDs via EDR console.
4. Step 3: Collect memory dump and analyze script block logging Event ID 4104.
5. Step 4: Check registry Run keys and Scheduled Tasks for persistence.`,
      source: "SOC Incident Runbook IR-042",
      metadata: {
        category: "Containment",
        severity: "HIGH",
        author: "SOC Team",
        tactics: ["Execution", "Persistence"]
      }
    };

    const res1 = await post(`${baseUrl}/documents`, validDocPayload);
    assert(res1.status === 201, `Status code is 201 Created (got ${res1.status})`);
    assert(res1.data.success === true, "Response reports success: true");
    assert(res1.data.document && typeof res1.data.document.id === "string", "Document has valid generated ID");
    assert(res1.data.document.title === validDocPayload.title, "Document title matches");
    assert(res1.data.document.source === validDocPayload.source, "Document source matches");
    assert(res1.data.document.metadata.category === "Containment", "Document metadata preserved");
    assert(res1.data.document.createdAt && res1.data.document.updatedAt, "Timestamps generated");
    assert(Array.isArray(res1.data.chunks) && res1.data.chunks.length > 0, "Chunks array generated");
    assert(res1.data.chunkCount === res1.data.chunks.length, "chunkCount matches chunks array length");

    const createdDocId = res1.data.document.id;

    // ----------------------------------------------------
    // Test 2: Missing Title Validation
    // ----------------------------------------------------
    console.log("\nTest 2: Validation check - Missing title...");
    const missingTitlePayload = {
      content: "This document is missing a title."
    };
    const res2 = await post(`${baseUrl}/documents`, missingTitlePayload);
    assert(res2.status === 400, `Returns HTTP 400 Bad Request for missing title (got ${res2.status})`);
    assert(res2.data.success === false, "Response reports success: false");
    assert(res2.data.error.toLowerCase().includes("title"), `Error message explains title issue: "${res2.data.error}"`);

    // ----------------------------------------------------
    // Test 3: Empty / Whitespace-only Title Validation
    // ----------------------------------------------------
    console.log("\nTest 3: Validation check - Empty title...");
    const emptyTitlePayload = {
      title: "    ",
      content: "Valid content here."
    };
    const res3 = await post(`${baseUrl}/documents`, emptyTitlePayload);
    assert(res3.status === 400, `Returns HTTP 400 Bad Request for whitespace title (got ${res3.status})`);
    assert(res3.data.success === false, "Response reports success: false");

    // ----------------------------------------------------
    // Test 4: Missing Content Validation
    // ----------------------------------------------------
    console.log("\nTest 4: Validation check - Missing content...");
    const missingContentPayload = {
      title: "Document Without Content"
    };
    const res4 = await post(`${baseUrl}/documents`, missingContentPayload);
    assert(res4.status === 400, `Returns HTTP 400 Bad Request for missing content (got ${res4.status})`);
    assert(res4.data.success === false, "Response reports success: false");
    assert(res4.data.error.toLowerCase().includes("content"), `Error message explains content issue: "${res4.data.error}"`);

    // ----------------------------------------------------
    // Test 5: Empty Content Validation
    // ----------------------------------------------------
    console.log("\nTest 5: Validation check - Whitespace content...");
    const emptyContentPayload = {
      title: "Document With Empty Content",
      content: "      \n\n   "
    };
    const res5 = await post(`${baseUrl}/documents`, emptyContentPayload);
    assert(res5.status === 400, `Returns HTTP 400 Bad Request for whitespace content (got ${res5.status})`);
    assert(res5.data.success === false, "Response reports success: false");

    // ----------------------------------------------------
    // Test 6: Invalid Metadata Type Validation
    // ----------------------------------------------------
    console.log("\nTest 6: Validation check - Invalid non-object metadata...");
    const invalidMetadataPayload = {
      title: "Document with bad metadata",
      content: "Some valid content text here.",
      metadata: "not-an-object"
    };
    const res6 = await post(`${baseUrl}/documents`, invalidMetadataPayload);
    assert(res6.status === 400, `Returns HTTP 400 Bad Request for string metadata (got ${res6.status})`);
    assert(res6.data.success === false, "Response reports success: false");

    // ----------------------------------------------------
    // Test 7: Invalid Chunking Configuration (overlap >= chunkSize)
    // ----------------------------------------------------
    console.log("\nTest 7: Validation check - Invalid chunking options (overlap >= chunkSize)...");
    const badChunkConfigPayload = {
      title: "Bad chunk config document",
      content: "Testing invalid chunking constraints.",
      chunkSize: 100,
      overlap: 150
    };
    const res7 = await post(`${baseUrl}/documents`, badChunkConfigPayload);
    assert(res7.status === 400, `Returns HTTP 400 Bad Request for overlap >= chunkSize (got ${res7.status})`);
    assert(res7.data.success === false, "Response reports success: false");

    // ----------------------------------------------------
    // Test 8: Long Document Ingestion and Chunking
    // ----------------------------------------------------
    console.log("\nTest 8: Ingesting large document with custom chunking parameters...");
    const paragraphs = [
      "SECTION 1: THREAT INTELLIGENCE SUMMARY. Adversaries actively exploiting CVE-2026-1337 via weaponized PDF attachments containing embedded malicious macros. Once opened, the document attempts DLL side-loading against legitimate system binaries.",
      "SECTION 2: DETECTION ENGINEERING. Analysts should configure SIEM detection rules targeting abnormal parent-child relationships where AcroRd32.exe spawns cmd.exe or powershell.exe with encoded command flags (-enc, -w hidden).",
      "SECTION 3: NETWORK IOCS. Outbound network connections to known C2 infrastructure 198.51.100.44:8443 or malicious dynamic DNS domains ending in .top should be blocked immediately at perimeter firewalls.",
      "SECTION 4: FORENSIC INVESTIGATION. Collect volatile memory with WinPmem. Extract MFT records to identify timestamps of dropped secondary payloads in C:\\Users\\Public or C:\\ProgramData directories.",
      "SECTION 5: REMEDIATION AND PATCHING. Ensure all endpoints apply security update KB992817. Enforce Microsoft Attack Surface Reduction (ASR) rules to block Office applications from creating child processes."
    ];
    const longContent = paragraphs.join("\n\n");

    const customChunkDocPayload = {
      title: "Threat Advisory - CVE-2026-1337 Exploitation Campaign",
      content: longContent,
      source: "CISA Cybersecurity Advisory AA26-042A",
      metadata: {
        cve: "CVE-2026-1337",
        tlp: "AMBER",
        priority: "CRITICAL"
      },
      chunkSize: 350,
      overlap: 75
    };

    const res8 = await post(`${baseUrl}/documents`, customChunkDocPayload);
    assert(res8.status === 201, `Status code is 201 Created (got ${res8.status})`);
    assert(res8.data.chunks.length >= 3, `Document cleanly split into multiple chunks (got ${res8.data.chunks.length})`);
    assert(res8.data.chunkCount === res8.data.chunks.length, "chunkCount field matches chunk array length");

    // Verify chunk schema & metadata
    const firstChunk = res8.data.chunks[0];
    assert(firstChunk.id.startsWith(res8.data.document.id), `Chunk ID is namespaced to document: ${firstChunk.id}`);
    assert(firstChunk.documentId === res8.data.document.id, "Chunk documentId matches parent");
    assert(firstChunk.chunkIndex === 0, "First chunkIndex is 0");
    assert(firstChunk.totalChunks === res8.data.chunks.length, "totalChunks matches actual total");
    assert(firstChunk.metadata.documentTitle === customChunkDocPayload.title, "Chunk preserves document title");
    assert(firstChunk.metadata.source === customChunkDocPayload.source, "Chunk preserves source");
    assert(firstChunk.metadata.cve === "CVE-2026-1337", "Chunk preserves custom metadata");
    assert(typeof firstChunk.charCount === "number" && firstChunk.charCount > 0, "charCount is valid");
    assert(typeof firstChunk.tokenEstimate === "number" && firstChunk.tokenEstimate > 0, "tokenEstimate is valid");

    // ----------------------------------------------------
    // Test 9: No Empty Chunks Generated
    // ----------------------------------------------------
    console.log("\nTest 9: Verifying no empty or whitespace-only chunks...");
    const hasEmptyChunks = res8.data.chunks.some((chk) => !chk.content || chk.content.trim().length === 0);
    assert(!hasEmptyChunks, "All generated chunks have non-empty content");

    // ----------------------------------------------------
    // Test 10: Listing Ingested Documents
    // ----------------------------------------------------
    console.log("\nTest 10: Listing knowledge documents (GET /api/knowledge/documents)...");
    const res10 = await get(`${baseUrl}/documents`);
    assert(res10.status === 200, `Status code is 200 OK (got ${res10.status})`);
    assert(res10.data.success === true, "Response reports success: true");
    assert(res10.data.total >= 2, `Total documents listed >= 2 (got ${res10.data.total})`);
    assert(Array.isArray(res10.data.documents), "Documents field is an array");

    // Verify listing is lightweight (chunks array omitted from list items)
    const listedDoc = res10.data.documents[0];
    assert(listedDoc.id && listedDoc.title, "List item includes id and title");
    assert(typeof listedDoc.chunkCount === "number", "List item includes chunkCount");
    assert(listedDoc.chunks === undefined, "List item omits heavy chunks array for performance");

    // ----------------------------------------------------
    // Test 11: Retrieving Document by ID
    // ----------------------------------------------------
    console.log("\nTest 11: Retrieving single document by ID (GET /api/knowledge/documents/:id)...");
    const res11 = await get(`${baseUrl}/documents/${createdDocId}`);
    assert(res11.status === 200, `Status code is 200 OK (got ${res11.status})`);
    assert(res11.data.success === true, "Response reports success: true");
    assert(res11.data.document.id === createdDocId, "Retrieved document ID matches requested ID");
    assert(Array.isArray(res11.data.document.chunks), "Retrieved document contains full chunks array");
    assert(res11.data.document.chunks.length > 0, "Retrieved chunks are populated");

    // ----------------------------------------------------
    // Test 12: Retrieving Nonexistent Document
    // ----------------------------------------------------
    console.log("\nTest 12: Retrieving nonexistent document ID...");
    const res12 = await get(`${baseUrl}/documents/non_existent_doc_id_9999`);
    assert(res12.status === 404, `Returns HTTP 404 Not Found (got ${res12.status})`);
    assert(res12.data.success === false, "Response reports success: false");

    // ----------------------------------------------------
    // Test 13: Deleting a Document
    // ----------------------------------------------------
    console.log("\nTest 13: Deleting document by ID (DELETE /api/knowledge/documents/:id)...");
    const res13 = await del(`${baseUrl}/documents/${createdDocId}`);
    assert(res13.status === 200, `Status code is 200 OK (got ${res13.status})`);
    assert(res13.data.success === true, "Response reports success: true");
    assert(res13.data.id === createdDocId, "Deleted ID returned in response");

    // ----------------------------------------------------
    // Test 14: Verifying Deleted Document Cannot Be Retrieved
    // ----------------------------------------------------
    console.log("\nTest 14: Verifying deleted document is gone...");
    const res14 = await get(`${baseUrl}/documents/${createdDocId}`);
    assert(res14.status === 404, `Deleted document returns HTTP 404 on subsequent GET (got ${res14.status})`);

    const res14List = await get(`${baseUrl}/documents`);
    const stillPresent = res14List.data.documents.some((d) => d.id === createdDocId);
    assert(!stillPresent, "Deleted document no longer appears in listing");

    // ----------------------------------------------------
    // Test 15: Deleting Nonexistent Document Error
    // ----------------------------------------------------
    console.log("\nTest 15: Deleting nonexistent document...");
    const res15 = await del(`${baseUrl}/documents/non_existent_doc_id_9999`);
    assert(res15.status === 404, `Returns HTTP 404 Not Found (got ${res15.status})`);
    assert(res15.data.success === false, "Response reports success: false");

    // ----------------------------------------------------
    // Test 16: Backward Compatibility with Existing LLM Endpoints
    // ----------------------------------------------------
    console.log("\nTest 16: Verifying backward compatibility of existing LLM endpoints...");
    // 16a. Validation on /api/llm/test (missing prompt -> 400)
    const res16a = await post(`${llmUrl}/test`, {});
    assert(res16a.status === 400, `/api/llm/test input validation intact (HTTP 400, got ${res16a.status})`);

    // 16b. Validation on /api/llm/analyze (missing alert -> 400)
    const res16b = await post(`${llmUrl}/analyze`, {});
    assert(res16b.status === 400, `/api/llm/analyze alert validation intact (HTTP 400, got ${res16b.status})`);

  } catch (err) {
    console.error(`\nUnexpected test failure: ${err.message}`);
    console.error(err.stack);
    failed++;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  }

  console.log(`\n======================================================`);
  console.log(`Module 3.18 Test Results:`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests();
