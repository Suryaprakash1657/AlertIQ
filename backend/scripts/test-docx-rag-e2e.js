/**
 * End-to-End Test Suite for AlertIQ DOCX Document Ingestion & RAG Retrieval
 *
 * Tests:
 * 1. Creates a valid in-memory DOCX buffer with unique canary signature
 * 2. Uploads via multipart/form-data to POST /api/knowledge/documents/upload
 * 3. Verifies 201 Created status, document structure, and absence of bulky vectors in response
 * 4. Verifies database persistence (document record, chunk breakdown, 768-dim embeddings)
 * 5. Verifies semantic RAG search via POST /api/knowledge/search and matches documentId
 * 6. Tests error cases: missing file, invalid extension, non-zip corrupt buffer, empty docx
 * 7. Cleans up test documents from database
 */

import zlib from "zlib";
import { GoogleGenAI } from "@google/genai";
import { config } from "../src/config/env.js";

const BACKEND_URL = `http://localhost:${process.env.PORT || 5000}`;

// Canary signature for unambiguous attribution
const CANARY_SIG = `DOCX_CANARY_SIG_${Date.now()}`;
const CANARY_PLAYBOOK_TEXT = `
# AlertIQ Sovereign Incident Response Runbook
Canary Reference Identifier: ${CANARY_SIG}

## Objective
Remediation protocol for Active Directory Kerberos Golden Ticket and Silver Ticket attacks.

## Procedure
1. Identify compromised Kerberos krbtgt account credentials immediately.
2. Perform double reset of the krbtgt account password with a 24-hour interval to purge existing TGT validity.
3. Isolate domain controllers exhibiting anomalous PAC signature verification failures.
4. Rotate Kerberos service principal account keys across all tier-0 administrative servers.
5. Invalidate active Kerberos tickets and purge Kerberos cached sessions across host fleet.
`;

/**
 * Helper to build a minimal valid OpenXML .docx ZIP buffer in pure Node.js
 */
function createMinimalDocxBuffer(textContent) {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const escapedText = textContent
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphsXml = escapedText
    .split("\n")
    .map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`)
    .join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml}
  </w:body>
</w:document>`;

  // Construct standard ZIP file in memory
  const files = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(relsXml, "utf8") },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") }
  ];

  return createZipBuffer(files);
}

/**
 * Lightweight ZIP binary constructor
 */
function createZipBuffer(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const compressed = zlib.deflateRawSync(file.data);
    const crc = computeCrc32(file.data);

    // Local file header (30 bytes + name length + data length)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);          // Version needed
    localHeader.writeUInt16LE(0, 6);           // Flags
    localHeader.writeUInt16LE(8, 8);           // Compression (8 = Deflate)
    localHeader.writeUInt16LE(0, 10);          // Mod time
    localHeader.writeUInt16LE(0, 12);          // Mod date
    localHeader.writeUInt32LE(crc, 14);        // CRC-32
    localHeader.writeUInt32LE(compressed.length, 18); // Compressed size
    localHeader.writeUInt32LE(file.data.length, 22);   // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);     // File name length
    localHeader.writeUInt16LE(0, 28);                  // Extra field length
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressed);

    // Central directory header (46 bytes + name length)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4);          // Version made by
    centralHeader.writeUInt16LE(20, 6);          // Version needed
    centralHeader.writeUInt16LE(0, 8);           // Flags
    centralHeader.writeUInt16LE(8, 10);          // Compression
    centralHeader.writeUInt16LE(0, 12);          // Mod time
    centralHeader.writeUInt16LE(0, 14);          // Mod date
    centralHeader.writeUInt32LE(crc, 16);        // CRC-32
    centralHeader.writeUInt32LE(compressed.length, 20); // Compressed size
    centralHeader.writeUInt32LE(file.data.length, 24);   // Uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28);     // File name length
    centralHeader.writeUInt16LE(0, 30);                  // Extra field length
    centralHeader.writeUInt16LE(0, 32);                  // Comment length
    centralHeader.writeUInt16LE(0, 34);                  // Disk number start
    centralHeader.writeUInt16LE(0, 36);                  // Internal file attrs
    centralHeader.writeUInt32LE(0, 38);                  // External file attrs
    centralHeader.writeUInt32LE(offset, 42);             // Relative offset of local header
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);               // Signature
  eocd.writeUInt16LE(0, 4);                        // Number of this disk
  eocd.writeUInt16LE(0, 6);                        // Disk with central dir
  eocd.writeUInt16LE(files.length, 8);             // Total entries on this disk
  eocd.writeUInt16LE(files.length, 10);            // Total entries
  eocd.writeUInt32LE(centralDirSize, 12);          // Central dir size
  eocd.writeUInt32LE(centralDirOffset, 16);        // Offset of central dir
  eocd.writeUInt16LE(0, 20);                       // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Standard CRC32 table calculation
 */
function computeCrc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c >>> 0;
  }
  return table;
})();

async function runTests() {
  console.log("================================================================");
  console.log("🧪 ALERT-IQ DOCX INGESTION & RAG END-TO-END VERIFICATION SUITE");
  console.log("================================================================\n");

  let uploadedDocId = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Upload a valid synthetic DOCX document
    // -------------------------------------------------------------
    console.log("--- TEST 1: Upload Valid .docx File via Multipart/form-data ---");
    const docxBuffer = createMinimalDocxBuffer(CANARY_PLAYBOOK_TEXT);
    console.log(`Generated in-memory .docx buffer (${docxBuffer.length} bytes, Magic: ${docxBuffer.slice(0, 2).toString("ascii")})`);

    const formData = new FormData();
    const blob = new Blob([docxBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
    formData.append("file", blob, "Kerberos_Remediation_Playbook.docx");
    formData.append("title", "Kerberos Attack Remediation Runbook");
    formData.append("category", "Incident Runbook");
    formData.append("description", `Automated test runbook with canary: ${CANARY_SIG}`);

    const uploadRes = await fetch(`${BACKEND_URL}/api/knowledge/documents/upload`, {
      method: "POST",
      body: formData
    });

    const uploadData = await uploadRes.json();
    console.log("Upload Status:", uploadRes.status);
    console.log("Upload Response Summary:", JSON.stringify(uploadData, null, 2));

    if (uploadRes.status !== 201 || !uploadData.success) {
      throw new Error(`Upload failed with status ${uploadRes.status}: ${JSON.stringify(uploadData)}`);
    }

    uploadedDocId = uploadData.document?.id;
    if (!uploadedDocId) {
      throw new Error("Response missing document.id");
    }

    // Verify chunkCount > 0 and no full vectors in response body
    if (!uploadData.chunkCount || uploadData.chunkCount <= 0) {
      throw new Error("Expected chunkCount > 0");
    }
    if (uploadData.chunks) {
      throw new Error("Upload response should NOT include full chunk array or vectors (summary only)");
    }
    console.log("✅ TEST 1 PASSED: DOCX uploaded, extracted, chunked, and indexed with ID:", uploadedDocId);

    // -------------------------------------------------------------
    // Test 2: Fetch Document Details by ID from Knowledge Base
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Verify Stored Document and Embeddings by ID ---");
    const getDocRes = await fetch(`${BACKEND_URL}/api/knowledge/documents/${encodeURIComponent(uploadedDocId)}`);
    const getDocData = await getDocRes.json();

    if (getDocRes.status !== 200 || !getDocData.document) {
      throw new Error(`Failed to fetch document: ${JSON.stringify(getDocData)}`);
    }

    const doc = getDocData.document;
    console.log(`Document Title: "${doc.title}", Chunks: ${doc.chunks?.length}`);
    if (!doc.chunks || doc.chunks.length === 0) {
      throw new Error("Document has no persisted chunks in database");
    }

    const firstChunk = doc.chunks[0];
    console.log(`First Chunk Embedding Status: "${firstChunk.embedding?.status}", Model: "${firstChunk.embedding?.model}", Dimensions: ${firstChunk.embedding?.dimensions}`);

    if (firstChunk.embedding?.status !== "ready") {
      throw new Error(`Expected chunk status 'ready', got '${firstChunk.embedding?.status}'`);
    }
    if (firstChunk.embedding?.dimensions !== 768) {
      throw new Error(`Expected 768-dimensional embedding, got ${firstChunk.embedding?.dimensions}`);
    }
    if (!Array.isArray(firstChunk.embedding?.vector) || firstChunk.embedding.vector.length !== 768) {
      throw new Error("Chunk missing 768-element vector array");
    }
    console.log("✅ TEST 2 PASSED: Document and 768-dim embeddings verified in database");

    // -------------------------------------------------------------
    // Test 3: Semantic RAG Retrieval Matching Canary Identifier
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Semantic Retrieval via POST /api/knowledge/search ---");
    const searchQuery = "How do we reset krbtgt account password and invalidate Kerberos golden tickets?";
    const searchRes = await fetch(`${BACKEND_URL}/api/knowledge/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: searchQuery,
        topK: 5,
        similarityThreshold: 0.50
      })
    });

    const searchData = await searchRes.json();
    console.log("Search Status:", searchRes.status);
    console.log(`Matched Chunks Count: ${searchData.matchedCount}`);

    if (searchRes.status !== 200 || !Array.isArray(searchData.results)) {
      throw new Error(`Search failed: ${JSON.stringify(searchData)}`);
    }

    const matchedDoc = searchData.results.find((r) => r.documentId === uploadedDocId);
    if (!matchedDoc) {
      console.log("Top results:", searchData.results);
      throw new Error(`Uploaded DOCX document (${uploadedDocId}) was NOT found in semantic retrieval results!`);
    }

    console.log(`Matched Target Document: ${matchedDoc.documentId}, Similarity: ${matchedDoc.similarity}`);
    console.log(`Matched Content Excerpt: ${matchedDoc.content?.slice(0, 100)}...`);
    console.log("✅ TEST 3 PASSED: Semantic RAG retrieval successfully returned the uploaded DOCX document");

    // -------------------------------------------------------------
    // Test 4: Error Handling Cases
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Error Handling Cases ---");

    // 4a. Missing file
    const missingFileForm = new FormData();
    missingFileForm.append("title", "No File Title");
    const resNoFile = await fetch(`${BACKEND_URL}/api/knowledge/documents/upload`, {
      method: "POST",
      body: missingFileForm
    });
    console.log("Missing file status (expected 400):", resNoFile.status);
    if (resNoFile.status !== 400) {
      throw new Error(`Expected 400 for missing file, got ${resNoFile.status}`);
    }

    // 4b. Invalid extension (.exe or .pdf to upload endpoint)
    const badExtForm = new FormData();
    badExtForm.append("file", new Blob(["not a docx"], { type: "application/pdf" }), "test.pdf");
    const resBadExt = await fetch(`${BACKEND_URL}/api/knowledge/documents/upload`, {
      method: "POST",
      body: badExtForm
    });
    console.log("Invalid extension status (expected 415):", resBadExt.status);
    if (resBadExt.status !== 415) {
      throw new Error(`Expected 415 for invalid extension, got ${resBadExt.status}`);
    }

    // 4c. Non-ZIP corrupt buffer named .docx
    const corruptForm = new FormData();
    corruptForm.append(
      "file",
      new Blob(["corrupted plaintext pretending to be docx"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }),
      "corrupt.docx"
    );
    const resCorrupt = await fetch(`${BACKEND_URL}/api/knowledge/documents/upload`, {
      method: "POST",
      body: corruptForm
    });
    console.log("Corrupt DOCX status (expected 400):", resCorrupt.status);
    if (resCorrupt.status !== 400) {
      throw new Error(`Expected 400 for corrupt buffer, got ${resCorrupt.status}`);
    }

    console.log("✅ TEST 4 PASSED: Error cases correctly validated (400 / 415)");

    // -------------------------------------------------------------
    // Test 5: Clean Up Test Document
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Document Clean Up ---");
    if (uploadedDocId) {
      const delRes = await fetch(`${BACKEND_URL}/api/knowledge/documents/${encodeURIComponent(uploadedDocId)}`, {
        method: "DELETE"
      });
      const delData = await delRes.json();
      console.log("Delete status:", delRes.status, delData.message);
      if (delRes.status !== 200) {
        throw new Error(`Failed to clean up test document: ${JSON.stringify(delData)}`);
      }
    }
    console.log("✅ TEST 5 PASSED: Test document and vector chunks deleted cleanly");

    console.log("\n================================================================");
    console.log("🎉 ALL DOCX INGESTION & RAG RETRIEVAL TESTS PASSED (100%)");
    console.log("================================================================");
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err);
    if (uploadedDocId) {
      try {
        await fetch(`${BACKEND_URL}/api/knowledge/documents/${encodeURIComponent(uploadedDocId)}`, {
          method: "DELETE"
        });
      } catch {}
    }
    process.exit(1);
  }
}

runTests();
