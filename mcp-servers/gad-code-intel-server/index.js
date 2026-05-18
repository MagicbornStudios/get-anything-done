import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Repo-root resolver (same shape as gad-memory-server / gad-wiki-server).
// Override via GAD_CODE_INTEL_REPO_ROOT for tests.
// ---------------------------------------------------------------------------

function findRepoRoot(start = process.cwd()) {
  const override = process.env.GAD_CODE_INTEL_REPO_ROOT;
  if (override && fs.existsSync(override)) return path.resolve(override);
  let dir = path.resolve(start);
  let outermostStrict = null;
  let outermostLoose = null;
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
  throw new Error("Could not find repo root (no pnpm-workspace.yaml + .planning/ match)");
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 1024 * 1024; // 1 MB read cap
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  ".next",
  ".turbo",
  ".cache",
  "out",
  ".pnpm-store",
  "coverage",
  ".venv",
  "__pycache__",
  "bundle",
  "dist-bundle",
]);

const LANG_BY_EXT = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".rs": "rust",
  ".py": "python",
  ".go": "go",
  ".java": "java",
  ".rb": "ruby",
  ".php": "php",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".swift": "swift",
  ".kt": "kotlin",
  ".md": "markdown",
  ".json": "json",
  ".toml": "toml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".sh": "shell",
  ".sql": "sql",
};

function langOf(filepath) {
  return LANG_BY_EXT[path.extname(filepath).toLowerCase()] || "text";
}

// ---------------------------------------------------------------------------
// Path-escape guard (same logic as gad-memory-server)
// ---------------------------------------------------------------------------

function isInsideDir(resolvedFile, allowedDir) {
  const a = path.resolve(allowedDir);
  const f = path.resolve(resolvedFile);
  if (a === f) return true;
  const rel = path.relative(a, f);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function resolveInsideRepo(rawPath, repoRoot) {
  if (!rawPath || typeof rawPath !== "string") return null;
  const candidate = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(repoRoot, rawPath);
  if (!isInsideDir(candidate, repoRoot)) return null;
  return candidate;
}

// ---------------------------------------------------------------------------
// Ripgrep detection (CHANGE: avoid PATH-only lookups on Windows where common
// install dirs may not be on PATH inside MCP subprocess envs).
// ---------------------------------------------------------------------------

let _RG_CACHED;
function detectRipgrep() {
  if (_RG_CACHED !== undefined) return _RG_CACHED;
  const candidates = [];
  if (process.env.GAD_CODE_INTEL_RG && fs.existsSync(process.env.GAD_CODE_INTEL_RG)) {
    candidates.push(process.env.GAD_CODE_INTEL_RG);
  }
  candidates.push("rg"); // on PATH
  if (process.platform === "win32") {
    candidates.push("C:/ProgramData/chocolatey/bin/rg.exe");
    candidates.push("C:/Program Files/ripgrep/rg.exe");
    candidates.push(path.join(process.env.LOCALAPPDATA || "", "Programs/ripgrep/rg.exe"));
  } else {
    candidates.push("/usr/bin/rg", "/usr/local/bin/rg", "/opt/homebrew/bin/rg");
  }
  for (const cand of candidates) {
    try {
      const res = spawnSync(cand, ["--version"], {
        windowsHide: true,
        encoding: "utf8",
        timeout: 3000,
      });
      if (res.status === 0) {
        _RG_CACHED = cand;
        return _RG_CACHED;
      }
    } catch {
      /* try next */
    }
  }
  _RG_CACHED = null;
  return null;
}

// ---------------------------------------------------------------------------
// Search via ripgrep (preferred) with node-stdlib fallback.
//
// Returns: [{file, line, snippet, lang}]
// ---------------------------------------------------------------------------

function rgSearch(pattern, opts) {
  const { repoRoot, fileGlob, limit, fixedStrings, wordBoundary } = opts;
  const rg = detectRipgrep();
  if (!rg) return null;
  const args = [
    "--json",
    "--no-messages",
    "--max-count",
    String(Math.max(limit, 1)),
    "--max-filesize",
    "1M",
  ];
  if (fixedStrings) args.push("--fixed-strings");
  if (wordBoundary) args.push("--word-regexp");
  if (fileGlob) args.push("--glob", fileGlob);
  // exclude common heavy dirs (ripgrep already respects .gitignore; reinforce)
  for (const d of SKIP_DIRS) args.push("--glob", `!${d}/**`);
  args.push("--", pattern, ".");

  const res = spawnSync(rg, args, {
    cwd: repoRoot,
    windowsHide: true,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 15000,
  });
  // status 0 = matches, 1 = no matches, 2 = some non-fatal errors (e.g. unreadable file
  // in a sub-tree, glob that excluded missing dirs, UTF errors). rg still emits valid
  // match events to stdout on status 2 — treat as success when stdout has content.
  if (res.error) return null;
  if (res.status !== 0 && res.status !== 1 && res.status !== 2) {
    return null;
  }
  if (res.status === 2 && !res.stdout) return null;
  const out = [];
  if (!res.stdout) return out;
  for (const line of res.stdout.split(/\r?\n/)) {
    if (!line) continue;
    if (out.length >= limit) break;
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (evt.type !== "match") continue;
    const d = evt.data;
    const filePath = d?.path?.text || d?.path?.bytes;
    if (!filePath) continue;
    const absFile = path.resolve(repoRoot, filePath);
    const lineNo = d.line_number;
    const text = d?.lines?.text ?? "";
    out.push({
      file: path.relative(repoRoot, absFile).replace(/\\/g, "/"),
      line: lineNo,
      snippet: text.replace(/\r?\n$/, "").slice(0, 400),
      lang: langOf(absFile),
    });
  }
  return out;
}

function globMatchesFile(filePath, glob) {
  if (!glob) return true;
  // Minimal glob: support *.ext, **/*.ext, dir/**, **/dir/*.ext patterns.
  const re = globToRegex(glob);
  const rel = filePath.replace(/\\/g, "/");
  return re.test(rel);
}

function globToRegex(glob) {
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      // **/ → match any path prefix; ** alone → match anything
      if (glob[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 3;
      } else {
        re += ".*";
        i += 2;
      }
      continue;
    }
    if (c === "*") {
      re += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      re += "[^/]";
      i += 1;
      continue;
    }
    if (".+^$|()[]{}\\".includes(c)) {
      re += "\\" + c;
      i += 1;
      continue;
    }
    re += c;
    i += 1;
  }
  return new RegExp("^" + re + "$");
}

function walkFiles(rootDir, opts) {
  const { include = null, limit = Infinity, onFile } = opts;
  const stack = [rootDir];
  let count = 0;
  while (stack.length > 0 && count < limit) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile()) {
        const rel = path.relative(rootDir, full).replace(/\\/g, "/");
        if (include && !include(rel)) continue;
        const cont = onFile(full, rel);
        count += 1;
        if (cont === false || count >= limit) return count;
      }
    }
  }
  return count;
}

function fallbackSearch(pattern, opts) {
  const { repoRoot, fileGlob, limit, fixedStrings, wordBoundary } = opts;
  const flags = "g";
  let re;
  try {
    if (fixedStrings) {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wrapped = wordBoundary ? `\\b${escaped}\\b` : escaped;
      re = new RegExp(wrapped, flags);
    } else {
      const wrapped = wordBoundary ? `\\b(?:${pattern})\\b` : pattern;
      re = new RegExp(wrapped, flags);
    }
  } catch {
    return [];
  }
  const include = fileGlob ? (rel) => globMatchesFile(rel, fileGlob) : null;
  const out = [];
  walkFiles(repoRoot, {
    include,
    limit: 5000, // hard ceiling on files scanned
    onFile: (full, rel) => {
      if (out.length >= limit) return false;
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        return true;
      }
      if (stat.size > MAX_FILE_BYTES) return true;
      let content;
      try {
        content = fs.readFileSync(full, "utf8");
      } catch {
        return true;
      }
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        if (re.test(lines[i])) {
          out.push({
            file: rel,
            line: i + 1,
            snippet: lines[i].slice(0, 400),
            lang: langOf(full),
          });
          if (out.length >= limit) return false;
        }
        re.lastIndex = 0;
      }
      return true;
    },
  });
  return out;
}

function searchCode(pattern, opts) {
  const rgResult = rgSearch(pattern, opts);
  if (rgResult !== null) return { results: rgResult, engine: "ripgrep" };
  return { results: fallbackSearch(pattern, opts), engine: "node-fallback" };
}

// ---------------------------------------------------------------------------
// Definition heuristic: regex per language.
// ---------------------------------------------------------------------------

const DEFINITION_PATTERNS = [
  // js / ts
  { lang: "js/ts", pattern: (sym) =>
      `(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+${sym}\\b|` +
      `(?:export\\s+)?(?:abstract\\s+)?class\\s+${sym}\\b|` +
      `(?:export\\s+)?interface\\s+${sym}\\b|` +
      `(?:export\\s+)?type\\s+${sym}\\b|` +
      `(?:export\\s+)?enum\\s+${sym}\\b|` +
      `(?:export\\s+)?(?:const|let|var)\\s+${sym}\\b`,
    kind: "ts/js definition",
  },
  // rust
  { lang: "rust", pattern: (sym) =>
      `(?:pub\\s+)?(?:async\\s+)?fn\\s+${sym}\\b|` +
      `(?:pub\\s+)?struct\\s+${sym}\\b|` +
      `(?:pub\\s+)?enum\\s+${sym}\\b|` +
      `(?:pub\\s+)?trait\\s+${sym}\\b|` +
      `(?:pub\\s+)?const\\s+${sym}\\b|` +
      `(?:pub\\s+)?static\\s+${sym}\\b|` +
      `(?:pub\\s+)?(?:type)\\s+${sym}\\b`,
    kind: "rust definition",
  },
  // python
  { lang: "python", pattern: (sym) =>
      `def\\s+${sym}\\b|class\\s+${sym}\\b|^${sym}\\s*=`,
    kind: "python definition",
  },
  // go
  { lang: "go", pattern: (sym) =>
      `func\\s+(?:\\([^)]*\\)\\s+)?${sym}\\b|` +
      `type\\s+${sym}\\b|` +
      `var\\s+${sym}\\b|` +
      `const\\s+${sym}\\b`,
    kind: "go definition",
  },
];

function findDefinition(symbol, opts) {
  const out = [];
  for (const pat of DEFINITION_PATTERNS) {
    const re = pat.pattern(symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const { results } = searchCode(re, {
      repoRoot: opts.repoRoot,
      fileGlob: opts.fileGlob,
      limit: 50,
      fixedStrings: false,
      wordBoundary: false,
    });
    for (const r of results) {
      out.push({
        file: r.file,
        line: r.line,
        kind: pat.kind,
        snippet: r.snippet,
        lang: r.lang,
      });
    }
  }
  // dedupe by file:line
  const seen = new Set();
  return out.filter((r) => {
    const key = `${r.file}:${r.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Imports parser
// ---------------------------------------------------------------------------

function parseImports(filepath, repoRoot) {
  const lang = langOf(filepath);
  let content;
  try {
    const stat = fs.statSync(filepath);
    if (stat.size > MAX_FILE_BYTES) return [];
    content = fs.readFileSync(filepath, "utf8");
  } catch {
    return [];
  }
  const lines = content.split(/\r?\n/);
  const out = [];

  const tsJsImport = /^\s*import\s+(?:[^;'"]+\s+from\s+)?['"]([^'"]+)['"]/;
  const tsJsRequire = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/;
  const tsJsExportFrom = /^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/;
  const rustUse = /^\s*(?:pub\s+)?use\s+([^;]+);/;
  const pyImport = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/;
  const pyFrom = /^\s*from\s+([\w.]+)\s+import\s+/;
  const goImport = /^\s*import\s+"([^"]+)"/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let m;
    if (lang === "typescript" || lang === "javascript") {
      if ((m = line.match(tsJsImport))) {
        out.push({ module: m[1], kind: "import", line: i + 1 });
        continue;
      }
      if ((m = line.match(tsJsExportFrom))) {
        out.push({ module: m[1], kind: "export-from", line: i + 1 });
        continue;
      }
      if ((m = line.match(tsJsRequire))) {
        out.push({ module: m[1], kind: "require", line: i + 1 });
      }
    } else if (lang === "rust") {
      if ((m = line.match(rustUse))) {
        out.push({ module: m[1].trim(), kind: "use", line: i + 1 });
      }
    } else if (lang === "python") {
      if ((m = line.match(pyFrom))) {
        out.push({ module: m[1], kind: "from-import", line: i + 1 });
        continue;
      }
      if ((m = line.match(pyImport))) {
        for (const mod of m[1].split(",")) {
          out.push({ module: mod.trim(), kind: "import", line: i + 1 });
        }
      }
    } else if (lang === "go") {
      if ((m = line.match(goImport))) {
        out.push({ module: m[1], kind: "import", line: i + 1 });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tool defs
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "search_code",
    description:
      "Search code via ripgrep (regex by default, with node-stdlib fallback). Returns up to `limit` matches with file/line/snippet/lang.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search pattern (regex)" },
        file_glob: { type: "string", description: "Optional file glob (e.g. '**/*.ts')" },
        limit: { type: "number", description: "Max results (default 50, cap 500)" },
        fixed_strings: { type: "boolean", description: "Treat query as literal (default false)" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_files",
    description:
      "Walk the repo and return files matching an optional glob. Honors common ignore dirs (node_modules, dist, target, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional subpath inside the repo (defaults to repo root)" },
        glob: { type: "string", description: "Optional file glob filter" },
        limit: { type: "number", description: "Max files (default 100, cap 1000)" },
      },
      required: [],
    },
  },
  {
    name: "read_file",
    description:
      "Read a file inside the repo, optionally bounded by [start_line, end_line] (1-indexed, inclusive). 1 MB cap.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative or absolute path inside the repo" },
        start_line: { type: "number", description: "1-indexed start line (inclusive)" },
        end_line: { type: "number", description: "1-indexed end line (inclusive)" },
      },
      required: ["path"],
    },
  },
  {
    name: "find_definition",
    description:
      "Regex-based definition heuristic across js/ts/rust/python/go. Returns matches keyed by language. Lightweight — does NOT spawn an LSP.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Symbol to look up" },
        file_glob: { type: "string", description: "Optional file glob filter" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "find_references",
    description:
      "Word-boundary search for `symbol`. Capped at 200 results. Use search_code with regex for richer queries.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Symbol to look up" },
        file_glob: { type: "string", description: "Optional file glob filter" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "list_imports",
    description:
      "Parse import/require/use/from lines for a single file. Supports ts/js, rust, python, go.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Repo-relative or absolute path inside the repo" },
      },
      required: ["file"],
    },
  },
];

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

async function main() {
  const repoRoot = findRepoRoot();
  const rgPath = detectRipgrep();

  const server = new Server(
    { name: "gad-code-intel-server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === "search_code") {
      const query = args?.query;
      if (!query || typeof query !== "string") {
        return { content: [{ type: "text", text: "query is required" }], isError: true };
      }
      const limitRaw = Number(args?.limit ?? 50);
      const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 500);
      const fileGlob = typeof args?.file_glob === "string" ? args.file_glob : null;
      const fixedStrings = Boolean(args?.fixed_strings);
      const { results, engine } = searchCode(query, {
        repoRoot,
        fileGlob,
        limit,
        fixedStrings,
        wordBoundary: false,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ engine, count: results.length, results }, null, 2) }],
      };
    }

    if (name === "list_files") {
      const subPath = typeof args?.path === "string" ? args.path : null;
      const glob = typeof args?.glob === "string" ? args.glob : null;
      const limitRaw = Number(args?.limit ?? 100);
      const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 1000);
      let scanRoot = repoRoot;
      if (subPath) {
        const resolved = resolveInsideRepo(subPath, repoRoot);
        if (!resolved) {
          return {
            content: [{ type: "text", text: `Path escapes repo root: ${subPath}` }],
            isError: true,
          };
        }
        scanRoot = resolved;
      }
      const files = [];
      walkFiles(scanRoot, {
        include: glob ? (rel) => globMatchesFile(rel, glob) : null,
        limit,
        onFile: (full, rel) => {
          let stat;
          try {
            stat = fs.statSync(full);
          } catch {
            return true;
          }
          files.push({
            path: path.relative(repoRoot, full).replace(/\\/g, "/"),
            sizeBytes: stat.size,
            mtime: stat.mtime.toISOString(),
            lang: langOf(full),
          });
          if (files.length >= limit) return false;
          return true;
        },
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ count: files.length, files }, null, 2) }],
      };
    }

    if (name === "read_file") {
      const rawPath = args?.path;
      const resolved = resolveInsideRepo(rawPath, repoRoot);
      if (!resolved) {
        return {
          content: [{ type: "text", text: `Path escapes repo root or invalid: ${rawPath}` }],
          isError: true,
        };
      }
      let stat;
      try {
        stat = fs.statSync(resolved);
      } catch {
        return { content: [{ type: "text", text: `File not found: ${rawPath}` }], isError: true };
      }
      if (!stat.isFile()) {
        return { content: [{ type: "text", text: `Not a file: ${rawPath}` }], isError: true };
      }
      if (stat.size > MAX_FILE_BYTES) {
        return {
          content: [{ type: "text", text: `File too large (${stat.size} bytes; cap ${MAX_FILE_BYTES})` }],
          isError: true,
        };
      }
      let content;
      try {
        content = fs.readFileSync(resolved, "utf8");
      } catch (err) {
        return { content: [{ type: "text", text: `Read failed: ${err.message}` }], isError: true };
      }
      const lines = content.split(/\r?\n/);
      const totalLines = lines.length;
      const startLineRaw = Number(args?.start_line);
      const endLineRaw = Number(args?.end_line);
      const hasRange = Number.isFinite(startLineRaw) || Number.isFinite(endLineRaw);
      let outContent = content;
      let outStart = 1;
      let outEnd = totalLines;
      if (hasRange) {
        outStart = Math.max(1, Number.isFinite(startLineRaw) ? Math.floor(startLineRaw) : 1);
        outEnd = Math.min(totalLines, Number.isFinite(endLineRaw) ? Math.floor(endLineRaw) : totalLines);
        if (outEnd < outStart) outEnd = outStart;
        outContent = lines.slice(outStart - 1, outEnd).join("\n");
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            path: path.relative(repoRoot, resolved).replace(/\\/g, "/"),
            content: outContent,
            lang: langOf(resolved),
            total_lines: totalLines,
            start_line: outStart,
            end_line: outEnd,
          }, null, 2),
        }],
      };
    }

    if (name === "find_definition") {
      const symbol = args?.symbol;
      if (!symbol || typeof symbol !== "string") {
        return { content: [{ type: "text", text: "symbol is required" }], isError: true };
      }
      const fileGlob = typeof args?.file_glob === "string" ? args.file_glob : null;
      const results = findDefinition(symbol, { repoRoot, fileGlob });
      return {
        content: [{ type: "text", text: JSON.stringify({ count: results.length, results }, null, 2) }],
      };
    }

    if (name === "find_references") {
      const symbol = args?.symbol;
      if (!symbol || typeof symbol !== "string") {
        return { content: [{ type: "text", text: "symbol is required" }], isError: true };
      }
      const fileGlob = typeof args?.file_glob === "string" ? args.file_glob : null;
      const { results, engine } = searchCode(symbol, {
        repoRoot,
        fileGlob,
        limit: 200,
        fixedStrings: true,
        wordBoundary: true,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ engine, count: results.length, results }, null, 2) }],
      };
    }

    if (name === "list_imports") {
      const rawPath = args?.file;
      const resolved = resolveInsideRepo(rawPath, repoRoot);
      if (!resolved) {
        return {
          content: [{ type: "text", text: `Path escapes repo root or invalid: ${rawPath}` }],
          isError: true,
        };
      }
      let stat;
      try {
        stat = fs.statSync(resolved);
      } catch {
        return { content: [{ type: "text", text: `File not found: ${rawPath}` }], isError: true };
      }
      if (!stat.isFile()) {
        return { content: [{ type: "text", text: `Not a file: ${rawPath}` }], isError: true };
      }
      const imports = parseImports(resolved, repoRoot);
      return {
        content: [{ type: "text", text: JSON.stringify({
          path: path.relative(repoRoot, resolved).replace(/\\/g, "/"),
          lang: langOf(resolved),
          count: imports.length,
          imports,
        }, null, 2) }],
      };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  });

  // Expose detected engine on stderr for diagnostics (matches other servers' shape).
  process.stderr.write(
    `gad-code-intel: repo=${repoRoot} rg=${rgPath || "<not-found, using node fallback>"}\n`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`gad-code-intel-server fatal: ${err.message}\n`);
  process.exit(1);
});
