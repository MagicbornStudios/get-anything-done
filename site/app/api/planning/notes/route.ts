import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NoteItem = {
  id: string;
  title: string;
  updatedAt: string;
  snippet: string;
  relPath: string;
};

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

export async function GET() {
  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..");
  const planningDir = path.join(repoRoot, ".planning");
  if (!fs.existsSync(planningDir)) {
    return Response.json({ notes: [] as NoteItem[] });
  }
  return Response.json({ notes: collectNotes(planningDir) });
}

