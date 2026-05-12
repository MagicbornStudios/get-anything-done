import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import os from "os";

// Repo-root resolver: walk up until pnpm-workspace.yaml or .planning/ found
function findRepoRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (let i = 0; i < 20; i++) {
    if (
      fs.existsSync(path.join(dir, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(dir, ".planning"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find repo root (no pnpm-workspace.yaml or .planning/ found)");
}

// REDACT sensitive keys from objects (kept symmetric with gad-state-server)
const REDACT_PATTERN = /(_KEY|_TOKEN|Authorization|api_key|secret|password)/i;

function redactObj(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(redactObj);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_PATTERN.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactObj(v);
    }
  }
  return out;
}

// Inline-content redaction — scrub bearer/key-shaped strings in note bodies
const REDACT_INLINE_PATTERNS = [
  /(?:sk-(?:ant|proj|live|test)?[-_][A-Za-z0-9-_]{16,})/g, // anthropic / openai-style
  /(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,})/g, // JWT
  /(?:ghp_[A-Za-z0-9]{20,})/g, // github personal access token
  /(?:Bearer\s+[A-Za-z0-9._-]{20,})/gi, // bearer token in plaintext
];

function redactInline(text) {
  if (typeof text !== "string") return text;
  let out = text;
  for (const re of REDACT_INLINE_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

// Slugify an absolute path the way Claude Code does:
//   - replace ":" with "-"  (drive letter colon → dash)
//   - replace "\" and "/" with "-"
//   - replace "_" with "-"  (Claude normalizes underscores in repo names)
// Example: C:\Users\benja\Documents\custom_portfolio
//          → C--Users-benja-Documents-custom-portfolio
function repoSlugForPath(absPath) {
  return absPath
    .replace(/:/g, "-")
    .replace(/[\\/]/g, "-")
    .replace(/_/g, "-");
}

// Resolve the Claude auto-memory directory for the current repo.
function findMemoryDir(repoRoot) {
  const slug = repoSlugForPath(repoRoot);
  const candidate = path.join(os.homedir(), ".claude", "projects", slug, "memory");
  if (fs.existsSync(candidate)) return candidate;
  // Fallback — search ~/.claude/projects for a dir matching basename
  const projectsRoot = path.join(os.homedir(), ".claude", "projects");
  if (fs.existsSync(projectsRoot)) {
    try {
      const base = path.basename(repoRoot).toLowerCase();
      for (const entry of fs.readdirSync(projectsRoot)) {
        if (entry.toLowerCase().includes(base)) {
          const mem = path.join(projectsRoot, entry, "memory");
          if (fs.existsSync(mem)) return mem;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return candidate; // return canonical even if missing — read-handlers will error gracefully
}

function listMarkdownFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

function safeStat(filepath) {
  try {
    return fs.statSync(filepath);
  } catch {
    return null;
  }
}

function safeRead(filepath) {
  try {
    return fs.readFileSync(filepath, "utf8");
  } catch {
    return null;
  }
}

function extractTitle(content) {
  if (!content) return null;
  // First markdown H1
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function parseFrontmatter(content) {
  if (!content) return { frontmatter: null, body: content ?? "" };
  if (!content.startsWith("---")) return { frontmatter: null, body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: null, body: content };
  const fmRaw = content.slice(3, end).trim();
  const body = content.slice(end + 4).replace(/^\n/, "");
  const fm = {};
  for (const line of fmRaw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return { frontmatter: fm, body };
}

function normalizeSlug(slug) {
  if (!slug) return slug;
  return slug.endsWith(".md") ? slug : `${slug}.md`;
}

// Confirm resolved file path lives inside an allowed directory (path-escape guard)
function isInsideDir(resolvedFile, allowedDir) {
  const a = path.resolve(allowedDir);
  const f = path.resolve(resolvedFile);
  const rel = path.relative(a, f);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

const TOOLS = [
  {
    name: "list_notes",
    description:
      "List all markdown notes under .planning/notes/. Optional substring filter on filename.",
    inputSchema: {
      type: "object",
      properties: {
        glob: {
          type: "string",
          description: "Optional case-insensitive substring filter on the filename",
        },
      },
      required: [],
    },
  },
  {
    name: "search_notes",
    description:
      "Case-insensitive substring search across all notes. Returns path + 200-char snippet around match.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring to search for (case-insensitive)" },
        limit: { type: "number", description: "Max results to return (default 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_note",
    description:
      "Read a single note. Accepts either a path relative to .planning/notes/ or an absolute path inside it. Rejects paths outside the notes dir.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Filename, slug (with or without .md), relative path under notes/, or absolute path inside notes/",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_memories",
    description:
      "List Claude auto-memory files for this repo (~/.claude/projects/<slug>/memory/). Description pulled from YAML frontmatter when present.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_memory",
    description:
      "Read a single auto-memory file by slug (with or without .md). Returns content, parsed frontmatter, and mtime.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Memory file slug, with or without .md extension" },
      },
      required: ["slug"],
    },
  },
];

async function main() {
  const root = findRepoRoot();
  const notesDir = path.join(root, ".planning", "notes");
  const memoryDir = findMemoryDir(root);

  const server = new Server(
    { name: "gad-memory-server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === "list_notes") {
      const filterRaw = args?.glob;
      const filter = typeof filterRaw === "string" ? filterRaw.toLowerCase() : null;
      const files = listMarkdownFiles(notesDir);
      const rows = [];
      for (const f of files) {
        if (filter && !f.toLowerCase().includes(filter)) continue;
        const full = path.join(notesDir, f);
        const stat = safeStat(full);
        if (!stat) continue;
        const content = safeRead(full);
        rows.push({
          path: f,
          mtime: stat.mtime.toISOString(),
          sizeBytes: stat.size,
          title: extractTitle(content),
        });
      }
      rows.sort((a, b) => (a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0));
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }

    if (name === "search_notes") {
      const query = args?.query;
      const limit = args?.limit ?? 20;
      if (!query || typeof query !== "string") {
        return {
          content: [{ type: "text", text: "query is required" }],
          isError: true,
        };
      }
      const needle = query.toLowerCase();
      const files = listMarkdownFiles(notesDir);
      const hits = [];
      for (const f of files) {
        const full = path.join(notesDir, f);
        const content = safeRead(full);
        if (!content) continue;
        const lower = content.toLowerCase();
        let idx = 0;
        let count = 0;
        while ((idx = lower.indexOf(needle, idx)) !== -1) {
          count += 1;
          if (count === 1) {
            const start = Math.max(0, idx - 100);
            const end = Math.min(content.length, idx + needle.length + 100);
            const snippet = redactInline(content.slice(start, end).replace(/\s+/g, " ").trim());
            hits.push({ path: f, snippet, score: 0 });
          }
          idx += needle.length;
        }
        if (count > 0) {
          hits[hits.length - 1].score = count;
        }
      }
      hits.sort((a, b) => b.score - a.score);
      return {
        content: [{ type: "text", text: JSON.stringify(hits.slice(0, limit), null, 2) }],
      };
    }

    if (name === "get_note") {
      const raw = args?.path;
      if (!raw || typeof raw !== "string") {
        return { content: [{ type: "text", text: "path is required" }], isError: true };
      }
      let candidate;
      if (path.isAbsolute(raw)) {
        candidate = path.resolve(raw);
      } else {
        const withExt = raw.endsWith(".md") ? raw : `${raw}.md`;
        candidate = path.resolve(notesDir, withExt);
      }
      if (!isInsideDir(candidate, notesDir)) {
        return {
          content: [{ type: "text", text: `Path escapes notes dir: ${raw}` }],
          isError: true,
        };
      }
      const stat = safeStat(candidate);
      if (!stat || !stat.isFile()) {
        return {
          content: [{ type: "text", text: `Note not found: ${raw}` }],
          isError: true,
        };
      }
      const content = safeRead(candidate);
      const result = {
        path: path.relative(notesDir, candidate).replace(/\\/g, "/"),
        content: redactInline(content ?? ""),
        mtime: stat.mtime.toISOString(),
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "list_memories") {
      const files = listMarkdownFiles(memoryDir);
      const rows = [];
      for (const f of files) {
        const full = path.join(memoryDir, f);
        const stat = safeStat(full);
        if (!stat) continue;
        const content = safeRead(full);
        const { frontmatter } = parseFrontmatter(content ?? "");
        rows.push({
          slug: f.replace(/\.md$/, ""),
          mtime: stat.mtime.toISOString(),
          sizeBytes: stat.size,
          description: frontmatter?.description ?? null,
        });
      }
      rows.sort((a, b) => (a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0));
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }

    if (name === "get_memory") {
      const slugRaw = args?.slug;
      if (!slugRaw || typeof slugRaw !== "string") {
        return { content: [{ type: "text", text: "slug is required" }], isError: true };
      }
      const filename = normalizeSlug(slugRaw);
      const candidate = path.resolve(memoryDir, filename);
      if (!isInsideDir(candidate, memoryDir)) {
        return {
          content: [{ type: "text", text: `Slug escapes memory dir: ${slugRaw}` }],
          isError: true,
        };
      }
      const stat = safeStat(candidate);
      if (!stat || !stat.isFile()) {
        return {
          content: [{ type: "text", text: `Memory not found: ${slugRaw}` }],
          isError: true,
        };
      }
      const content = safeRead(candidate) ?? "";
      const { frontmatter, body } = parseFrontmatter(content);
      const result = {
        slug: filename.replace(/\.md$/, ""),
        content: redactInline(body),
        frontmatter: frontmatter ? redactObj(frontmatter) : null,
        mtime: stat.mtime.toISOString(),
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`gad-memory-server fatal: ${err.message}\n`);
  process.exit(1);
});
