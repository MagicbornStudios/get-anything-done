import { spawn } from "node:child_process";
import path from "node:path";

/**
 * Task 44-09: live project-market data sync in dev.
 *
 * POST /api/dev/projects/refresh re-runs `node scripts/build-site-data.mjs`
 * which rewrites `lib/eval-data.generated.ts` + `lib/marketplace-index.generated.json`
 * + `public/playable/**` from disk. Streams stdout as Server-Sent Events
 * so the UI can show progress, then closes when the child exits.
 *
 * Refuses unless NODE_ENV=development.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return new Response(JSON.stringify({ error: "Dev-only endpoint." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const siteRoot = path.resolve(process.cwd());
  const scriptPath = path.join(siteRoot, "scripts", "build-site-data.mjs");

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("start", { script: scriptPath, cwd: siteRoot, ts: Date.now() });

      const child = spawn(process.execPath, [scriptPath], {
        cwd: siteRoot,
        env: process.env,
      });

      const onLine = (channel: "stdout" | "stderr") => (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        for (const line of text.split(/\r?\n/)) {
          if (line) send(channel, { line });
        }
      };

      child.stdout.on("data", onLine("stdout"));
      child.stderr.on("data", onLine("stderr"));

      child.on("error", (err: Error) => {
        send("error", { message: err.message });
        controller.close();
      });

      child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
        send("exit", { code, signal, ts: Date.now() });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
