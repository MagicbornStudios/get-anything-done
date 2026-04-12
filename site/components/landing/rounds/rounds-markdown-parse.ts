import type { RoundsMdBlock } from "./rounds-markdown-types";

export function roundsMdSplitRow(line: string): string[] {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

export function roundsMdParseBlocks(body: string): RoundsMdBlock[] {
  const lines = body.split("\n");
  const blocks: RoundsMdBlock[] = [];
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
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !/^\|.*\|$/.test(lines[i]) &&
        !/^\s*-\s+/.test(lines[i])
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "para", content: paraLines });
    }
  }
  return blocks;
}
