import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getDataAccess() {
  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..");
  const dynamicRequire = createRequire(
    path.join(repoRoot, "lib", "package.json"),
  );
  return dynamicRequire("./eval-data-access.cjs") as {
    resolveProject: (
      id: string,
    ) => { id: string; projectDir: string; rootId: string } | null;
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

interface SelfEvalData {
  stats?: Record<string, unknown>;
  recentActivity?: unknown[];
  [key: string]: unknown;
}

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/dev/evals/projects/[id]/system — self-eval and system data */
export async function GET(_request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id } = await params;
    const da = getDataAccess();
    const resolved = da.resolveProject(id);
    if (!resolved) {
      return new Response(
        JSON.stringify({ error: `Project "${id}" not found` }),
        { status: 404, headers: JSON_HEADERS },
      );
    }

    const selfEvalPath = path.join(resolved.projectDir, "self-eval.json");
    let data: SelfEvalData = { stats: {}, recentActivity: [] };

    if (fs.existsSync(selfEvalPath)) {
      try {
        const raw = fs.readFileSync(selfEvalPath, "utf8");
        const parsed = JSON.parse(raw) as SelfEvalData;
        data = {
          stats: parsed.stats ?? parsed,
          recentActivity: parsed.recentActivity ?? [],
        };
      } catch {
        // Malformed JSON — return empty defaults
      }
    }

    return new Response(
      JSON.stringify({ stats: data.stats, recentActivity: data.recentActivity }),
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
