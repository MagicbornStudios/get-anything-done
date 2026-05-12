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

function readJsonSafe(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf8"));
  } catch {
    return null;
  }
}

function tailLines(filepath, n) {
  try {
    const content = fs.readFileSync(filepath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(-n);
  } catch {
    return [];
  }
}

const TOOLS = [
  {
    name: "list_workers",
    description: "List all team workers and their current status",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "worker_status",
    description: "Get detailed status for a single worker by id (e.g. 'w1')",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Worker id, e.g. w1, w2" },
      },
      required: ["id"],
    },
  },
  {
    name: "dispatcher_status",
    description: "Get dispatcher heartbeat, pid, and last 20 log lines",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "account_cooldowns",
    description: "Get current runtime account cooldown state",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "runtime_accounts",
    description: "Get runtime account config (sensitive fields redacted)",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

async function main() {
  const root = findRepoRoot();
  const teamDir = path.join(root, ".planning", "team");

  const server = new Server(
    { name: "gad-state-server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === "list_workers") {
      const workersDir = path.join(teamDir, "workers");
      const workers = [];
      try {
        const ids = fs.readdirSync(workersDir).filter((d) =>
          fs.statSync(path.join(workersDir, d)).isDirectory()
        );
        for (const id of ids) {
          const status = readJsonSafe(path.join(workersDir, id, "status.json"));
          if (status) {
            workers.push({
              id,
              runtime: status.runtime ?? null,
              role: status.role ?? null,
              last_seen: status.last_seen ?? null,
              status: status.status ?? null,
              current_task: status.current_task ?? null,
            });
          }
        }
      } catch (e) {
        return { content: [{ type: "text", text: `Error reading workers: ${e.message}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(workers, null, 2) }] };
    }

    if (name === "worker_status") {
      const id = args?.id;
      if (!id) return { content: [{ type: "text", text: "id is required" }], isError: true };
      const workerDir = path.join(teamDir, "workers", id);
      const status = readJsonSafe(path.join(workerDir, "status.json"));
      if (!status) return { content: [{ type: "text", text: `Worker ${id} not found or unreadable` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    }

    if (name === "dispatcher_status") {
      const heartbeat = readJsonSafe(path.join(teamDir, "dispatcher.heartbeat.json"));
      const pid = readJsonSafe(path.join(teamDir, "dispatcher.pid"));
      const logLines = tailLines(path.join(teamDir, "dispatcher.log.jsonl"), 20)
        .map((l) => { try { return JSON.parse(l); } catch { return l; } });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ heartbeat, pid, recent_log: logLines }, null, 2),
        }],
      };
    }

    if (name === "account_cooldowns") {
      const data = readJsonSafe(path.join(teamDir, "runtime-cooldown.json"));
      if (!data) return { content: [{ type: "text", text: "runtime-cooldown.json not found" }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    if (name === "runtime_accounts") {
      const data = readJsonSafe(path.join(teamDir, "runtime-accounts.json"));
      if (!data) return { content: [{ type: "text", text: "runtime-accounts.json not found" }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(redactObj(data), null, 2) }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`gad-state-server fatal: ${err.message}\n`);
  process.exit(1);
});
