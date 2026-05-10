'use strict';
/**
 * gad env web — localhost env management surface (operator UX 2026-05-10).
 *
 * Replaces the original textarea-only paste form with a schema-driven editor:
 *   - per-project view (reads .env.example from each gad-config root)
 *   - per-environment view (local | development | production)
 *   - per-variable input rows with reveal/hide + paste-to-distribute
 *   - bulk-paste textarea that parses and fills inputs
 *   - save writes only the active env file
 *
 * Operator vision: "these need to be proper input components much like how
 * payloadcms and vercel and supabase have input elements and the copy paste
 * ability parsing the .env text from var_name=value in to the respecting
 * inputs. and then saving. we should have local and prod environments we
 * can swap and set here in this."
 *
 * Schema discovery: for each [[planning.roots]] in root gad-config.toml,
 * scan for .env.example at the root path, and at apps/*\/ inside it. Each
 * found file becomes a "schema source" the operator can pick from.
 *
 * Value reading: reads `.env.local` / `.env.production` / `.env.development`
 * adjacent to the schema source. Mask flag in API response is advisory only;
 * raw values are still returned so the UI can populate inputs (they're going
 * to localhost anyway).
 *
 * No coupling to lib/env-cli.cjs (deny-listed for claude-code lane). Pure
 * node:http + node:fs + node:path. The encrypted gad secret store is a
 * separate path the operator can use via `gad env set` directly.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { defineCommand } = require('citty');

// ─── Path helpers ────────────────────────────────────────────────────────────

function findRepoRoot(start) {
  let dir = start || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'gad-config.toml'))) return dir;
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return start || process.cwd();
}

// ─── gad-config.toml roots reader ────────────────────────────────────────────
// Tiny, dependency-free TOML subset parser sufficient for [[planning.roots]]
// entries with `id` + `path` fields. Doesn't try to be a full TOML parser.

function readPlanningRoots(repoRoot) {
  const cfgPath = path.join(repoRoot, 'gad-config.toml');
  if (!fs.existsSync(cfgPath)) return [{ id: 'global', path: '.', absolute: repoRoot }];
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const roots = [];
  let cur = null;
  let inSection = false;
  let sectionMatchesRoots = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const sectionMatch = trimmed.match(/^\[\[\s*([\w.]+)\s*\]\]$/);
    if (sectionMatch) {
      if (cur && sectionMatchesRoots) roots.push(cur);
      cur = {};
      inSection = true;
      sectionMatchesRoots = sectionMatch[1] === 'planning.roots' || sectionMatch[1] === 'planning.sections';
      continue;
    }
    if (trimmed.startsWith('[') && !trimmed.startsWith('[[')) {
      if (cur && sectionMatchesRoots) roots.push(cur);
      cur = null;
      inSection = false;
      sectionMatchesRoots = false;
      continue;
    }
    if (inSection && cur) {
      const m = trimmed.match(/^([\w_]+)\s*=\s*(.+?)\s*$/);
      if (m) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        cur[m[1]] = v;
      }
    }
  }
  if (cur && sectionMatchesRoots) roots.push(cur);

  // Resolve absolute paths.
  const out = roots
    .filter((r) => r && r.id && (r.path !== undefined))
    .map((r) => ({ id: r.id, path: r.path, absolute: path.resolve(repoRoot, r.path) }));

  // Ensure a 'global' entry exists for the monorepo root (some configs use
  // [[planning.sections]] for the root and [[planning.roots]] for subprojects).
  if (!out.find((r) => r.id === 'global')) {
    out.unshift({ id: 'global', path: '.', absolute: repoRoot });
  }
  return out;
}

// ─── Schema discovery ────────────────────────────────────────────────────────
// For each project root, look for .env.example files. Three search patterns:
//   1. <root>/.env.example
//   2. <root>/apps/*/.env.example
//   3. <root>/packages/*/.env.example   (only if the package is an app shell)
//
// Each found file becomes one "source" with a relative-path id.

function discoverEnvExamples(rootAbsPath) {
  const sources = [];
  const tryAdd = (absPath) => {
    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      sources.push({
        absPath,
        relPath: path.relative(rootAbsPath, absPath).replace(/\\/g, '/'),
      });
    }
  };

  tryAdd(path.join(rootAbsPath, '.env.example'));

  const appsDir = path.join(rootAbsPath, 'apps');
  if (fs.existsSync(appsDir) && fs.statSync(appsDir).isDirectory()) {
    for (const entry of fs.readdirSync(appsDir)) {
      tryAdd(path.join(appsDir, entry, '.env.example'));
    }
  }
  return sources;
}

// ─── .env.example parser ─────────────────────────────────────────────────────
// Pulls out:
//   - section banners (multi-line `# === Section ===` blocks)
//   - per-variable description (consecutive `# ...` lines immediately above)
//   - variable line `KEY=default-value`
//   - categories from `[TAG]` markers in the description
//
// Output: { sections: [{ name, vars: [{ key, defaultValue, description, categories }] }] }

function parseEnvExample(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let curSection = { name: '', vars: [] };
  sections.push(curSection);

  let pendingComments = [];
  let lastWasBanner = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Banner detection: a line of `=` after `#` chars opens or closes a banner.
    // Title is taken from the first `# Title` line inside the banner.
    if (trimmed.match(/^#\s*=+\s*$/)) {
      if (!lastWasBanner) {
        // Opening banner — collect the title from the next # line.
        const title = (lines[i + 1] || '').replace(/^\s*#\s*/, '').trim();
        if (title && !title.match(/^=+$/)) {
          if (curSection.vars.length > 0 || curSection.name) {
            curSection = { name: title, vars: [] };
            sections.push(curSection);
          } else {
            curSection.name = title;
          }
        }
        lastWasBanner = true;
      } else {
        // Closing banner.
        lastWasBanner = false;
        pendingComments = [];
      }
      continue;
    }
    if (lastWasBanner) {
      // Skip lines inside banner (the title was already captured above).
      if (trimmed === '' || trimmed.match(/^#\s*=+/)) {
        if (trimmed === '') lastWasBanner = false;
      }
      continue;
    }

    if (trimmed === '') {
      pendingComments = [];
      continue;
    }
    if (trimmed.startsWith('#')) {
      pendingComments.push(trimmed.replace(/^#\s?/, ''));
      continue;
    }
    const m = trimmed.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) {
      pendingComments = [];
      continue;
    }
    let defaultValue = m[2];
    if ((defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
        (defaultValue.startsWith("'") && defaultValue.endsWith("'"))) {
      defaultValue = defaultValue.slice(1, -1);
    }
    const description = pendingComments.join('\n').trim();
    const categories = [...description.matchAll(/\[([A-Z][A-Z_-]*)\]/g)].map((mm) => mm[1]);
    curSection.vars.push({
      key: m[1],
      defaultValue,
      description,
      categories,
    });
    pendingComments = [];
  }

  // Drop empty sections.
  return { sections: sections.filter((s) => s.vars.length > 0 || s.name) };
}

// ─── Value file reader ───────────────────────────────────────────────────────
// Reads .env.local / .env.production / .env.development next to the schema
// source. Returns a flat {key: value} map. Existing comments preserved when
// the file is rewritten (see writeEnvFile).

function envFilePathFor(schemaSourceAbsPath, environment) {
  const dir = path.dirname(schemaSourceAbsPath);
  const map = {
    local: '.env.local',
    production: '.env.production',
    development: '.env.development',
    'default': '.env',
  };
  const fname = map[environment] || '.env.local';
  return path.join(dir, fname);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return { values: {}, raw: '' };
  const raw = fs.readFileSync(filePath, 'utf8');
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    values[m[1]] = v;
  }
  return { values, raw };
}

function mergeEnvFile(existingRaw, updates) {
  // updates is {KEY: value}. Preserves existing structure (comments, blank
  // lines) when KEY already exists; appends new keys at the end.
  const updatesByKey = new Map(Object.entries(updates));
  const lines = existingRaw.split(/\r?\n/);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const m = line.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/);
    if (m && updatesByKey.has(m[1])) {
      out.push(`${m[1]}=${updatesByKey.get(m[1])}`);
      seen.add(m[1]);
    } else {
      out.push(line);
    }
  }
  for (const [key, value] of updatesByKey) {
    if (!seen.has(key)) out.push(`${key}=${value}`);
  }
  while (out.length > 1 && out[out.length - 1] === '' && out[out.length - 2] === '') out.pop();
  if (out.length === 0 || out[out.length - 1] !== '') out.push('');
  return out.join('\n');
}

function writeEnvFile(filePath, updates) {
  const { raw } = readEnvFile(filePath);
  const merged = mergeEnvFile(raw, updates);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, merged, 'utf8');
}

// ─── Project list builder ────────────────────────────────────────────────────

function listProjects(repoRoot) {
  const roots = readPlanningRoots(repoRoot);
  const projects = [];
  for (const r of roots) {
    if (!fs.existsSync(r.absolute) || !fs.statSync(r.absolute).isDirectory()) continue;
    const sources = discoverEnvExamples(r.absolute);
    if (sources.length === 0) continue;
    projects.push({
      id: r.id,
      root: r.absolute,
      relPath: r.path,
      sources: sources.map((s) => ({ relPath: s.relPath })),
    });
  }
  return projects;
}

function findSource(repoRoot, projectId, sourceRelPath) {
  const projects = listProjects(repoRoot);
  const proj = projects.find((p) => p.id === projectId);
  if (!proj) return null;
  const src = proj.sources.find((s) => s.relPath === sourceRelPath) || proj.sources[0];
  if (!src) return null;
  return { project: proj, sourceRelPath: src.relPath, sourceAbsPath: path.join(proj.root, src.relPath) };
}

// ─── HTTP handlers ───────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function makeServer(repoRoot) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/') {
        return sendHtml(res, 200, renderShell());
      }
      if (req.method === 'GET' && url.pathname === '/api/projects') {
        return sendJson(res, 200, { projects: listProjects(repoRoot) });
      }
      if (req.method === 'GET' && url.pathname === '/api/schema') {
        const projectId = url.searchParams.get('project');
        const sourceRel = url.searchParams.get('source') || '';
        const found = findSource(repoRoot, projectId, sourceRel);
        if (!found) return sendJson(res, 404, { error: `no schema source for project=${projectId}` });
        const text = fs.readFileSync(found.sourceAbsPath, 'utf8');
        const schema = parseEnvExample(text);
        return sendJson(res, 200, {
          project: { id: found.project.id, root: found.project.root },
          sourceRelPath: found.sourceRelPath,
          ...schema,
        });
      }
      if (req.method === 'GET' && url.pathname === '/api/values') {
        const projectId = url.searchParams.get('project');
        const env = url.searchParams.get('env') || 'local';
        const sourceRel = url.searchParams.get('source') || '';
        const found = findSource(repoRoot, projectId, sourceRel);
        if (!found) return sendJson(res, 404, { error: `no schema source` });
        const target = envFilePathFor(found.sourceAbsPath, env);
        const { values } = readEnvFile(target);
        return sendJson(res, 200, {
          targetPath: target,
          exists: fs.existsSync(target),
          values,
        });
      }
      if (req.method === 'POST' && url.pathname === '/api/save') {
        const body = await readBody(req);
        let payload;
        try { payload = JSON.parse(body); } catch (e) {
          return sendJson(res, 400, { error: 'invalid JSON body' });
        }
        const { project, env, source, entries } = payload || {};
        if (!project || !env || !entries || typeof entries !== 'object') {
          return sendJson(res, 400, { error: 'missing project/env/entries' });
        }
        const found = findSource(repoRoot, project, source || '');
        if (!found) return sendJson(res, 404, { error: 'project/source not found' });
        const target = envFilePathFor(found.sourceAbsPath, env);
        writeEnvFile(target, entries);
        const savedCount = Object.keys(entries).length;
        const viteCount = Object.keys(entries).filter((k) => k.startsWith('VITE_')).length;
        console.log(`[gad env web] saved ${savedCount} entries to ${target} (${viteCount} VITE_*)`);
        return sendJson(res, 200, { ok: true, target, savedCount, viteCount });
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[gad env web] handler error: ${msg}`);
      sendJson(res, 500, { error: msg });
    }
  });
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.warn(`[gad env web] failed to auto-open browser: ${err.message}`);
  });
}

// ─── HTML shell (vanilla, no build step) ─────────────────────────────────────

function renderShell() {
  // The page is a single self-contained doc. Vanilla JS fetches /api/* and
  // renders the editor. No frameworks. Black/gold/red palette.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>gad env</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  :root {
    --bg: #0d0d0d; --bg2: #050505; --card: #1a1a1a; --bg-hover: #121212;
    --gold: #D4A017; --gold-bright: #FFD700; --gold-dark: #8C6E10;
    --red: #C92A2A; --red-soft: rgba(201,42,42,0.10);
    --text: #e8e8e8; --text-dim: #999; --text-mid: #888; --border: #1f1f1f;
    --mono: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 14px; }
  a { color: var(--gold); }
  .container { max-width: 980px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
  .topbar { display: flex; gap: 0.75rem; align-items: end; flex-wrap: wrap; padding-bottom: 1rem; border-bottom: 1px solid var(--gold-dark); }
  .topbar h1 { color: var(--gold-bright); font-size: 0.85rem; letter-spacing: 0.22em; text-transform: uppercase; margin: 0 0 0.25rem; }
  .topbar p { color: var(--text-mid); font-size: 0.7rem; margin: 0; }
  .topbar .selectors { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: end; margin-left: auto; }
  .topbar label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--text-mid); }
  select, button, input, textarea {
    background: var(--bg2); color: var(--text); border: 1px solid var(--gold-dark);
    font-family: var(--mono); font-size: 0.78rem; padding: 0.4rem 0.6rem; border-radius: 0;
  }
  select:focus, input:focus, textarea:focus, button:focus { outline: none; border-color: var(--gold); }
  button { cursor: pointer; text-transform: uppercase; letter-spacing: 0.16em; font-size: 0.62rem; padding: 0.45rem 0.85rem; color: var(--gold-bright); background: rgba(212,160,23,0.06); }
  button:hover:not(:disabled) { background: rgba(212,160,23,0.14); border-color: var(--gold); }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  button.primary { background: rgba(212,160,23,0.18); border-color: var(--gold); }
  button.primary:hover:not(:disabled) { background: rgba(212,160,23,0.30); }
  button.ghost { background: transparent; border-color: #444; color: var(--text-mid); }
  button.danger { color: var(--red); border-color: var(--red); background: var(--red-soft); }

  .target-path { font-size: 0.65rem; color: var(--text-mid); margin-top: 0.5rem; word-break: break-all; }
  .target-path code { background: var(--card); padding: 0.05rem 0.3rem; color: var(--gold); }

  .bulk { margin: 1rem 0; border: 1px solid var(--border); }
  .bulk-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.7rem; cursor: pointer; user-select: none; background: var(--card); }
  .bulk-header h2 { margin: 0; font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold-bright); }
  .bulk-body { padding: 0.7rem; display: none; }
  .bulk.open .bulk-body { display: block; }
  .bulk-body textarea { width: 100%; min-height: 140px; font-size: 0.72rem; resize: vertical; color: var(--gold); }
  .bulk-body .row { display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center; }
  .bulk-body .row span { font-size: 0.62rem; color: var(--text-mid); margin-right: auto; }

  .section { margin: 1.4rem 0 0; }
  .section-name { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.22em; color: var(--gold); margin: 0 0 0.6rem; padding-bottom: 0.3rem; border-bottom: 1px dashed var(--gold-dark); }

  .var-row {
    display: grid; grid-template-columns: 1fr; gap: 0.3rem;
    padding: 0.6rem 0.7rem; border: 1px solid var(--border); margin-bottom: 0.5rem; background: var(--bg2);
  }
  .var-row.changed { border-color: var(--gold); background: rgba(212,160,23,0.04); }
  .var-row.matches-default { opacity: 0.85; }
  .var-row .head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .var-row .key { font-weight: 700; color: var(--gold-bright); font-size: 0.78rem; letter-spacing: 0.04em; }
  .var-row .pill { background: var(--card); color: var(--text-mid); border: 1px solid #2a2a2a; padding: 0.05rem 0.35rem; font-size: 0.55rem; letter-spacing: 0.18em; text-transform: uppercase; }
  .var-row .pill.required { color: var(--red); border-color: var(--red); }
  .var-row .pill.set { color: var(--gold-bright); border-color: var(--gold); }
  .var-row .desc { color: var(--text-mid); font-size: 0.66rem; line-height: 1.5; white-space: pre-wrap; }
  .var-row .input-row { display: flex; gap: 0.3rem; align-items: stretch; }
  .var-row input { flex: 1; font-size: 0.78rem; color: var(--gold-bright); }
  .var-row input.masked { -webkit-text-security: disc; text-security: disc; font-family: var(--mono); }
  .var-row .icon-btn { padding: 0.35rem 0.55rem; font-size: 0.6rem; }
  .var-row.unset .key { color: var(--text); }

  .save-bar { position: sticky; bottom: 0; background: linear-gradient(to top, var(--bg) 70%, transparent); padding: 1rem 0 0.5rem; margin-top: 1.5rem; display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center; flex-wrap: wrap; }
  .save-bar .stats { font-size: 0.65rem; color: var(--text-mid); margin-right: auto; }
  .save-bar .stats strong { color: var(--gold-bright); }

  .toast { position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); padding: 0.6rem 1.2rem; background: var(--card); border: 1px solid var(--gold); color: var(--gold-bright); font-size: 0.7rem; box-shadow: 0 4px 16px rgba(0,0,0,0.6); }
  .toast.error { border-color: var(--red); color: var(--red); }
  .toast.fade { opacity: 0; transition: opacity 0.4s ease; }

  .empty { text-align: center; padding: 2rem; color: var(--text-mid); font-size: 0.78rem; }
</style>
</head>
<body>
<div class="container">
  <header class="topbar">
    <div>
      <h1>gad env</h1>
      <p id="targetPath" class="target-path">loading…</p>
    </div>
    <div class="selectors">
      <label>project
        <select id="projectSel"></select>
      </label>
      <label>source
        <select id="sourceSel"></select>
      </label>
      <label>environment
        <select id="envSel">
          <option value="local">local (.env.local)</option>
          <option value="development">development (.env.development)</option>
          <option value="production">production (.env.production)</option>
          <option value="default">default (.env)</option>
        </select>
      </label>
    </div>
  </header>

  <section class="bulk" id="bulk">
    <div class="bulk-header" onclick="toggleBulk()">
      <h2>paste block (KEY=VALUE per line)</h2>
      <span style="color: var(--text-mid); font-size: 0.6rem;" id="bulkToggleLabel">expand</span>
    </div>
    <div class="bulk-body">
      <textarea id="bulkText" spellcheck="false" placeholder="VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENAI_API_KEY=sk-...
IONOS_API_KEY=prefix.secret
MODAL_VLLM_URL=https://..."></textarea>
      <div class="row">
        <span id="bulkParseStats">paste a block above and click parse — values populate matching inputs and any unknown KEYS get added below as untracked entries.</span>
        <button onclick="parseBulk()">parse and fill</button>
      </div>
    </div>
  </section>

  <main id="schemaRoot"></main>

  <div class="save-bar">
    <div class="stats" id="saveStats">no changes</div>
    <button class="ghost" onclick="reloadAll()">reload</button>
    <button class="primary" id="saveBtn" onclick="save()" disabled>save</button>
    <button id="reloadKaelBtn" onclick="reloadKael()" title="If you have a tauri kael window open at :1420, force its renderer to reload after save.">reload kael window</button>
  </div>
</div>
<div id="toast" class="toast" style="display:none"></div>

<script>
  const state = {
    projects: [],
    project: null,
    sourceRel: '',
    env: 'local',
    schema: { sections: [] },
    saved: {},        // {KEY: value} from disk
    edits: {},        // {KEY: value} pending
    extras: {},       // {KEY: value} for keys not in schema (from bulk paste)
    masked: {},       // {KEY: bool}
    targetPath: '',
  };

  function $(sel) { return document.querySelector(sel); }
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) Object.assign(e, props);
    if (props && props.attrs) for (const [k, v] of Object.entries(props.attrs)) e.setAttribute(k, v);
    for (const k of kids) {
      if (k == null) continue;
      if (typeof k === 'string') e.appendChild(document.createTextNode(k));
      else e.appendChild(k);
    }
    return e;
  }
  function toast(msg, isErr) {
    const t = $('#toast');
    t.className = 'toast' + (isErr ? ' error' : '');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.classList.add('fade');
      setTimeout(() => { t.style.display = 'none'; t.classList.remove('fade'); }, 400);
    }, 2400);
  }

  async function loadProjects() {
    const r = await fetch('/api/projects');
    const j = await r.json();
    state.projects = j.projects;
    const sel = $('#projectSel');
    sel.innerHTML = '';
    for (const p of state.projects) {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.id;
      sel.appendChild(opt);
    }
    if (state.projects.length > 0) {
      state.project = state.projects[0];
      sel.value = state.project.id;
      buildSourceSelect();
    }
  }

  function buildSourceSelect() {
    const sel = $('#sourceSel');
    sel.innerHTML = '';
    if (!state.project) return;
    for (const s of state.project.sources) {
      const opt = document.createElement('option');
      opt.value = s.relPath; opt.textContent = s.relPath;
      sel.appendChild(opt);
    }
    state.sourceRel = state.project.sources[0]?.relPath || '';
    sel.value = state.sourceRel;
  }

  async function loadSchemaAndValues() {
    if (!state.project) return;
    const params = new URLSearchParams({ project: state.project.id, source: state.sourceRel });
    const sR = await fetch('/api/schema?' + params.toString());
    if (!sR.ok) { toast('schema load failed', true); return; }
    state.schema = await sR.json();

    const vParams = new URLSearchParams({ project: state.project.id, source: state.sourceRel, env: state.env });
    const vR = await fetch('/api/values?' + vParams.toString());
    if (!vR.ok) { toast('values load failed', true); return; }
    const v = await vR.json();
    state.saved = v.values || {};
    state.targetPath = v.targetPath;
    state.edits = {};
    state.extras = {};
    render();
  }

  function getCurrent(key) {
    if (key in state.edits) return state.edits[key];
    if (key in state.extras) return state.extras[key];
    return state.saved[key] ?? '';
  }
  function isChanged(key) {
    if (key in state.extras) return state.extras[key] !== '';
    if (!(key in state.edits)) return false;
    const orig = state.saved[key] ?? '';
    return state.edits[key] !== orig;
  }

  function render() {
    $('#targetPath').innerHTML = state.targetPath ? 'target: <code>' + escapeHtml(state.targetPath) + '</code>' : '';
    const root = $('#schemaRoot');
    root.innerHTML = '';
    if (!state.schema.sections || state.schema.sections.length === 0) {
      root.appendChild(el('div', { className: 'empty' }, 'no schema variables found in source.'));
    }
    for (const section of (state.schema.sections || [])) {
      const sec = el('section', { className: 'section' });
      if (section.name) sec.appendChild(el('h3', { className: 'section-name' }, section.name));
      for (const v of section.vars) sec.appendChild(renderVarRow(v));
      root.appendChild(sec);
    }
    // Extras (keys not in schema, e.g. from bulk paste).
    const extraKeys = Object.keys(state.extras);
    if (extraKeys.length > 0) {
      const sec = el('section', { className: 'section' });
      sec.appendChild(el('h3', { className: 'section-name' }, 'untracked from paste'));
      for (const k of extraKeys) {
        sec.appendChild(renderVarRow({ key: k, defaultValue: '', description: '(not in .env.example)', categories: [] }));
      }
      root.appendChild(sec);
    }
    updateSaveStats();
  }

  function renderVarRow(v) {
    const current = getCurrent(v.key);
    const changed = isChanged(v.key);
    const matchesDefault = current && v.defaultValue && current === v.defaultValue;
    const isSet = current !== '';
    const masked = state.masked[v.key] !== false; // default masked
    const cls = ['var-row', !isSet ? 'unset' : '', changed ? 'changed' : '', matchesDefault ? 'matches-default' : ''].filter(Boolean).join(' ');
    const row = el('div', { className: cls });
    const head = el('div', { className: 'head' });
    head.appendChild(el('span', { className: 'key' }, v.key));
    if (isSet) head.appendChild(el('span', { className: 'pill set' }, 'set'));
    for (const c of (v.categories || [])) {
      const cls = c === 'REQUIRED' ? 'pill required' : 'pill';
      head.appendChild(el('span', { className: cls }, c));
    }
    row.appendChild(head);
    if (v.description) {
      const cleanDesc = v.description.replace(/\[[A-Z][A-Z_-]*\]/g, '').trim();
      if (cleanDesc) row.appendChild(el('div', { className: 'desc' }, cleanDesc));
    }
    const inputRow = el('div', { className: 'input-row' });
    const input = el('input', {
      type: 'text',
      value: current,
      placeholder: v.defaultValue || '(not set)',
      autocomplete: 'off',
      attrs: { 'data-key': v.key },
      className: masked && current ? 'masked' : '',
      oninput: (e) => {
        if (v.key in state.extras) state.extras[v.key] = e.target.value;
        else state.edits[v.key] = e.target.value;
        // Re-render only the row to avoid losing focus.
        const newRow = renderVarRow(v);
        row.replaceWith(newRow);
        updateSaveStats();
        // restore focus on the new input
        const newInput = newRow.querySelector('input[data-key="' + v.key + '"]');
        if (newInput) {
          newInput.focus();
          const len = newInput.value.length;
          newInput.setSelectionRange(len, len);
        }
      },
    });
    inputRow.appendChild(input);
    inputRow.appendChild(el('button', {
      className: 'icon-btn',
      title: masked ? 'reveal' : 'hide',
      onclick: () => { state.masked[v.key] = !masked; render(); },
    }, masked ? 'reveal' : 'hide'));
    inputRow.appendChild(el('button', {
      className: 'icon-btn',
      title: 'copy value',
      onclick: () => { navigator.clipboard.writeText(current); toast('copied'); },
    }, 'copy'));
    if (changed && !(v.key in state.extras)) {
      inputRow.appendChild(el('button', {
        className: 'icon-btn ghost',
        title: 'revert to saved',
        onclick: () => { delete state.edits[v.key]; render(); },
      }, 'revert'));
    }
    if (v.key in state.extras) {
      inputRow.appendChild(el('button', {
        className: 'icon-btn danger',
        title: 'remove untracked',
        onclick: () => { delete state.extras[v.key]; render(); },
      }, 'remove'));
    }
    row.appendChild(inputRow);
    return row;
  }

  function updateSaveStats() {
    const editKeys = Object.keys(state.edits).filter((k) => isChanged(k));
    const extraKeys = Object.keys(state.extras).filter((k) => state.extras[k] !== '');
    const total = editKeys.length + extraKeys.length;
    const stats = $('#saveStats');
    stats.innerHTML = total === 0
      ? 'no changes'
      : '<strong>' + total + '</strong> changes pending (' + editKeys.length + ' tracked + ' + extraKeys.length + ' untracked)';
    $('#saveBtn').disabled = total === 0;
  }

  async function save() {
    const entries = {};
    for (const k of Object.keys(state.edits)) {
      if (isChanged(k)) entries[k] = state.edits[k];
    }
    for (const k of Object.keys(state.extras)) {
      if (state.extras[k] !== '') entries[k] = state.extras[k];
    }
    if (Object.keys(entries).length === 0) { toast('nothing to save'); return; }
    const r = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: state.project.id, env: state.env, source: state.sourceRel, entries }),
    });
    const j = await r.json();
    if (!r.ok) { toast('save failed: ' + (j.error || r.status), true); return; }
    toast('saved ' + j.savedCount + ' (' + j.viteCount + ' VITE_*) → ' + j.target);
    await loadSchemaAndValues();
  }

  async function reloadKael() {
    // Try to ping :1420/kael — Vite renderer auto-reloads on .env file change
    // for Vite v6, but if HMR doesn't, this will at least confirm the URL.
    try {
      window.open('http://localhost:1420/kael', '_blank');
      toast('opening kael at :1420');
    } catch (e) {
      toast('open http://localhost:1420/kael manually', true);
    }
  }

  function parseBulk() {
    const text = $('#bulkText').value;
    let parsed = 0; let unknown = 0;
    const knownKeys = new Set();
    for (const sec of (state.schema.sections || [])) for (const v of sec.vars) knownKeys.add(v.key);
    for (const raw of text.split(/\\r?\\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^(?:export\\s+)?([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*)$/);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (knownKeys.has(m[1])) {
        state.edits[m[1]] = val;
      } else {
        state.extras[m[1]] = val;
        unknown++;
      }
      parsed++;
    }
    $('#bulkParseStats').textContent = 'parsed ' + parsed + ' entries (' + unknown + ' untracked)';
    if (parsed > 0) toast('parsed ' + parsed + ' (' + unknown + ' untracked)');
    render();
  }

  function toggleBulk() {
    const b = $('#bulk');
    b.classList.toggle('open');
    $('#bulkToggleLabel').textContent = b.classList.contains('open') ? 'collapse' : 'expand';
  }

  async function reloadAll() {
    await loadProjects();
    await loadSchemaAndValues();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Wire UI
  $('#projectSel').addEventListener('change', (e) => {
    state.project = state.projects.find((p) => p.id === e.target.value);
    buildSourceSelect();
    loadSchemaAndValues();
  });
  $('#sourceSel').addEventListener('change', (e) => {
    state.sourceRel = e.target.value;
    loadSchemaAndValues();
  });
  $('#envSel').addEventListener('change', (e) => {
    state.env = e.target.value;
    loadSchemaAndValues();
  });

  // Init
  (async () => {
    try {
      await loadProjects();
      await loadSchemaAndValues();
    } catch (err) {
      toast('init error: ' + err.message, true);
    }
  })();
</script>
</body></html>`;
}

// ─── Citty subcommand ────────────────────────────────────────────────────────

function createEnvWebCommand() {
  return defineCommand({
    meta: {
      name: 'web',
      description: 'Localhost env management surface — schema-driven inputs from .env.example, per-project + per-environment switching, paste-to-distribute bulk parser. Default port 3030.',
    },
    args: {
      port: { type: 'string', description: 'TCP port to bind (default 3030)', default: '3030' },
      'no-open': { type: 'boolean', description: 'Skip auto-opening the browser', default: false },
    },
    async run({ args }) {
      const port = Number(args.port) || 3030;
      const repoRoot = findRepoRoot();
      const projects = listProjects(repoRoot);
      console.log(`[gad env web] repo root   : ${repoRoot}`);
      console.log(`[gad env web] projects    : ${projects.length} (${projects.map((p) => p.id).join(', ')})`);
      console.log(`[gad env web] starting on http://localhost:${port}`);

      const server = makeServer(repoRoot);
      server.on('error', (err) => {
        console.error(`[gad env web] server error: ${err.message}`);
        process.exit(1);
      });
      server.listen(port, '127.0.0.1', () => {
        console.log(`[gad env web] http://localhost:${port} ready. Ctrl+C to stop.`);
        if (!args['no-open']) openBrowser(`http://localhost:${port}`);
      });
    },
  });
}

module.exports = { createEnvWebCommand };
