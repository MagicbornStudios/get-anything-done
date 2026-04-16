import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Scoped command bridge for the Project Editor (task 44.5-02).
 *
 * Unlike /api/dev/terminal (wide-open), this route only executes
 * allowlisted `gad` CLI subcommands. The editor UI calls this
 * instead of the terminal route for all GAD operations.
 */

const ALLOWED_SUBCOMMANDS = new Set([
  "snapshot",
  "state",
  "tasks",
  "phases",
  "decisions",
  "skill",
  "evolution",
  "eval",
  "sprint",
  "verify",
  "try",
  "worktree",
  "log",
  "site",
  "projects",
  "sink",
  "graph",
  "query",
  "species",
]);

/** Per-command timeout in milliseconds. Unlisted commands get DEFAULT_TIMEOUT. */
const DEFAULT_TIMEOUT = 30_000;
const TIMEOUT_MAP: Record<string, number> = {
  eval: 120_000,
  evolution: 120_000,
  snapshot: 60_000,
};

type BridgeBody = {
  subcommand?: unknown;
  args?: unknown;
  projectId?: unknown;
};

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Block shell metacharacters and path traversal. */
const UNSAFE_ARG_RE = /[;&|`$(){}\\><!\n\r\0"']/;
function isSafeArg(arg: string): boolean {
  return arg.length < 256 && !UNSAFE_ARG_RE.test(arg) && !arg.includes("..");
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(
      JSON.stringify({ error: "Dev-only endpoint. NODE_ENV must be 'development'." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  let body: BridgeBody = {};
  try {
    body = (await request.json()) as BridgeBody;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const { subcommand, args, projectId } = body;

  if (!isString(subcommand) || !ALLOWED_SUBCOMMANDS.has(subcommand)) {
    return new Response(
      JSON.stringify({
        error: `Subcommand not allowed. Allowed: ${[...ALLOWED_SUBCOMMANDS].join(", ")}`,
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const extraArgs: string[] = isStringArray(args) ? args : [];
  if (!extraArgs.every(isSafeArg)) {
    return new Response(
      JSON.stringify({ error: "Args contain disallowed characters." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  // Resolve gad.cjs relative to the site directory
  const siteDir = process.cwd();
  const gadBin = path.resolve(siteDir, "..", "bin", "gad.cjs");
  const repoRoot = path.resolve(siteDir, "..");

  const cmdArgs = [gadBin, subcommand, ...extraArgs];
  if (isString(projectId) && isSafeArg(projectId) && !extraArgs.includes("--projectid")) {
    cmdArgs.push("--projectid", projectId);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      send("start", { subcommand, args: extraArgs, projectId });

      const timeout = TIMEOUT_MAP[subcommand] ?? DEFAULT_TIMEOUT;
      const child = spawn("node", cmdArgs, {
        cwd: repoRoot,
        env: { ...process.env, FORCE_COLOR: "0" },
        timeout,
      });

      const stderrChunks: string[] = [];

      const emitLines = (event: "stdout" | "stderr") => (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        if (event === "stderr") stderrChunks.push(text);
        for (const line of text.split(/\r?\n/)) {
          if (line.length > 0) send(event, { line });
        }
      };

      child.stdout.on("data", emitLines("stdout"));
      child.stderr.on("data", emitLines("stderr"));

      child.on("error", (err) => {
        send("error", {
          error: err.message,
          exitCode: null,
          stderr: stderrChunks.join(""),
        });
        controller.close();
      });

      child.on("close", (code, signal) => {
        if (code !== 0 && code !== null) {
          send("error", {
            error: `Command exited with code ${code}`,
            exitCode: code,
            stderr: stderrChunks.join(""),
          });
        }
        send("exit", { code, signal });
        controller.close();
      });

      request.signal.addEventListener("abort", () => {
        if (!child.killed) child.kill("SIGTERM");
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
