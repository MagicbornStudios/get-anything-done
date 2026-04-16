import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

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

type RouteParams = { params: Promise<{ id: string; name: string; version: string }> };

/** Resolve the site's public/playable target directory for a generation. */
function playableDir(projectId: string, species: string, version: string): string {
  const siteDir = process.cwd();
  return path.join(siteDir, "public", "playable", projectId, species, version);
}

/**
 * Find the build output directory inside a preserved generation.
 * Prefers run/dist/, falls back to run/ if it contains index.html.
 */
function findBuildSource(generationDir: string): string | null {
  const distDir = path.join(generationDir, "run", "dist");
  if (fs.existsSync(path.join(distDir, "index.html"))) return distDir;

  const runDir = path.join(generationDir, "run");
  if (fs.existsSync(path.join(runDir, "index.html"))) return runDir;

  return null;
}

/** Recursively copy a directory, creating targets as needed. */
function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and .git
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** GET — check if a generation is published */
export async function GET(_request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id, name, version } = await params;
    const target = playableDir(id, name, version);
    const isPublished = fs.existsSync(path.join(target, "index.html"));

    return new Response(
      JSON.stringify({ isPublished, path: target }),
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

/** POST — publish a generation (copy preserved build to public/playable/) */
export async function POST(_request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id, name, version } = await params;
    const da = getDataAccess();

    const gen = da.getGeneration(id, name, version);
    if (!gen) {
      return new Response(
        JSON.stringify({ error: `Generation ${version} not found for ${name} in ${id}` }),
        { status: 404, headers: JSON_HEADERS },
      );
    }

    const buildSrc = findBuildSource(gen.dir);
    if (!buildSrc) {
      return new Response(
        JSON.stringify({ error: `No build output found in ${gen.dir}/run/` }),
        { status: 404, headers: JSON_HEADERS },
      );
    }

    const target = playableDir(id, name, version);
    copyDirSync(buildSrc, target);

    return new Response(
      JSON.stringify({ published: true, source: buildSrc, target }),
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

/** DELETE — unpublish a generation (remove public copy, keep preserved source) */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id, name, version } = await params;
    const target = playableDir(id, name, version);

    if (!fs.existsSync(target)) {
      return new Response(
        JSON.stringify({ error: "Not published" }),
        { status: 404, headers: JSON_HEADERS },
      );
    }

    fs.rmSync(target, { recursive: true, force: true });

    return new Response(
      JSON.stringify({ unpublished: true, removed: target }),
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
