import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serves the interactive planning graph HTML visualization.
 * GET /api/dev/graph — returns the graph.html
 * GET /api/dev/graph?rebuild=1 — regenerates graph first
 * GET /api/dev/graph?format=json — returns raw graph.json
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Dev-only endpoint.", { status: 403 });
  }

  const url = new URL(request.url);
  const rebuild = url.searchParams.get("rebuild") === "1";
  const format = url.searchParams.get("format");

  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..");
  const graphHtml = path.join(repoRoot, ".planning", "graph.html");
  const graphJson = path.join(repoRoot, ".planning", "graph.json");
  const gadBin = path.join(repoRoot, "bin", "gad.cjs");

  // Rebuild if requested or if files don't exist
  if (rebuild || !fs.existsSync(graphHtml) || !fs.existsSync(graphJson)) {
    try {
      execSync(`node "${gadBin}" graph build`, {
        cwd: repoRoot,
        env: { ...process.env, FORCE_COLOR: "0" },
        timeout: 30000,
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Failed to build graph", detail: (e as Error).message }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
  }

  if (format === "json") {
    if (!fs.existsSync(graphJson)) {
      return new Response('{"error":"graph.json not found"}', {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    const content = fs.readFileSync(graphJson, "utf8");
    return new Response(content, {
      headers: { "content-type": "application/json" },
    });
  }

  if (!fs.existsSync(graphHtml)) {
    return new Response("graph.html not found. Run `gad graph build` first.", {
      status: 404,
    });
  }

  const html = fs.readFileSync(graphHtml, "utf8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
