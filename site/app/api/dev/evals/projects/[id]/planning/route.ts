import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

// ---------------------------------------------------------------------------
// Notes scanner (mirrors /api/planning/notes but scoped to a project root)
// ---------------------------------------------------------------------------

interface NoteItem {
  id: string;
  title: string;
  updatedAt: string;
  snippet: string;
  relPath: string;
}

function firstHeadingOrName(src: string, fallback: string): string {
  const m = src.match(/^\s*#\s+(.+)$/m);
  return (m?.[1] || fallback).trim();
}

function firstParagraph(src: string, max = 220): string {
  const lines = src.split(/\r?\n/);
  const para: string[] = [];
  let started = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!started && (!line || line.startsWith("#"))) continue;
    if (started && !line) break;
    if (!line.startsWith("#")) {
      para.push(line);
      started = true;
    }
  }
  const out = para.join(" ").replace(/\s+/g, " ").trim();
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

function collectNotes(planningDir: string): NoteItem[] {
  const roots = ["notes", "docs"];
  const out: NoteItem[] = [];
  for (const root of roots) {
    const dir = path.join(planningDir, root);
    if (!fs.existsSync(dir)) continue;
    const walk = (p: string) => {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(p, e.name);
        if (e.isDirectory()) {
          walk(full);
          continue;
        }
        if (!e.isFile() || !/\.(md|mdx)$/i.test(e.name)) continue;
        const src = fs.readFileSync(full, "utf8");
        const stat = fs.statSync(full);
        const relPath = path.relative(planningDir, full).replace(/\\/g, "/");
        const base = e.name.replace(/\.(md|mdx)$/i, "");
        out.push({
          id: relPath.replace(/[^\w/-]+/g, "-"),
          title: firstHeadingOrName(src, base),
          updatedAt: stat.mtime.toISOString(),
          snippet: firstParagraph(src),
          relPath,
        });
      }
    };
    walk(dir);
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getLib() {
  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..");
  const dynamicRequire = createRequire(
    path.join(repoRoot, "lib", "package.json"),
  );
  return {
    da: dynamicRequire("./eval-data-access.cjs") as {
      resolveProject: (
        id: string,
      ) => { id: string; projectDir: string; rootId: string } | null;
    },
    taskReader: dynamicRequire("./task-registry-reader.cjs") as {
      readTasks: (
        root: { id: string; path: string; planningDir: string },
        baseDir: string,
        filter?: { status?: string; phase?: string },
      ) => unknown[];
    },
    decisionsReader: dynamicRequire("./decisions-reader.cjs") as {
      readDecisions: (
        root: { id: string; path: string; planningDir: string },
        baseDir: string,
        filter?: { id?: string },
      ) => unknown[];
    },
    roadmapReader: dynamicRequire("./roadmap-reader.cjs") as {
      readPhases: (
        root: { id: string; path: string; planningDir: string },
        baseDir: string,
      ) => unknown[];
    },
    requirementsReader: dynamicRequire("./requirements-reader.cjs") as {
      readRequirements: (
        root: { id: string; path: string; planningDir: string },
        baseDir: string,
      ) => unknown[];
    },
    stateReader: dynamicRequire("./state-reader.cjs") as {
      readState: (
        root: { id: string; path: string; planningDir: string },
        baseDir: string,
      ) => unknown;
    },
  };
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
 * Resolve a planning root object for an eval project.
 * Checks known locations: .planning/, game/.planning/
 * Returns null if no planning dir is found.
 */
function resolvePlanningRoot(
  projectId: string,
  projectDir: string,
): { root: { id: string; path: string; planningDir: string }; baseDir: string } | null {
  const candidates = [
    { path: ".", planningDir: ".planning" },
    { path: "game", planningDir: ".planning" },
  ];

  for (const c of candidates) {
    const fullPath = path.join(projectDir, c.path, c.planningDir);
    if (fs.existsSync(fullPath)) {
      return {
        root: { id: projectId, path: c.path, planningDir: c.planningDir },
        baseDir: projectDir,
      };
    }
  }
  return null;
}

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/dev/evals/projects/[id]/planning — planning data for the project */
export async function GET(_request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id } = await params;
    const lib = getLib();
    const resolved = lib.da.resolveProject(id);
    if (!resolved) {
      return new Response(
        JSON.stringify({ error: `Project "${id}" not found` }),
        { status: 404, headers: JSON_HEADERS },
      );
    }

    const planning = resolvePlanningRoot(id, resolved.projectDir);
    if (!planning) {
      return new Response(
        JSON.stringify({
          tasks: [],
          decisions: [],
          phases: [],
          requirements: [],
          state: null,
          notes: [],
        }),
        { headers: JSON_HEADERS },
      );
    }

    const { root, baseDir } = planning;
    const tasks = lib.taskReader.readTasks(root, baseDir);
    const decisions = lib.decisionsReader.readDecisions(root, baseDir);
    const phases = lib.roadmapReader.readPhases(root, baseDir);
    const requirements = lib.requirementsReader.readRequirements(root, baseDir);
    const state = lib.stateReader.readState(root, baseDir);

    // Scan .planning/notes/ and .planning/docs/ for the project
    const planningAbsDir = path.join(baseDir, root.path, root.planningDir);
    const notes = collectNotes(planningAbsDir);

    return new Response(
      JSON.stringify({ tasks, decisions, phases, requirements, state, notes }),
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
