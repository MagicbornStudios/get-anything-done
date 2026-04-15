import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HitKind = "cid" | "as" | "stableCid" | "stableBandCid" | "id";

type SearchHit = {
  kind: HitKind;
  value: string;
  file: string;
  line: number;
  routePattern: string | null;
};

const ROOT_DIRS = ["app", "components"];
const FILE_RE = /\.(tsx|ts|jsx|js)$/i;
const MAX_HITS = 120;

function walkFiles(dir: string, out: string[]) {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (entry.isFile() && FILE_RE.test(entry.name)) out.push(full);
  }
}

function toRoutePatternFromAppPath(appRoot: string, filePath: string): string | null {
  if (!filePath.startsWith(appRoot)) return null;
  let dir = path.dirname(filePath);
  while (dir.startsWith(appRoot)) {
    if (fs.existsSync(path.join(dir, "page.tsx")) || fs.existsSync(path.join(dir, "page.ts"))) {
      const rel = path.relative(appRoot, dir).replace(/\\/g, "/");
      return `/${rel}`;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const TOKEN_PATTERNS: Array<{ kind: HitKind; regex: RegExp }> = [
  { kind: "cid", regex: /\bcid\s*=\s*"([^"]+)"/g },
  { kind: "as", regex: /\bas\s*=\s*"([^"]+)"/g },
  { kind: "stableCid", regex: /\bstableCid\s*=\s*"([^"]+)"/g },
  { kind: "stableBandCid", regex: /\bstableBandCid\s*=\s*"([^"]+)"/g },
  { kind: "id", regex: /\bid\s*=\s*"([^"]+)"/g },
];

function collectHits(siteRoot: string, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  const files: string[] = [];
  for (const dir of ROOT_DIRS) walkFiles(path.join(siteRoot, dir), files);
  const appRoot = path.join(siteRoot, "app");
  const hits: SearchHit[] = [];

  for (const file of files) {
    if (hits.length >= MAX_HITS) break;
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    const routePattern = toRoutePatternFromAppPath(appRoot, file);
    for (let i = 0; i < lines.length && hits.length < MAX_HITS; i++) {
      const line = lines[i] ?? "";
      const lower = line.toLowerCase();
      if (!lower.includes(q)) continue;
      for (const pattern of TOKEN_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.regex.exec(line))) {
          const value = m[1] ?? "";
          if (!value.toLowerCase().includes(q)) continue;
          hits.push({
            kind: pattern.kind,
            value,
            file: path.relative(siteRoot, file).replace(/\\/g, "/"),
            line: i + 1,
            routePattern,
          });
          if (hits.length >= MAX_HITS) break;
        }
        if (hits.length >= MAX_HITS) break;
      }
    }
  }
  return hits;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(JSON.stringify({ error: "Dev-only endpoint." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) {
    return new Response(JSON.stringify({ hits: [] }), { headers: { "content-type": "application/json" } });
  }

  const siteRoot = process.cwd();
  const hits = collectHits(siteRoot, q);
  return new Response(JSON.stringify({ hits }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

