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

/** GET /api/dev/evals/projects/[id]/recipes — list all recipes */
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
    const recipes = da.listRecipes(id);
    return new Response(JSON.stringify({ recipes }), { headers: JSON_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}

/** POST /api/dev/evals/projects/[id]/recipes — create recipe OR apply recipe */
export async function POST(request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const da = getDataAccess();

    // Apply action: create a species from a recipe template
    if (body.action === "apply") {
      if (!body.recipe || !body.speciesName) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: recipe, speciesName" }),
          { status: 400, headers: JSON_HEADERS },
        );
      }
      const result = da.applyRecipe(id, body.recipe, body.speciesName);
      return new Response(JSON.stringify(result), {
        status: 201,
        headers: JSON_HEADERS,
      });
    }

    // Default action: create a new recipe
    const { slug, ...data } = body;
    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Missing required field: slug" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }
    const result = da.createRecipe(id, slug, data);
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

/** PUT /api/dev/evals/projects/[id]/recipes — update a recipe */
export async function PUT(request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id } = await params;
    const body = await request.json();
    const da = getDataAccess();

    const { slug, ...updates } = body;
    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Missing required field: slug" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }
    const result = da.updateRecipe(id, slug, updates);
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

/** DELETE /api/dev/evals/projects/[id]/recipes — delete a recipe */
export async function DELETE(request: Request, { params }: RouteParams) {
  const gate = devGate();
  if (gate) return gate;

  try {
    const { id } = await params;
    const { slug } = await request.json();
    const da = getDataAccess();

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Missing required field: slug" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }
    const result = da.deleteRecipe(id, slug);
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
