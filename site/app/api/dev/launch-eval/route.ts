import { spawn } from "node:child_process";
import path from "node:path";

/**
 * Dev-only live launcher for `gad eval run`.
 * Spawns the CLI from the repo root and streams stdout/stderr back to the
 * browser as Server-Sent Events. Refuses unless NODE_ENV=development.
 *
 * Request body: { projectId: string, species?: string }
 * Response: text/event-stream with events:
 *   - `stdout` / `stderr`: { line: string }
 *   - `exit`: { code: number | null, signal: string | null }
 *   - `error`: { message: string }
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LaunchBody = { projectId?: unknown; species?: unknown };

function isValidId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_\-./]+$/.test(value) && value.length < 128;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(
      JSON.stringify({ error: "Dev-only endpoint. NODE_ENV must be 'development'." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  let body: LaunchBody = {};
  try {
    body = (await request.json()) as LaunchBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { projectId, species } = body;
  if (!isValidId(projectId)) {
    return new Response(JSON.stringify({ error: "projectId required (safe chars only)." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (species !== undefined && !isValidId(species)) {
    return new Response(JSON.stringify({ error: "species must be a safe identifier." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Resolve repo root: site/ → vendor/get-anything-done/ → custom_portfolio/
  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..", "..", "..");
  const gadBin = path.resolve(siteDir, "..", "bin", "gad.cjs");

  const args = [gadBin, "eval", "run", "--project", projectId];
  if (typeof species === "string") args.push("--species", species);
  args.push("--execute");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      send("start", { command: `node ${path.relative(repoRoot, gadBin)} ${args.slice(1).join(" ")}`, cwd: repoRoot });

      const child = spawn(process.execPath, args, {
        cwd: repoRoot,
        env: process.env,
      });

      const emitLines = (event: "stdout" | "stderr") => (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        for (const line of text.split(/\r?\n/)) {
          if (line.length > 0) send(event, { line });
        }
      };

      child.stdout.on("data", emitLines("stdout"));
      child.stderr.on("data", emitLines("stderr"));

      child.on("error", (err) => {
        send("error", { message: err.message });
        controller.close();
      });

      child.on("close", (code, signal) => {
        send("exit", { code, signal });
        controller.close();
      });

      // Abort support: if the client disconnects, kill the child.
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
