import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getDataAccess() {
  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..");
  const dynamicRequire = createRequire(path.join(repoRoot, "lib", "package.json"));
  return dynamicRequire("./eval-data-access.cjs");
}

function devGate(): Response | null {
  if (process.env.NODE_ENV !== "development") {
    return new Response(
      JSON.stringify({ error: "Dev-only endpoint." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }
  return null;
}

const JSON_HEADERS = { "content-type": "application/json" };

/**
 * Allowed file patterns within an eval project directory.
 * Prevents arbitrary file access outside the project tree.
 */
const ALLOWED_FILES = [
  "project.json",
  /^species\/[a-z0-9-]+\/species\.json$/,
  /^species\/[a-z0-9-]+\/REQUIREMENTS\.md$/,
  /^species\/[a-z0-9-]+\/v\d+\/TRACE\.json$/,
  /^species\/[a-z0-9-]+\/v\d+\/RUN\.md$/,
  /^species\/[a-z0-9-]+\/v\d+\/PROMPT\.md$/,
  /^species\/[a-z0-9-]+\/v\d+\/EXEC\.json$/,
];

/** Writable subset — generation files are read-only. */
const WRITABLE_FILES = [
  "project.json",
  /^species\/[a-z0-9-]+\/species\.json$/,
  /^species\/[a-z0-9-]+\/REQUIREMENTS\.md$/,
];

function isAllowed(relativePath: string, patterns: (string | RegExp)[]): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  for (const p of patterns) {
    if (typeof p === "string" && normalized === p) return true;
    if (p instanceof RegExp && p.test(normalized)) return true;
  }
  return false;
}

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/dev/evals/projects/[id]/files?path=species/gad/REQUIREMENTS.md
 * Read a file within an eval project directory.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      return new Response(
        JSON.stringify({ error: "Missing ?path= parameter" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    if (!isAllowed(filePath, ALLOWED_FILES)) {
      return new Response(
        JSON.stringify({ error: `File path not allowed: ${filePath}` }),
        { status: 403, headers: JSON_HEADERS },
      );
    }

    const da = getDataAccess();
    const resolved = da.resolveProject(id);
    if (!resolved) {
      return new Response(
        JSON.stringify({ error: `Project "${id}" not found` }),
        { status: 404, headers: JSON_HEADERS },
      );
    }

    const fullPath = path.join(resolved.projectDir, filePath);
    if (!fs.existsSync(fullPath)) {
      return new Response(
        JSON.stringify({ error: `File not found: ${filePath}` }),
        { status: 404, headers: JSON_HEADERS },
      );
    }

    const content = fs.readFileSync(fullPath, "utf8");
    const isJson = filePath.endsWith(".json");

    return new Response(
      JSON.stringify({
        path: filePath,
        content,
        parsed: isJson ? JSON.parse(content) : undefined,
        size: Buffer.byteLength(content, "utf8"),
      }),
      { headers: JSON_HEADERS },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}

/**
 * PUT /api/dev/evals/projects/[id]/files
 * Write a file within an eval project directory.
 * Body: { path: string, content: string }
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const { path: filePath, content } = body;

    if (!filePath || typeof content !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing path or content in request body" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    if (!isAllowed(filePath, WRITABLE_FILES)) {
      return new Response(
        JSON.stringify({ error: `File path not writable: ${filePath}` }),
        { status: 403, headers: JSON_HEADERS },
      );
    }

    const da = getDataAccess();
    const resolved = da.resolveProject(id);
    if (!resolved) {
      return new Response(
        JSON.stringify({ error: `Project "${id}" not found` }),
        { status: 404, headers: JSON_HEADERS },
      );
    }

    const fullPath = path.join(resolved.projectDir, filePath);

    // Ensure parent dir exists (for new species)
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf8");

    return new Response(
      JSON.stringify({
        path: filePath,
        written: true,
        size: Buffer.byteLength(content, "utf8"),
      }),
      { headers: JSON_HEADERS },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}
