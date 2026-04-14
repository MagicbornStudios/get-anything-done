import { NextResponse } from "next/server";

/**
 * Dev-only stub for the phase-44.5 command bridge.
 * Returns the resolved `gad eval run` command for a project/species.
 * Refuses unless NODE_ENV=development so it cannot ship to prod.
 * Real child_process execution lands in task 44.5-02.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Dev-only endpoint. NODE_ENV must be 'development'." },
      { status: 403 },
    );
  }

  let body: { projectId?: string; species?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { projectId, species } = body;
  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId required." }, { status: 400 });
  }

  const args = ["eval", "run", "--project", projectId];
  if (species && typeof species === "string") {
    args.push("--species", species);
  }
  args.push("--execute");

  const command = `gad ${args.join(" ")}`;
  console.log(`[launch-eval stub] would exec: ${command}`);

  return NextResponse.json({
    ok: true,
    command,
    note: "Stub — phase 44.5-02 will replace this with a real child_process bridge.",
  });
}
