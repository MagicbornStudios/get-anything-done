"use client";

import type { ReactNode } from "react";

function splitRow(line: string): string[] {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

type Props = {
  body: string;
};

export function ExperimentLogBody({ body }: Props) {
  const lines = body.split("\n");
  const blocks: Array<{ type: "para" | "table" | "list"; content: string[] }> = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\|.*\|$/.test(line)) {
      const tableLines = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "table", content: tableLines });
    } else if (/^\s*-\s+/.test(line)) {
      const bullets = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        bullets.push(lines[i].replace(/^\s*-\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", content: bullets });
    } else if (line.trim() === "") {
      i++;
    } else {
      const paraLines = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^\|.*\|$/.test(lines[i]) && !/^\s*-\s+/.test(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "para", content: paraLines });
    }
  }

  return (
    <div className="space-y-4 text-sm leading-6 text-muted-foreground">
      {blocks.map((block, idx) => {
        if (block.type === "para") {
          return (
            <p key={idx} className="whitespace-pre-line">
              {renderInline(block.content.join("\n"))}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={idx} className="list-disc space-y-1 pl-5">
              {block.content.map((bullet, j) => (
                <li key={j}>{renderInline(bullet)}</li>
              ))}
            </ul>
          );
        }
        const [headerLine, , ...dataLines] = block.content;
        const headerCells = splitRow(headerLine);
        const rows = dataLines.map(splitRow);
        return (
          <div key={idx} className="overflow-x-auto rounded-lg border border-border/60 bg-background/40">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  {headerCells.map((c, j) => (
                    <th key={j} className="px-3 py-2 font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-transparent" : "bg-background/30"}>
                    {row.map((c, j) => (
                      <td key={j} className="px-3 py-2 tabular-nums">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
