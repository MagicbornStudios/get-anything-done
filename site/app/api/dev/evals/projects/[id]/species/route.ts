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

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/dev/evals/projects/[id]/species — list all species (resolved) */
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
    const species = da.getAllResolvedSpecies(id);
    return new Response(JSON.stringify({ species }), { headers: JSON_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}

/** POST /api/dev/evals/projects/[id]/species — create or clone a species */
export async function POST(request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const da = getDataAccess();

    if (body.cloneFrom) {
      const result = da.cloneSpecies(id, body.cloneFrom, body.name, {
        inherit: body.inherit,
        description: body.description,
      });
      return new Response(JSON.stringify(result), {
        status: 201,
        headers: JSON_HEADERS,
      });
    }

    const { name, ...data } = body;
    if (!name) {
      return new Response(
        JSON.stringify({ error: "Missing required field: name" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }
    const result = da.createSpecies(id, name, data);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: JSON_HEADERS,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("already exists") ? 409
      : message.includes("not found") ? 404
      : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: JSON_HEADERS,
    });
  }
}
