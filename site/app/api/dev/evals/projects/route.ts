import { createRequire } from "node:module";
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

/** GET /api/dev/evals/projects — list all projects with summaries */
export async function GET() {
  const gate = devGate();
  if (gate) return gate;

  try {
    const da = getDataAccess();
    const summaries = da.listProjectSummaries();
    return new Response(JSON.stringify({ projects: summaries }), {
      headers: JSON_HEADERS,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}

/** POST /api/dev/evals/projects — create a new project */
export async function POST(request: Request) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: id" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const da = getDataAccess();
    const result = da.createProject(id, data, { rootId: body.rootId });
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: JSON_HEADERS,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("already exists") ? 409 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: JSON_HEADERS,
    });
  }
}
