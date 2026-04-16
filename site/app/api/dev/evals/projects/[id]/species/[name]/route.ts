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

type RouteParams = { params: Promise<{ id: string; name: string }> };

/** GET /api/dev/evals/projects/[id]/species/[name] — resolved species detail */
export async function GET(_request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id, name } = await params;
    const da = getDataAccess();
    const species = da.getSpecies(id, name);
    if (!species) {
      return new Response(
        JSON.stringify({ error: `Species "${name}" not found in project "${id}"` }),
        { status: 404, headers: JSON_HEADERS },
      );
    }

    const generations = da.listGenerations(id, name);
    return new Response(
      JSON.stringify({ ...species, generations }),
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

/** PUT /api/dev/evals/projects/[id]/species/[name] — update species fields */
export async function PUT(request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id, name } = await params;
    const body = await request.json();
    const da = getDataAccess();
    const updated = da.updateSpecies(id, name, body);
    return new Response(JSON.stringify(updated), { headers: JSON_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: JSON_HEADERS,
    });
  }
}

/** DELETE /api/dev/evals/projects/[id]/species/[name] — archive species */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id, name } = await params;
    const da = getDataAccess();
    const result = da.archiveSpecies(id, name);
    return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found") ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: JSON_HEADERS,
    });
  }
}
