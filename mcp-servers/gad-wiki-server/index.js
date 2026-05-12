import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";

// Repo-root resolver: walk up and find the outermost directory that
// has BOTH `pnpm-workspace.yaml` AND `.planning/` AND `.git` (file or
// dir — submodules use a `.git` file, the parent repo uses a `.git` dir).
// Falls back to outermost match of the first two sentinels if no .git is
// found in any ancestor. Explicit override via `GAD_WIKI_REPO_ROOT` wins.
//
// Why so picky: the vendored GAD submodule has its own
// pnpm-workspace.yaml AND its own .planning/, and the user's home dir
// has a .planning/ too. We need the monorepo-root specifically.
function findRepoRoot(start = process.cwd()) {
  const override = process.env.GAD_WIKI_REPO_ROOT;
  if (override && fs.existsSync(override)) return path.resolve(override);
  let dir = path.resolve(start);
  let outermostStrict = null; // has pnpm + .planning + .git
  let outermostLoose = null;  // has pnpm + .planning
  for (let i = 0; i < 30; i++) {
    const hasPnpm = fs.existsSync(path.join(dir, "pnpm-workspace.yaml"));
    const hasPlanning = fs.existsSync(path.join(dir, ".planning"));
    const hasGit = fs.existsSync(path.join(dir, ".git"));
    if (hasPnpm && hasPlanning) {
      outermostLoose = dir;
      if (hasGit) outermostStrict = dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const chosen = outermostStrict || outermostLoose;
  if (chosen) return chosen;
  throw new Error("Could not find repo root (no pnpm-workspace.yaml + .planning/ match found)");
}

// Directories we never descend into.
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".next",
  "target",
  "bundle",
  "dist-bundle",
]);

// File extensions we treat as wiki documents.
const DOC_EXTS = new Set([".md", ".mdx", ".txt"]);

// 1 MB read cap for content; snippet extraction is still bounded.
const MAX_FILE_BYTES = 1024 * 1024;

// Lazy in-memory index. Each entry: { path, source, mtime, contentLower, size }.
let INDEX = null;
let INDEX_BUILT_AT = 0;
const INDEX_TTL_MS = 60 * 1000;

function walkDir(rootDir, source, out) {
  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(rootDir, ent.name);
    if (ent.isDirectory()) {
      walkDir(full, source, out);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (!DOC_EXTS.has(ext)) continue;
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      let buf;
      try {
        // Read up to MAX_FILE_BYTES; oversize files are truncated.
        const fd = fs.openSync(full, "r");
        try {
          const length = Math.min(stat.size, MAX_FILE_BYTES);
          const tmp = Buffer.alloc(length);
          fs.readSync(fd, tmp, 0, length, 0);
          buf = tmp;
        } finally {
          fs.closeSync(fd);
        }
      } catch {
        continue;
      }
      const content = buf.toString("utf8");
      out.push({
        path: full,
        source,
        mtime: stat.mtimeMs,
        size: stat.size,
        truncated: stat.size > MAX_FILE_BYTES,
        contentLower: content.toLowerCase(),
        content, // kept for snippet rendering; cheap relative to walk cost
      });
    }
  }
}

function buildSources(root) {
  const sources = [];

  // 1) repo-root .planning/notes (recursive)
  const notesDir = path.join(root, ".planning", "notes");
  if (fs.existsSync(notesDir)) {
    sources.push({ baseDir: notesDir, source: "notes" });
  }

  // 2) repo-root docs/** (md/mdx)
  const docsDir = path.join(root, "docs");
  if (fs.existsSync(docsDir)) {
    sources.push({ baseDir: docsDir, source: "docs" });
  }

  // 3) vendor/get-anything-done/.planning/notes (submodule notes)
  const gadNotesDir = path.join(root, "vendor", "get-anything-done", ".planning", "notes");
  if (fs.existsSync(gadNotesDir)) {
    sources.push({ baseDir: gadNotesDir, source: "gad-notes" });
  }

  return sources;
}

function buildIndex(root) {
  const sources = buildSources(root);
  const out = [];
  for (const s of sources) {
    walkDir(s.baseDir, s.source, out);
  }
  return { entries: out, sources };
}

function ensureIndex(root) {
  const now = Date.now();
  if (INDEX && now - INDEX_BUILT_AT < INDEX_TTL_MS) {
    return INDEX;
  }
  // Cheap mtime check on source root dirs only — if nothing changed since
  // build AND we're still within a soft window, reuse. Per spec we just
  // rebuild every TTL window; do not bother with watchers.
  INDEX = buildIndex(root);
  INDEX_BUILT_AT = now;
  return INDEX;
}

function makeSnippet(content, queryLower) {
  if (!queryLower) return content.slice(0, 200);
  const lower = content.toLowerCase();
  const idx = lower.indexOf(queryLower);
  if (idx < 0) return content.slice(0, 200);
  const start = Math.max(0, idx - 80);
  const end = Math.min(content.length, idx + queryLower.length + 120);
  let snip = content.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snip = "..." + snip;
  if (end < content.length) snip = snip + "...";
  return snip;
}

// Substring scoring: term-frequency * inverse-doc-frequency.
// For multi-word queries we split on whitespace and sum per-term scores.
// For single-word queries it collapses to TF * IDF, which is enough for v1.
function scoreEntries(entries, query) {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return [];
  const terms = queryLower.split(/\s+/).filter(Boolean);

  // doc-frequency per term
  const df = new Map();
  for (const t of terms) df.set(t, 0);
  const tfPerDoc = new Map(); // path -> Map<term, count>

  for (const e of entries) {
    const cl = e.contentLower;
    let docHasAny = false;
    const docTf = new Map();
    for (const t of terms) {
      let count = 0;
      let from = 0;
      while (true) {
        const i = cl.indexOf(t, from);
        if (i < 0) break;
        count++;
        from = i + t.length;
      }
      if (count > 0) {
        docTf.set(t, count);
        df.set(t, df.get(t) + 1);
        docHasAny = true;
      }
    }
    if (docHasAny) tfPerDoc.set(e.path, docTf);
  }

  const N = entries.length || 1;
  const results = [];
  for (const e of entries) {
    const docTf = tfPerDoc.get(e.path);
    if (!docTf) continue;
    let score = 0;
    for (const t of terms) {
      const tf = docTf.get(t) || 0;
      if (!tf) continue;
      const idf = Math.log(1 + N / (1 + (df.get(t) || 0)));
      score += tf * idf;
    }
    results.push({ entry: e, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

function relPath(root, abs) {
  return path.relative(root, abs).split(path.sep).join("/");
}

// Path-traversal guard: accept only paths that resolve under one of the
// allowed source base directories.
function resolveAllowedPath(root, requested) {
  const sources = buildSources(root);
  // Accept both absolute and repo-relative paths.
  const candidate = path.isAbsolute(requested)
    ? path.resolve(requested)
    : path.resolve(root, requested);
  const normalized = path.normalize(candidate);
  for (const s of sources) {
    const baseNorm = path.normalize(s.baseDir);
    // ensure trailing separator semantics to avoid prefix-only matches
    const baseWithSep = baseNorm.endsWith(path.sep) ? baseNorm : baseNorm + path.sep;
    if (normalized === baseNorm || normalized.startsWith(baseWithSep)) {
      return { abs: normalized, source: s.source };
    }
  }
  return null;
}

// Topic bucketing: for the flat `notes` and `gad-notes` directories,
// group by leading `YYYY-MM` of the filename. For the tree-shaped `docs`
// directory, group by the first path segment under the source root.
function topicFor(entry, root) {
  const sources = buildSources(root);
  const baseInfo = sources.find((s) => s.source === entry.source);
  if (!baseInfo) return null;
  const rel = path.relative(baseInfo.baseDir, entry.path);
  if (!rel || rel.startsWith("..")) return null;
  const parts = rel.split(path.sep);

  if (entry.source === "docs") {
    // First path segment, or filename if the doc lives at the docs root.
    if (parts.length === 1) return `${entry.source}:_root`;
    return `${entry.source}:${parts[0]}`;
  }

  // notes / gad-notes — flat-ish; bucket by YYYY-MM of filename.
  const filename = parts[parts.length - 1];
  const m = filename.match(/^(\d{4}-\d{2})/);
  if (m) return `${entry.source}:${m[1]}`;
  // Fallback: parent directory if nested, else `_misc`.
  if (parts.length > 1) return `${entry.source}:${parts[0]}`;
  return `${entry.source}:_misc`;
}

const TOOLS = [
  {
    name: "search",
    description:
      "Substring case-insensitive search across .planning/notes, docs/, and vendor/get-anything-done/.planning/notes. Returns ranked { path, source, snippet, score } entries. Scoring is TF * IDF across whitespace-split query terms.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (case-insensitive substring; whitespace-split into terms)" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_doc",
    description:
      "Fetch a single document by path. Path must resolve under one of the allowed source roots (.planning/notes, docs/, vendor/get-anything-done/.planning/notes). Returns { path, content, mtime, source }.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or repo-relative path to a document" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_topics",
    description:
      "List topic buckets across all sources. notes/gad-notes are grouped by YYYY-MM filename prefix; docs/ is grouped by first path segment. Returns array of { topic, count }.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

async function main() {
  const root = findRepoRoot();

  const server = new Server(
    { name: "gad-wiki-server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === "search") {
      const query = String(args?.query ?? "").trim();
      const limit = Number.isFinite(args?.limit) ? Math.max(1, Math.min(200, args.limit)) : 20;
      if (!query) {
        return { content: [{ type: "text", text: "query is required" }], isError: true };
      }
      const idx = ensureIndex(root);
      const ranked = scoreEntries(idx.entries, query);
      const queryLower = query.toLowerCase();
      // For snippet rendering we prefer the longest single term so the
      // snippet centers on actual evidence.
      const longestTerm = queryLower
        .split(/\s+/)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] || queryLower;
      const out = ranked.slice(0, limit).map(({ entry, score }) => ({
        path: relPath(root, entry.path),
        source: entry.source,
        snippet: makeSnippet(entry.content, longestTerm),
        score: Number(score.toFixed(4)),
      }));
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }

    if (name === "get_doc") {
      const requested = String(args?.path ?? "").trim();
      if (!requested) {
        return { content: [{ type: "text", text: "path is required" }], isError: true };
      }
      const allowed = resolveAllowedPath(root, requested);
      if (!allowed) {
        return {
          content: [{ type: "text", text: `Path not under an allowed source root: ${requested}` }],
          isError: true,
        };
      }
      let stat;
      try {
        stat = fs.statSync(allowed.abs);
      } catch (e) {
        return { content: [{ type: "text", text: `stat failed: ${e.message}` }], isError: true };
      }
      const ext = path.extname(allowed.abs).toLowerCase();
      if (!DOC_EXTS.has(ext)) {
        return {
          content: [{ type: "text", text: `Not a supported document type: ${ext}` }],
          isError: true,
        };
      }
      let content;
      try {
        if (stat.size > MAX_FILE_BYTES) {
          const fd = fs.openSync(allowed.abs, "r");
          try {
            const tmp = Buffer.alloc(MAX_FILE_BYTES);
            fs.readSync(fd, tmp, 0, MAX_FILE_BYTES, 0);
            content = tmp.toString("utf8") + "\n... [truncated]";
          } finally {
            fs.closeSync(fd);
          }
        } else {
          content = fs.readFileSync(allowed.abs, "utf8");
        }
      } catch (e) {
        return { content: [{ type: "text", text: `read failed: ${e.message}` }], isError: true };
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            path: relPath(root, allowed.abs),
            content,
            mtime: stat.mtimeMs,
            source: allowed.source,
          }, null, 2),
        }],
      };
    }

    if (name === "list_topics") {
      const idx = ensureIndex(root);
      const counts = new Map();
      for (const e of idx.entries) {
        const topic = topicFor(e, root);
        if (!topic) continue;
        counts.set(topic, (counts.get(topic) || 0) + 1);
      }
      const out = Array.from(counts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => (b.count - a.count) || a.topic.localeCompare(b.topic));
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`gad-wiki-server fatal: ${err.message}\n`);
  process.exit(1);
});
