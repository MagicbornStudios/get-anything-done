import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TerminalBody = { command?: unknown; cwd?: unknown };

function isSafeCommand(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 4000;
}

function isSafeRelativePath(value: unknown): value is string {
  return typeof value === "string" && value.length < 256 && !path.isAbsolute(value) && !value.includes("..");
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(JSON.stringify({ error: "Dev-only endpoint. NODE_ENV must be 'development'." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  let body: TerminalBody = {};
  try {
    body = (await request.json()) as TerminalBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { command, cwd } = body;
  if (!isSafeCommand(command)) {
    return new Response(JSON.stringify({ error: "command required (non-empty string)." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (cwd !== undefined && !isSafeRelativePath(cwd)) {
    return new Response(JSON.stringify({ error: "cwd must be a safe relative path." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..", "..", "..");
  const resolvedCwd = cwd ? path.resolve(repoRoot, cwd) : repoRoot;

  const isWin = process.platform === "win32";
  const shellCmd = isWin ? "powershell.exe" : "/bin/sh";
  const shellArgs = isWin
    ? ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command]
    : ["-lc", command];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      send("start", { command, cwd: resolvedCwd });

      const child = spawn(shellCmd, shellArgs, {
        cwd: resolvedCwd,
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

