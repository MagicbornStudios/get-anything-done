import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Dev-only live capture of `gad startup`, `gad snapshot`, and the discovery
 * test battery status. Runs the CLI from the repo root and writes the
 * captured stdout (verbatim) into `site/data/cli-captures.json` so the
 * planning site terminal view renders the latest output.
 *
 * Refuses unless NODE_ENV=development.
 *
 * Request body: { command: "startup" | "snapshot" | "skill-list" | "skill-show", args?: string[] }
 * Response: JSON { capture: {...}, allCaptures: [...] }
 *
 * Task 42.2-28 (findings-on-site integration).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CaptureBody = { command?: unknown; args?: unknown };

const ALLOWED_COMMANDS: Record<string, string[]> = {
  startup: ["startup"],
  snapshot: ["snapshot", "--projectid", "get-anything-done"],
  "skill-list": ["skill", "list", "--paths"],
  "skill-show": ["skill", "show"],
  "discovery-test": ["discovery-test"],
};

function isAllowedExtraArg(arg: unknown): arg is string {
  return typeof arg === "string" && /^[a-zA-Z0-9_\-./:]+$/.test(arg) && arg.length < 128;
}

function findRepoRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "bin", "gad.cjs"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(
      JSON.stringify({ error: "Dev-only endpoint. NODE_ENV must be 'development'." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  let body: CaptureBody = {};
  try {
    body = (await request.json()) as CaptureBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { command, args } = body;
  if (typeof command !== "string" || !(command in ALLOWED_COMMANDS)) {
    return new Response(
      JSON.stringify({ error: `command must be one of: ${Object.keys(ALLOWED_COMMANDS).join(", ")}` }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const extraArgs: string[] = [];
  if (Array.isArray(args)) {
    for (const a of args) {
      if (!isAllowedExtraArg(a)) {
        return new Response(
          JSON.stringify({ error: "args must be safe identifiers (alphanumeric + _-./:)" }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
      extraArgs.push(a);
    }
  }

  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    return new Response(
      JSON.stringify({ error: "Could not locate gad repo root from cwd." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const gadBin = path.join(repoRoot, "bin", "gad.cjs");
  const fullArgs = [gadBin, ...ALLOWED_COMMANDS[command], ...extraArgs];

  const result = spawnSync(process.execPath, fullArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 60_000,
    // Strip color codes in the captured output so the site terminal view
    // renders cleanly.
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });

  const capture = {
    command,
    args: extraArgs,
    full_command: `gad ${ALLOWED_COMMANDS[command].join(" ")}${extraArgs.length ? " " + extraArgs.join(" ") : ""}`,
    timestamp: new Date().toISOString(),
    exit_code: result.status ?? null,
    stdout: (result.stdout || "").replace(/\x1b\[[0-9;]*m/g, ""),
    stderr: (result.stderr || "").replace(/\x1b\[[0-9;]*m/g, ""),
  };

  // Append to site/data/cli-captures.json (cap at 20 most-recent captures
  // per command to keep the file bounded).
  const dataFile = path.join(repoRoot, "site", "data", "cli-captures.json");
  let existing: { schema_version: number; captures: typeof capture[] } = {
    schema_version: 1,
    captures: [],
  };
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    existing = JSON.parse(raw);
    if (!Array.isArray(existing.captures)) existing.captures = [];
  } catch {
    // ignore — file will be created below
  }
  existing.captures.unshift(capture);

  // Keep at most 5 captures per command, 20 total.
  const perCommandCount: Record<string, number> = {};
  existing.captures = existing.captures
    .filter((c) => {
      perCommandCount[c.command] = (perCommandCount[c.command] || 0) + 1;
      return perCommandCount[c.command] <= 5;
    })
    .slice(0, 20);

  try {
    fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2) + "\n");
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Failed to write site/data/cli-captures.json: ${(e as Error).message}` }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ capture, all_captures: existing.captures }, null, 2),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

export async function GET() {
  // Read-only surface: return the current cli-captures.json without
  // triggering a new capture.
  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    return new Response(JSON.stringify({ captures: [] }), {
      headers: { "content-type": "application/json" },
    });
  }
  const dataFile = path.join(repoRoot, "site", "data", "cli-captures.json");
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    return new Response(raw, {
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ schema_version: 1, captures: [] }), {
      headers: { "content-type": "application/json" },
    });
  }
}
