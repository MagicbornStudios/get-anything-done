import { Badge } from "@/components/ui/badge";
import { ROUND_SUMMARIES } from "@/lib/eval-data";

const ROUND_TINT: Record<string, string> = {
  "Round 1": "border-red-500/40",
  "Round 2": "border-amber-500/40",
  "Round 3": "border-sky-500/40",
  "Round 4": "border-emerald-500/40",
};

// Convert inline markdown table lines into visual rows. Leaves other lines alone.
function renderBody(body: string) {
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
        // table
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

function splitRow(line: string): string[] {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

function renderInline(text: string): React.ReactNode {
  // Bold **text** → <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function Rounds() {
  if (ROUND_SUMMARIES.length === 0) return null;
  return (
    <section id="rounds" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">Experiment log</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Round by round. <span className="gradient-text">What we asked.</span> What the agents
          actually shipped.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          The experiment log is append-only. Each entry captures the requirements version, the
          workflow conditions that ran, the scores, and the key finding that drove the next
          round&apos;s changes. This is the raw appendix — scroll the{" "}
          <a href="#requirements" className="text-accent underline-offset-4 hover:underline">
            requirements lineage
          </a>{" "}
          to see the specs that resulted.
        </p>

        <div className="mt-12 space-y-6">
          {ROUND_SUMMARIES.map((r) => (
            <article
              key={r.round}
              className={`rounded-2xl border border-l-4 bg-card/40 p-6 md:p-8 ${ROUND_TINT[r.round] ?? "border-l-border"}`}
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Badge variant="default">{r.round}</Badge>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">{r.title}</h3>
              </div>
              {renderBody(r.body)}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
