import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";

// Repo-root resolver: walk up until pnpm-workspace.yaml or .planning/ found
function findRepoRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (let i = 0; i < 20; i++) {
    if (
      fs.existsSync(path.join(dir, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(dir, ".planning"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find repo root (no pnpm-workspace.yaml or .planning/ found)");
}

// REDACT sensitive keys from objects
const REDACT_PATTERN = /(_KEY|_TOKEN|Authorization|api_key|secret|password)/i;

function redactObj(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(redactObj);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_PATTERN.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactObj(v);
    }
  }
  return out;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function tailJsonl(filepath, n) {
  try {
    const content = fs.readFileSync(filepath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(-n).map((l) => {
      try { return JSON.parse(l); } catch { return { raw: l }; }
    });
  } catch {
    return [];
  }
}

function readJsonlAll(filepath) {
  try {
    const content = fs.readFileSync(filepath, "utf8");
    return content.split("\n").filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return { raw: l }; }
    });
  } catch {
    return [];
  }
}

const TOOLS = [
  {
    name: "recent_invocations",
    description: "Tail today's gad invocation log, newest-first",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max entries to return (default 50)" },
      },
      required: [],
    },
  },
  {
    name: "runtime_usage_today",
    description: "Count today's invocations grouped by runtime field",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "codex_calls_since",
    description: "Filter today's log for codex-cli invocations after a given ISO timestamp",
    inputSchema: {
      type: "object",
      properties: {
        iso_ts: { type: "string", description: "ISO 8601 timestamp lower bound (inclusive)" },
      },
      required: ["iso_ts"],
    },
  },
  {
    name: "spend_summary",
    description: "Aggregate ai-spend-ledger over N most-recent days",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of most-recent days to aggregate (default 1)" },
      },
      required: [],
    },
  },
  {
    name: "trace_events",
    description: "Tail .planning/.trace-events.jsonl, newest-first",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max entries to return (default 100)" },
      },
      required: [],
    },
  },
];

async function main() {
  const root = findRepoRoot();
  const gadLogDir = path.join(root, ".planning", ".gad-log");
  const spendDir = path.join(root, ".planning", "datasets", "ai-spend-ledger");
  const traceFile = path.join(root, ".planning", ".trace-events.jsonl");

  const server = new Server(
    { name: "gad-trace-server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === "recent_invocations") {
      const limit = args?.limit ?? 50;
      const today = todayIso();
      const logFile = path.join(gadLogDir, `${today}.jsonl`);
      const entries = tailJsonl(logFile, limit).reverse();
      return { content: [{ type: "text", text: JSON.stringify(redactObj(entries), null, 2) }] };
    }

    if (name === "runtime_usage_today") {
      const today = todayIso();
      const logFile = path.join(gadLogDir, `${today}.jsonl`);
      const entries = readJsonlAll(logFile);
      const counts = {};
      for (const e of entries) {
        const rt = e.runtime ?? "unknown";
        counts[rt] = (counts[rt] ?? 0) + 1;
      }
      return { content: [{ type: "text", text: JSON.stringify(counts, null, 2) }] };
    }

    if (name === "codex_calls_since") {
      const iso_ts = args?.iso_ts;
      if (!iso_ts) return { content: [{ type: "text", text: "iso_ts is required" }], isError: true };
      const cutoff = new Date(iso_ts).getTime();
      const today = todayIso();
      const logFile = path.join(gadLogDir, `${today}.jsonl`);
      const entries = readJsonlAll(logFile);
      const filtered = entries
        .filter((e) => {
          if (e.runtime !== "codex-cli") return false;
          const ts = e.timestamp ?? e.ts ?? e.time;
          if (!ts) return false;
          return new Date(ts).getTime() >= cutoff;
        })
        .map((e) => ({
          timestamp: e.timestamp ?? e.ts ?? e.time,
          cwd: e.cwd ?? null,
          pid: e.pid ?? null,
          payload_summary: e.command ?? e.cmd ?? e.args ?? e.goal ?? null,
        }));
      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    }

    if (name === "spend_summary") {
      const days = args?.days ?? 1;
      let files = [];
      try {
        files = fs.readdirSync(spendDir)
          .filter((f) => f.endsWith(".jsonl"))
          .sort()
          .slice(-days);
      } catch {
        return { content: [{ type: "text", text: "ai-spend-ledger directory not found" }], isError: true };
      }
      const rows = [];
      for (const f of files) {
        const date = f.replace(".jsonl", "");
        const entries = readJsonlAll(path.join(spendDir, f));
        for (const e of entries) {
          rows.push({
            date,
            runtime: e.runtime ?? null,
            model: e.model ?? null,
            prompt_tokens: e.prompt_tokens ?? e.input_tokens ?? null,
            completion_tokens: e.completion_tokens ?? e.output_tokens ?? null,
          });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }

    if (name === "trace_events") {
      const limit = args?.limit ?? 100;
      const entries = tailJsonl(traceFile, limit).reverse();
      return { content: [{ type: "text", text: JSON.stringify(redactObj(entries), null, 2) }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`gad-trace-server fatal: ${err.message}\n`);
  process.exit(1);
});
