import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

/**
 * Task 44-09: live project-market data sync in dev.
 *
 * GET /api/dev/projects/scan returns a lightweight catalog of every
 * (project, species, generation) currently on disk so the marketplace
 * UI can detect drift against compile-time `EVAL_RUNS` (rebuilt at
 * predev). Reuses the canonical loader helpers from
 * vendor/get-anything-done/lib/eval-data-access.cjs (task 44-02) so
 * the scan stays in lockstep with `gad eval list`.
 *
 * Refuses unless NODE_ENV=development. The marketing site never
 * exposes this in production builds.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JSON_HEADERS = { "content-type": "application/json" };

interface ScannedGeneration {
  id: string;
  project: string;
  species: string;
  version: string;
  status: string;
  hasBuild: boolean;
  publishedAt: string | null;
}

interface ScannedSpecies {
  id: string;
  project: string;
  species: string;
}

interface ScanResponse {
  generations: ScannedGeneration[];
  species: ScannedSpecies[];
  projects: string[];
  generatedAt: string;
}

function findRepoRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 10; i += 1) {
    if (fs.existsSync(path.join(dir, "bin", "gad.cjs"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

interface DataAccess {
  listProjects(): Array<{ id: string; projectDir: string; rootId: string }>;
  listSpecies(projectId: string): Record<string, unknown>;
  listGenerations(
    projectId: string,
    speciesName: string,
  ): Array<{
    version: string;
    status: string;
    publishedAt: string | null;
    isPublished: boolean;
  }>;
}

function getDataAccess(): DataAccess | null {
  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ""));
  const repoRoot = findRepoRoot(process.cwd()) || findRepoRoot(here);
  if (!repoRoot) return null;
  const dynamicRequire = createRequire(
    path.join(repoRoot, "lib", "package.json"),
  );
  return dynamicRequire("./eval-data-access.cjs") as DataAccess;
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response(JSON.stringify({ error: "Dev-only endpoint." }), {
      status: 403,
      headers: JSON_HEADERS,
    });
  }

  try {
    const da = getDataAccess();
    if (!da) {
      return new Response(
        JSON.stringify({ error: "Could not locate vendor/get-anything-done lib." }),
        { status: 500, headers: JSON_HEADERS },
      );
    }

    const generations: ScannedGeneration[] = [];
    const speciesRows: ScannedSpecies[] = [];
    const projectIds: string[] = [];

    for (const proj of da.listProjects()) {
      projectIds.push(proj.id);
      const speciesMap = da.listSpecies(proj.id);
      for (const speciesName of Object.keys(speciesMap)) {
        speciesRows.push({
          id: `${proj.id}/${speciesName}`,
          project: proj.id,
          species: speciesName,
        });
        for (const gen of da.listGenerations(proj.id, speciesName)) {
          generations.push({
            id: `${proj.id}/${speciesName}/${gen.version}`,
            project: proj.id,
            species: speciesName,
            version: gen.version,
            status: gen.status,
            hasBuild: gen.isPublished,
            publishedAt: gen.publishedAt,
          });
        }
      }
    }

    const body: ScanResponse = {
      generations,
      species: speciesRows,
      projects: projectIds,
      generatedAt: new Date().toISOString(),
    };
    return new Response(JSON.stringify(body), { headers: JSON_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}
