import React from "react";

/**
 * Tokenizes and renders inline Markdown:
 * - `inline code`
 * - **bold**
 * - *italic*
 * - [link text](url)
 */
function renderInline(text) {
  if (!text) return null;

  // Match: `code`, **bold**, *italic*, [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Inline code
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-rose-300 select-text"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-100 select-text">
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    }

    // Italic
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={idx} className="italic text-slate-300 select-text">
          {renderInline(part.slice(1, -1))}
        </em>
      );
    }

    // Link
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-rose-400 underline hover:text-rose-300 transition-colors select-text"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={idx}>{part}</span>;
  });
}

/**
 * Helper to split a table row by pipe delimiter '|'
 */
function parseTableRow(line) {
  let clean = line.trim();
  if (clean.startsWith("|")) clean = clean.slice(1);
  if (clean.endsWith("|")) clean = clean.slice(0, -1);

  // Handle escaped pipes \|
  const placeholder = "___ESCAPED_PIPE___";
  clean = clean.replace(/\\\|/g, placeholder);

  return clean.split("|").map((cell) => cell.replace(new RegExp(placeholder, "g"), "|").trim());
}

/**
 * Checks if a string is a valid Markdown table separator line like:
 * | --- | :---: | ---: |
 */
function isTableSeparator(line) {
  const trimmed = line.trim();
  return /^\|?\s*[-:]+[-|\s:]*\|?$/.test(trimmed) && trimmed.includes("-");
}

/**
 * Parses raw markdown into structured blocks:
 * - code
 * - table
 * - heading
 * - unordered-list
 * - ordered-list
 * - paragraph
 */
function parseMarkdownBlocks(markdown) {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Fenced Code Block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++; // skip closing fence
      }
      blocks.push({
        type: "code",
        lang: lang || "text",
        content: codeLines.join("\n")
      });
      continue;
    }

    // 3. Markdown Table detection
    // Starts with a line containing '|' and followed by a separator line
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerRow = parseTableRow(trimmed);
      const separatorRow = parseTableRow(lines[i + 1]);

      const alignments = separatorRow.map((cell) => {
        const c = cell.trim();
        if (c.startsWith(":") && c.endsWith(":")) return "center";
        if (c.endsWith(":")) return "right";
        return "left";
      });

      i += 2; // move past header & separator

      const rows = [];
      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (!rowLine || !rowLine.includes("|")) break;
        if (isTableSeparator(rowLine)) {
          i++;
          continue;
        }
        rows.push(parseTableRow(rowLine));
        i++;
      }

      blocks.push({
        type: "table",
        headers: headerRow,
        alignments,
        rows
      });
      continue;
    }

    // 4. Headings (#, ##, ###, ####)
    if (trimmed.startsWith("#")) {
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        blocks.push({
          type: "heading",
          level: match[1].length,
          text: match[2]
        });
        i++;
        continue;
      }
    }

    // 5. Unordered List (- item, * item, • item)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length) {
        const itemTrim = lines[i].trim();
        const m = itemTrim.match(/^[-*•]\s+(.*)$/);
        if (m) {
          items.push(m[1]);
          i++;
        } else if (itemTrim === "") {
          if (i + 1 < lines.length && /^[-*•]\s+/.test(lines[i + 1].trim())) {
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      blocks.push({
        type: "unordered-list",
        items
      });
      continue;
    }

    // 6. Ordered List (1. item, 2. item)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length) {
        const itemTrim = lines[i].trim();
        const m = itemTrim.match(/^\d+\.\s+(.*)$/);
        if (m) {
          items.push(m[1]);
          i++;
        } else if (itemTrim === "") {
          if (i + 1 < lines.length && /^\d+\.\s+/.test(lines[i + 1].trim())) {
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      blocks.push({
        type: "ordered-list",
        items
      });
      continue;
    }

    // 7. Normal Paragraph
    const paraLines = [];
    while (i < lines.length) {
      const pLine = lines[i].trim();
      if (!pLine) {
        i++;
        break;
      }
      // Stop if next line is a special markdown block
      if (
        pLine.startsWith("```") ||
        pLine.startsWith("#") ||
        /^[-*•]\s+/.test(pLine) ||
        /^\d+\.\s+/.test(pLine) ||
        (pLine.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        text: paraLines.join(" ")
      });
    }
  }

  return blocks;
}

/**
 * ChatMarkdownRenderer component
 * Renders structured markdown, responsive tables with glassmorphism styling, code blocks, lists, and headings.
 */
export default function ChatMarkdownRenderer({ content }) {
  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-200">
      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case "table":
            return (
              <div
                key={bIdx}
                className="overflow-x-auto my-3 rounded-lg border border-slate-800 bg-slate-950/70 shadow-inner max-w-full"
              >
                <table className="min-w-full text-left text-xs border-collapse divide-y divide-slate-800">
                  <thead className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    <tr>
                      {block.headers.map((header, hIdx) => (
                        <th
                          key={hIdx}
                          className="px-3.5 py-2.5 whitespace-nowrap text-slate-300 font-semibold select-text"
                          style={{
                            textAlign: block.alignments[hIdx] || "left"
                          }}
                        >
                          {renderInline(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-slate-850/40 transition-colors"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-3.5 py-2.5 align-top leading-relaxed text-slate-300 break-words select-text"
                            style={{
                              textAlign: block.alignments[cIdx] || "left"
                            }}
                          >
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "code":
            return (
              <div
                key={bIdx}
                className="my-2.5 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden shadow-inner max-w-full"
              >
                {block.lang && block.lang !== "text" && (
                  <div className="px-3 py-1 bg-slate-900/80 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    {block.lang}
                  </div>
                )}
                <pre className="p-3 font-mono text-[11px] leading-relaxed text-emerald-400 overflow-x-auto select-text">
                  <code>{block.content}</code>
                </pre>
              </div>
            );

          case "heading":
            if (block.level <= 2) {
              return (
                <h3
                  key={bIdx}
                  className="text-xs font-bold text-slate-100 uppercase tracking-wider mt-3 mb-1.5 select-text"
                >
                  {renderInline(block.text)}
                </h3>
              );
            }
            return (
              <h4
                key={bIdx}
                className="text-xs font-semibold text-slate-200 mt-2.5 mb-1 select-text"
              >
                {renderInline(block.text)}
              </h4>
            );

          case "unordered-list":
            return (
              <ul
                key={bIdx}
                className="space-y-1.5 my-2 list-disc list-inside text-slate-200 text-xs leading-relaxed select-text"
              >
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="pl-1">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );

          case "ordered-list":
            return (
              <ol
                key={bIdx}
                className="space-y-1.5 my-2 list-decimal list-inside text-slate-200 text-xs leading-relaxed select-text"
              >
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="pl-1">
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );

          case "paragraph":
          default:
            return (
              <p
                key={bIdx}
                className="leading-relaxed text-slate-200 text-xs my-1.5 select-text"
              >
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
