'use strict';
/**
 * gad env web — schema-driven env management surface (operator UX 2026-05-10).
 *
 * Drops the "source" selector (operator: "we are saying sources and environment,
 * remove sources"). Now aggregates ALL .env.example files for a project into
 * one schema; sections are labeled by their source. On save, entries are
 * distributed back to each source's adjacent env file.
 *
 * Value layering (operator: "vendor get-anything-done already has values in its
 * .env and should loaded"):
 *   1. base layer = `.env` (committed defaults — read-only display, used for
 *      placeholder/fallback values)
 *   2. override layer = `.env.<environment>` (.env.local / .env.production /
 *      .env.development) — this is what edits get written to
 *
 * UI (operator: "every UI should have our VCS installation. a way we have ides,
 * dev panel, click on location to capture recording and component target"):
 *   - every visible region carries `data-cid="..."` so the page is addressable
 *   - Alt+I toggles dev mode → highlights every cid'd element with a gold ring
 *     and a label badge in the corner
 *   - Alt+click on any cid'd element starts voice recording (Web Speech API);
 *     a chip stack at bottom-right captures transcripts attached to the cid
 *   - Click chip → injects transcript into the relevant input field (when a
 *     cid maps to one) OR copies to clipboard
 *
 * No coupling to lib/env-cli.cjs. Pure node:http + node:fs + node:path.
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
  const out = roots
    .filter((r) => r && r.id && (r.path !== undefined))
    .map((r) => ({ id: r.id, path: r.path, absolute: path.resolve(repoRoot, r.path) }));
  if (!out.find((r) => r.id === 'global')) {
    out.unshift({ id: 'global', path: '.', absolute: repoRoot });
  }
  return out;
}

// ─── Schema discovery ────────────────────────────────────────────────────────

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
    if (trimmed.match(/^#\s*=+\s*$/)) {
      if (!lastWasBanner) {
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
        lastWasBanner = false;
        pendingComments = [];
      }
      continue;
    }
    if (lastWasBanner) {
      if (trimmed === '' || trimmed.match(/^#\s*=+/)) {
        if (trimmed === '') lastWasBanner = false;
      }
      continue;
    }
    if (trimmed === '') { pendingComments = []; continue; }
    if (trimmed.startsWith('#')) {
      pendingComments.push(trimmed.replace(/^#\s?/, ''));
      continue;
    }
    const m = trimmed.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) { pendingComments = []; continue; }
    let defaultValue = m[2];
    if ((defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
        (defaultValue.startsWith("'") && defaultValue.endsWith("'"))) {
      defaultValue = defaultValue.slice(1, -1);
    }
    const description = pendingComments.join('\n').trim();
    const categories = [...description.matchAll(/\[([A-Z][A-Z_-]*)\]/g)].map((mm) => mm[1]);
    curSection.vars.push({ key: m[1], defaultValue, description, categories });
    pendingComments = [];
  }
  return { sections: sections.filter((s) => s.vars.length > 0 || s.name) };
}

// ─── Value file reader ───────────────────────────────────────────────────────

function envFileNameFor(environment) {
  const map = { local: '.env.local', production: '.env.production', development: '.env.development', 'default': '.env' };
  return map[environment] || '.env.local';
}

function envFilePathsFor(schemaSourceAbsPath, environment) {
  const dir = path.dirname(schemaSourceAbsPath);
  return {
    base: path.join(dir, '.env'),                       // committed defaults (read-only)
    override: path.join(dir, envFileNameFor(environment)),  // editable overrides
  };
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    values[m[1]] = v;
  }
  return { values, raw };
}

function mergeEnvFile(existingRaw, updates) {
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
      sourceCount: sources.length,
    });
  }
  return projects;
}

function findProject(repoRoot, projectId) {
  const projects = listProjects(repoRoot);
  return projects.find((p) => p.id === projectId) || null;
}

// ─── Aggregated schema (all sources for a project) ───────────────────────────

function buildAggregateSchema(projectAbsPath) {
  const sources = discoverEnvExamples(projectAbsPath);
  const sections = [];
  // Track key → source map so save can route correctly.
  const keyToSource = {};
  for (const src of sources) {
    const text = fs.readFileSync(src.absPath, 'utf8');
    const parsed = parseEnvExample(text);
    for (const sec of parsed.sections) {
      const labeled = {
        name: sec.name,
        sourceRelPath: src.relPath,
        sourceAbsPath: src.absPath,
        vars: sec.vars,
      };
      sections.push(labeled);
      for (const v of sec.vars) {
        if (!keyToSource[v.key]) keyToSource[v.key] = src.absPath;
      }
    }
  }
  return { sections, keyToSource, sources: sources.map((s) => s.relPath) };
}

function loadAggregateValues(projectAbsPath, environment) {
  const sources = discoverEnvExamples(projectAbsPath);
  // Layer: per source, base (.env) → override (.env.<env>). Across sources,
  // earlier source wins on conflict (root .env.example wins over apps/*).
  const values = {};
  const provenance = {};
  // Reverse so earlier source ends up applied LAST and wins.
  for (let i = sources.length - 1; i >= 0; i--) {
    const src = sources[i];
    const { base, override } = envFilePathsFor(src.absPath, environment);
    if (fs.existsSync(base)) {
      const r = readEnvFile(base);
      for (const [k, v] of Object.entries(r.values)) {
        values[k] = v;
        provenance[k] = { source: src.relPath, file: '.env' };
      }
    }
    if (fs.existsSync(override)) {
      const r = readEnvFile(override);
      for (const [k, v] of Object.entries(r.values)) {
        values[k] = v;
        provenance[k] = { source: src.relPath, file: envFileNameFor(environment) };
      }
    }
  }
  return { values, provenance };
}

function saveAggregate(projectAbsPath, environment, entries, keyToSource) {
  // Group entries by their source's adjacent override file.
  const byTarget = new Map();
  for (const [key, value] of Object.entries(entries)) {
    const sourceAbsPath = keyToSource[key];
    if (!sourceAbsPath) continue; // skip extras with no schema source
    const target = path.join(path.dirname(sourceAbsPath), envFileNameFor(environment));
    if (!byTarget.has(target)) byTarget.set(target, {});
    byTarget.get(target)[key] = value;
  }
  const written = [];
  for (const [target, ent] of byTarget) {
    writeEnvFile(target, ent);
    written.push({ target, count: Object.keys(ent).length });
  }
  return written;
}

// ─── HTTP plumbing ───────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
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

function makeServer(repoRoot) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/') return sendHtml(res, 200, renderShell());
      if (req.method === 'GET' && url.pathname === '/api/projects') {
        return sendJson(res, 200, { projects: listProjects(repoRoot) });
      }
      if (req.method === 'GET' && url.pathname === '/api/schema') {
        const projectId = url.searchParams.get('project');
        const proj = findProject(repoRoot, projectId);
        if (!proj) return sendJson(res, 404, { error: `project ${projectId} not found or has no .env.example files` });
        const schema = buildAggregateSchema(proj.root);
        return sendJson(res, 200, { project: { id: proj.id, root: proj.root }, ...schema });
      }
      if (req.method === 'GET' && url.pathname === '/api/values') {
        const projectId = url.searchParams.get('project');
        const env = url.searchParams.get('env') || 'local';
        const proj = findProject(repoRoot, projectId);
        if (!proj) return sendJson(res, 404, { error: 'project not found' });
        const { values, provenance } = loadAggregateValues(proj.root, env);
        return sendJson(res, 200, { values, provenance, environment: env });
      }
      if (req.method === 'POST' && url.pathname === '/api/save') {
        const body = await readBody(req);
        let payload;
        try { payload = JSON.parse(body); } catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
        const { project: projectId, env, entries } = payload || {};
        if (!projectId || !env || !entries || typeof entries !== 'object') {
          return sendJson(res, 400, { error: 'missing project/env/entries' });
        }
        const proj = findProject(repoRoot, projectId);
        if (!proj) return sendJson(res, 404, { error: 'project not found' });
        const schema = buildAggregateSchema(proj.root);
        const written = saveAggregate(proj.root, env, entries, schema.keyToSource);
        const total = written.reduce((s, w) => s + w.count, 0);
        const viteCount = Object.keys(entries).filter((k) => k.startsWith('VITE_')).length;
        console.log(`[gad env web] saved ${total} entries across ${written.length} files`);
        for (const w of written) console.log(`  → ${w.target} (${w.count})`);
        return sendJson(res, 200, { ok: true, written, total, viteCount });
      }
      res.writeHead(404); res.end('not found');
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
  exec(cmd, (err) => { if (err) console.warn(`[gad env web] failed to auto-open browser: ${err.message}`); });
}

// ─── HTML shell with VCS-style devpanel + voice recording ────────────────────

function renderShell() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>gad env</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  :root {
    --bg: #0d0d0d; --bg2: #050505; --card: #1a1a1a;
    --gold: #D4A017; --gold-bright: #FFD700; --gold-dark: #8C6E10;
    --red: #C92A2A; --red-soft: rgba(201,42,42,0.10);
    --text: #e8e8e8; --text-dim: #999; --text-mid: #888; --border: #1f1f1f;
    --mono: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
    --panel-w: 360px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 14px; height: 100%; overflow: hidden; }
  .layout { display: flex; height: 100vh; }
  .main-col { flex: 1; overflow-y: auto; }
  .container { max-width: 760px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
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

  .info-line { font-size: 0.62rem; color: var(--text-mid); margin-top: 0.5rem; }
  .info-line code { background: var(--card); padding: 0.05rem 0.3rem; color: var(--gold); }

  .bulk { margin: 1rem 0; border: 1px solid var(--border); }
  .bulk-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.7rem; cursor: pointer; user-select: none; background: var(--card); }
  .bulk-header h2 { margin: 0; font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold-bright); }
  .bulk-body { padding: 0.7rem; display: none; }
  .bulk.open .bulk-body { display: block; }
  .bulk-body textarea { width: 100%; min-height: 140px; font-size: 0.72rem; resize: vertical; color: var(--gold); }
  .bulk-body .row { display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center; }
  .bulk-body .row span { font-size: 0.62rem; color: var(--text-mid); margin-right: auto; }

  .section { margin: 1.4rem 0 0; }
  .section-name { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.22em; color: var(--gold); margin: 0 0 0.6rem; padding-bottom: 0.3rem; border-bottom: 1px dashed var(--gold-dark); display: flex; gap: 0.6rem; align-items: baseline; flex-wrap: wrap; }
  .section-name .source-tag { color: var(--text-mid); font-size: 0.55rem; letter-spacing: 0.1em; }

  .var-row { display: grid; grid-template-columns: 1fr; gap: 0.3rem; padding: 0.6rem 0.7rem; border: 1px solid var(--border); margin-bottom: 0.5rem; background: var(--bg2); }
  .var-row.changed { border-color: var(--gold); background: rgba(212,160,23,0.04); }
  .var-row .head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .var-row .key { font-weight: 700; color: var(--gold-bright); font-size: 0.78rem; letter-spacing: 0.04em; }
  .var-row .pill { background: var(--card); color: var(--text-mid); border: 1px solid #2a2a2a; padding: 0.05rem 0.35rem; font-size: 0.55rem; letter-spacing: 0.18em; text-transform: uppercase; }
  .var-row .pill.required { color: var(--red); border-color: var(--red); }
  .var-row .pill.set { color: var(--gold-bright); border-color: var(--gold); }
  .var-row .pill.from-base { color: var(--gold-dark); border-color: var(--gold-dark); }
  .var-row .desc { color: var(--text-mid); font-size: 0.66rem; line-height: 1.5; white-space: pre-wrap; }
  .var-row .input-row { display: flex; gap: 0.3rem; align-items: stretch; }
  .var-row input { flex: 1; font-size: 0.78rem; color: var(--gold-bright); }
  .var-row input.masked { -webkit-text-security: disc; text-security: disc; font-family: var(--mono); }
  .var-row .icon-btn { padding: 0.35rem 0.55rem; font-size: 0.6rem; }
  .var-row .prov { font-size: 0.55rem; color: var(--text-mid); letter-spacing: 0.1em; }

  .save-bar { position: sticky; bottom: 0; background: linear-gradient(to top, var(--bg) 70%, transparent); padding: 1rem 0 0.5rem; margin-top: 1.5rem; display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center; flex-wrap: wrap; }
  .save-bar .stats { font-size: 0.65rem; color: var(--text-mid); margin-right: auto; }
  .save-bar .stats strong { color: var(--gold-bright); }

  .toast { position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); padding: 0.6rem 1.2rem; background: var(--card); border: 1px solid var(--gold); color: var(--gold-bright); font-size: 0.7rem; box-shadow: 0 4px 16px rgba(0,0,0,0.6); z-index: 60; }
  .toast.error { border-color: var(--red); color: var(--red); }
  .toast.fade { opacity: 0; transition: opacity 0.4s ease; }

  .empty { text-align: center; padding: 2rem; color: var(--text-mid); font-size: 0.78rem; }

  /* ─── VCS dev mode (Alt+I) ───────────────────────────────────────────── */
  body.devid [data-cid] { outline: 1px solid rgba(212,160,23,0.45); outline-offset: 1px; position: relative; }
  body.devid [data-cid]:hover { outline-color: var(--gold-bright); outline-width: 2px; cursor: pointer; }
  body.devid [data-cid]::after {
    content: attr(data-cid);
    position: absolute; top: -8px; right: -2px;
    font: 0.55rem var(--mono); padding: 0.05rem 0.3rem;
    background: var(--bg); color: var(--gold-bright); border: 1px solid var(--gold-dark);
    pointer-events: none; z-index: 50; opacity: 0.55;
  }
  body.devid [data-cid]:hover::after { opacity: 1; background: var(--gold-bright); color: var(--bg); }

  /* ─── Side context panel ─────────────────────────────────────────────── */
  .side-panel { width: var(--panel-w); flex: 0 0 var(--panel-w); border-left: 1px solid var(--gold-dark); background: var(--bg2); display: flex; flex-direction: column; height: 100vh; }
  .side-panel header { padding: 0.7rem 0.8rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: baseline; }
  .side-panel header h2 { margin: 0; font-size: 0.62rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold-bright); }
  .side-panel header .clear-btn { background: transparent; border: 1px solid var(--gold-dark); color: var(--text-mid); padding: 0.2rem 0.5rem; font-size: 0.52rem; }
  .side-panel header .clear-btn:hover:not(:disabled) { color: var(--red); border-color: var(--red); }

  .tag-list { flex: 1; overflow-y: auto; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .tag-list .empty-hint { color: var(--text-mid); font-size: 0.65rem; text-align: center; padding: 1.5rem 0.5rem; line-height: 1.6; }
  .tag-list .empty-hint kbd { background: var(--card); border: 1px solid var(--gold-dark); padding: 0.05rem 0.3rem; color: var(--gold); margin: 0 0.1rem; font-family: var(--mono); font-size: 0.55rem; }

  .tag { background: var(--card); border: 1px solid var(--gold-dark); padding: 0.45rem 0.55rem; font-size: 0.66rem; display: flex; flex-direction: column; gap: 0.25rem; }
  .tag.recording { border-color: var(--red); background: rgba(201,42,42,0.10); }
  .tag .tag-head { display: flex; justify-content: space-between; align-items: center; gap: 0.3rem; }
  .tag .cidlabel { font-size: 0.52rem; color: var(--gold-dark); letter-spacing: 0.18em; text-transform: uppercase; word-break: break-all; flex: 1; }
  .tag .ctext { color: var(--gold-bright); word-break: break-word; line-height: 1.4; }
  .tag .actions { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.2rem; }
  .tag .actions button { padding: 0.1rem 0.4rem; font-size: 0.52rem; background: transparent; border: 1px solid var(--gold-dark); color: var(--text-mid); }
  .tag .actions button:hover:not(:disabled) { color: var(--gold); border-color: var(--gold); }
  .tag .actions button.danger { color: var(--text-mid); }
  .tag .actions button.danger:hover { color: var(--red); border-color: var(--red); }
  .tag .actions button.primary { color: var(--gold-bright); border-color: var(--gold); background: rgba(212,160,23,0.10); }
  .tag .pending-rec { color: var(--red); font-style: italic; }

  /* ─── Composer at panel bottom ───────────────────────────────────────── */
  .composer { border-top: 1px solid var(--gold-dark); background: var(--bg); padding: 0.6rem 0.7rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .composer .composer-meta { font-size: 0.52rem; color: var(--text-mid); letter-spacing: 0.18em; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; }
  .composer textarea { width: 100%; min-height: 60px; resize: vertical; font-size: 0.74rem; color: var(--gold-bright); background: var(--bg2); }
  .composer .composer-actions { display: flex; gap: 0.3rem; }
  .composer .composer-actions button { flex: 1; padding: 0.45rem 0.4rem; font-size: 0.58rem; }
  .composer .composer-actions .mic-btn.recording { background: rgba(201,42,42,0.12); border-color: var(--red); color: var(--red); animation: pulse 1.4s infinite; }
  .composer .composer-actions .send-btn { background: rgba(212,160,23,0.18); border-color: var(--gold); color: var(--gold-bright); }
  .composer .composer-actions .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

  /* ─── History (composer submissions) ─────────────────────────────────── */
  .history { padding: 0.4rem 0.8rem; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.3rem; max-height: 32%; overflow-y: auto; background: var(--bg2); }
  .history:empty { display: none; }
  .history h3 { margin: 0 0 0.2rem; font-size: 0.55rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold-dark); }
  .history .h-entry { font-size: 0.62rem; color: var(--text); padding: 0.35rem 0; border-bottom: 1px dashed var(--border); }
  .history .h-entry:last-child { border-bottom: 0; }
  .history .h-entry .h-time { font-size: 0.5rem; color: var(--text-mid); letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 0.15rem; }
  .history .h-entry .h-prompt { color: var(--gold-bright); white-space: pre-wrap; word-break: break-word; }
  .history .h-entry .h-tags { font-size: 0.52rem; color: var(--text-mid); margin-top: 0.15rem; }
  .history .h-entry .h-tags code { background: var(--card); padding: 0.05rem 0.25rem; color: var(--gold); margin-right: 0.2rem; }

  .devhint { position: fixed; left: 1rem; bottom: 1rem; font-size: 0.55rem; color: var(--text-mid); letter-spacing: 0.14em; text-transform: uppercase; z-index: 65; pointer-events: none; }
  .devhint kbd { background: var(--card); border: 1px solid var(--gold-dark); padding: 0.05rem 0.3rem; color: var(--gold); margin: 0 0.1rem; font-family: var(--mono); }
</style>
</head>
<body>
<div class="layout" data-cid="env-web-layout">
<div class="main-col" data-cid="env-web-main-col">
<div class="container" data-cid="env-web-container">
  <header class="topbar" data-cid="env-web-topbar">
    <div data-cid="env-web-title-block">
      <h1>gad env</h1>
      <p id="targetPath" class="info-line">loading…</p>
    </div>
    <div class="selectors" data-cid="env-web-selectors">
      <label data-cid="env-web-project-select">project
        <select id="projectSel"></select>
      </label>
      <label data-cid="env-web-env-select">environment
        <select id="envSel">
          <option value="local">local (.env.local)</option>
          <option value="development">development (.env.development)</option>
          <option value="production">production (.env.production)</option>
          <option value="default">default (.env)</option>
        </select>
      </label>
    </div>
  </header>

  <section class="bulk" id="bulk" data-cid="env-web-bulk-paste">
    <div class="bulk-header" onclick="toggleBulk()">
      <h2>paste block (KEY=VALUE per line)</h2>
      <span style="color: var(--text-mid); font-size: 0.6rem;" id="bulkToggleLabel">expand</span>
    </div>
    <div class="bulk-body">
      <textarea id="bulkText" spellcheck="false" data-cid="env-web-bulk-textarea" placeholder="VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENAI_API_KEY=sk-...
IONOS_API_KEY=prefix.secret
MODAL_VLLM_URL=https://..."></textarea>
      <div class="row">
        <span id="bulkParseStats">paste a block above and click parse — values populate matching inputs and any unknown KEYS get added below as untracked entries.</span>
        <button onclick="parseBulk()" data-cid="env-web-bulk-parse-btn">parse and fill</button>
      </div>
    </div>
  </section>

  <main id="schemaRoot" data-cid="env-web-schema-root"></main>

  <div class="save-bar" data-cid="env-web-save-bar">
    <div class="stats" id="saveStats">no changes</div>
    <button class="ghost" onclick="reloadAll()" data-cid="env-web-reload-btn">reload</button>
    <button class="primary" id="saveBtn" onclick="save()" disabled data-cid="env-web-save-btn">save</button>
  </div>
</div>
</div><!-- /main-col -->

<aside class="side-panel" data-cid="env-web-side-panel">
  <header data-cid="env-web-side-panel-header">
    <h2>context</h2>
    <button class="clear-btn" id="clearTagsBtn" onclick="clearAllTags()" data-cid="env-web-side-panel-clear">clear all</button>
  </header>
  <div class="tag-list" id="tagList" data-cid="env-web-tag-list"></div>
  <div class="history" id="historyList" data-cid="env-web-history"></div>
  <form class="composer" id="composer" onsubmit="submitComposer(event)" data-cid="env-web-composer">
    <div class="composer-meta">
      <span id="composerTagCount">0 tags attached</span>
      <span>composer</span>
    </div>
    <textarea id="composerInput" placeholder="add a prompt to send with the attached tags…" spellcheck="false" data-cid="env-web-composer-input"></textarea>
    <div class="composer-actions">
      <button type="button" class="mic-btn" id="composerMicBtn" onclick="toggleComposerMic()" data-cid="env-web-composer-mic">mic</button>
      <button type="submit" class="send-btn" id="composerSendBtn" disabled data-cid="env-web-composer-send">send</button>
    </div>
  </form>
</aside>
</div><!-- /layout -->

<div class="devhint" id="devhint">Alt+I: dev ids · Alt+click cid: voice tag</div>
<div id="toast" class="toast" style="display:none"></div>

<script>
  // ─── State ────────────────────────────────────────────────────────────────
  const state = {
    projects: [], project: null, env: 'local',
    schema: { sections: [], keyToSource: {}, sources: [] },
    saved: {}, edits: {}, extras: {}, masked: {}, provenance: {},
  };

  function $(sel) { return document.querySelector(sel); }
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      const { attrs, ...rest } = props;
      Object.assign(e, rest);
      if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    }
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

  // ─── API ─────────────────────────────────────────────────────────────────
  async function loadProjects() {
    const r = await fetch('/api/projects');
    const j = await r.json();
    state.projects = j.projects;
    const sel = $('#projectSel');
    sel.innerHTML = '';
    for (const p of state.projects) {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.id + ' (' + p.sourceCount + ')';
      sel.appendChild(opt);
    }
    if (state.projects.length > 0) {
      state.project = state.projects[0]; sel.value = state.project.id;
    }
  }
  async function loadSchemaAndValues() {
    if (!state.project) return;
    const params = new URLSearchParams({ project: state.project.id });
    const sR = await fetch('/api/schema?' + params.toString());
    if (!sR.ok) { toast('schema load failed', true); return; }
    state.schema = await sR.json();
    const vParams = new URLSearchParams({ project: state.project.id, env: state.env });
    const vR = await fetch('/api/values?' + vParams.toString());
    if (!vR.ok) { toast('values load failed', true); return; }
    const v = await vR.json();
    state.saved = v.values || {};
    state.provenance = v.provenance || {};
    state.edits = {}; state.extras = {};
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
    return state.edits[key] !== (state.saved[key] ?? '');
  }

  function render() {
    const sources = state.schema.sources || [];
    $('#targetPath').innerHTML = sources.length
      ? 'sources: ' + sources.map((s) => '<code>' + escapeHtml(s) + '</code>').join(' · ')
      : '';
    const root = $('#schemaRoot');
    root.innerHTML = '';
    if (!state.schema.sections || state.schema.sections.length === 0) {
      root.appendChild(el('div', { className: 'empty' }, 'no schema variables found.'));
    }
    for (const section of (state.schema.sections || [])) {
      const sec = el('section', { className: 'section', attrs: { 'data-cid': 'env-section-' + slugify(section.name || section.sourceRelPath) } });
      const head = el('h3', { className: 'section-name' });
      if (section.name) head.appendChild(el('span', null, section.name));
      head.appendChild(el('span', { className: 'source-tag' }, '· ' + (section.sourceRelPath || '')));
      sec.appendChild(head);
      for (const v of section.vars) sec.appendChild(renderVarRow(v));
      root.appendChild(sec);
    }
    const extraKeys = Object.keys(state.extras);
    if (extraKeys.length > 0) {
      const sec = el('section', { className: 'section', attrs: { 'data-cid': 'env-section-extras' } });
      sec.appendChild(el('h3', { className: 'section-name' }, 'untracked from paste'));
      for (const k of extraKeys) {
        sec.appendChild(renderVarRow({ key: k, defaultValue: '', description: '(not in any .env.example)', categories: [] }));
      }
      root.appendChild(sec);
    }
    updateSaveStats();
  }

  function renderVarRow(v) {
    const current = getCurrent(v.key);
    const changed = isChanged(v.key);
    const isSet = current !== '';
    const masked = state.masked[v.key] !== false;
    const prov = state.provenance[v.key];
    const cls = ['var-row', changed ? 'changed' : ''].filter(Boolean).join(' ');
    const row = el('div', { className: cls, attrs: { 'data-cid': 'env-var-' + v.key.toLowerCase() } });
    const head = el('div', { className: 'head' });
    head.appendChild(el('span', { className: 'key' }, v.key));
    if (isSet) head.appendChild(el('span', { className: 'pill set' }, 'set'));
    if (prov && prov.file === '.env') head.appendChild(el('span', { className: 'pill from-base', attrs: { title: 'value from committed .env (base layer)' } }, '.env'));
    for (const c of (v.categories || [])) {
      const cls = c === 'REQUIRED' ? 'pill required' : 'pill';
      head.appendChild(el('span', { className: cls }, c));
    }
    row.appendChild(head);
    if (v.description) {
      const cleanDesc = v.description.replace(/\\[[A-Z][A-Z_-]*\\]/g, '').trim();
      if (cleanDesc) row.appendChild(el('div', { className: 'desc' }, cleanDesc));
    }
    if (prov) row.appendChild(el('div', { className: 'prov' }, 'from ' + prov.source + '/' + prov.file));
    const inputRow = el('div', { className: 'input-row' });
    const input = el('input', {
      type: 'text', value: current,
      placeholder: v.defaultValue || '(not set)',
      autocomplete: 'off',
      attrs: { 'data-key': v.key, 'data-cid': 'env-input-' + v.key.toLowerCase() },
      className: masked && current ? 'masked' : '',
      oninput: (e) => {
        if (v.key in state.extras) state.extras[v.key] = e.target.value;
        else state.edits[v.key] = e.target.value;
        const newRow = renderVarRow(v);
        row.replaceWith(newRow);
        updateSaveStats();
        const newInput = newRow.querySelector('input[data-key="' + v.key + '"]');
        if (newInput) { newInput.focus(); const len = newInput.value.length; newInput.setSelectionRange(len, len); }
      },
    });
    inputRow.appendChild(input);
    inputRow.appendChild(el('button', { className: 'icon-btn', title: masked ? 'reveal' : 'hide', onclick: () => { state.masked[v.key] = !masked; render(); } }, masked ? 'reveal' : 'hide'));
    inputRow.appendChild(el('button', { className: 'icon-btn', title: 'copy value', onclick: () => { navigator.clipboard.writeText(current); toast('copied'); } }, 'copy'));
    if (changed && !(v.key in state.extras)) {
      inputRow.appendChild(el('button', { className: 'icon-btn ghost', title: 'revert to saved', onclick: () => { delete state.edits[v.key]; render(); } }, 'revert'));
    }
    if (v.key in state.extras) {
      inputRow.appendChild(el('button', { className: 'icon-btn danger', title: 'remove untracked', onclick: () => { delete state.extras[v.key]; render(); } }, 'remove'));
    }
    row.appendChild(inputRow);
    return row;
  }

  function updateSaveStats() {
    const editKeys = Object.keys(state.edits).filter((k) => isChanged(k));
    const extraKeys = Object.keys(state.extras).filter((k) => state.extras[k] !== '');
    const total = editKeys.length + extraKeys.length;
    $('#saveStats').innerHTML = total === 0 ? 'no changes' : '<strong>' + total + '</strong> changes pending';
    $('#saveBtn').disabled = total === 0;
  }

  async function save() {
    const entries = {};
    for (const k of Object.keys(state.edits)) if (isChanged(k)) entries[k] = state.edits[k];
    for (const k of Object.keys(state.extras)) if (state.extras[k] !== '') entries[k] = state.extras[k];
    if (Object.keys(entries).length === 0) { toast('nothing to save'); return; }
    const r = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: state.project.id, env: state.env, entries }) });
    const j = await r.json();
    if (!r.ok) { toast('save failed: ' + (j.error || r.status), true); return; }
    toast('saved ' + j.total + ' across ' + j.written.length + ' files');
    await loadSchemaAndValues();
  }

  function parseBulk() {
    const text = $('#bulkText').value;
    let parsed = 0; let unknown = 0;
    const knownKeys = new Set(Object.keys(state.schema.keyToSource || {}));
    for (const raw of text.split(/\\r?\\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^(?:export\\s+)?([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*)$/);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (knownKeys.has(m[1])) state.edits[m[1]] = val;
      else { state.extras[m[1]] = val; unknown++; }
      parsed++;
    }
    $('#bulkParseStats').textContent = 'parsed ' + parsed + ' entries (' + unknown + ' untracked)';
    if (parsed > 0) toast('parsed ' + parsed);
    render();
  }

  function toggleBulk() {
    const b = $('#bulk'); b.classList.toggle('open');
    $('#bulkToggleLabel').textContent = b.classList.contains('open') ? 'collapse' : 'expand';
  }
  async function reloadAll() { await loadProjects(); await loadSchemaAndValues(); }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // ─── VCS dev mode (Alt+I) ────────────────────────────────────────────────
  let devOn = false;
  function toggleDev() {
    devOn = !devOn;
    document.body.classList.toggle('devid', devOn);
    toast(devOn ? 'dev ids ON · Alt+click any cid to record' : 'dev ids OFF');
  }
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); toggleDev(); }
  });

  // ─── Voice subsystem ─────────────────────────────────────────────────────
  // Two paths share one SpeechRecognition recognizer (only one active at a time):
  //   targetMode: Alt+click on a [data-cid] → records → finalizes as a tag
  //               that goes into the right-side panel.
  //   composerMode: Click the mic button on the composer → records → fills
  //                 the composer textarea directly (does NOT create a tag).
  const voice = {
    rec: null,
    mode: null,        // 'target' | 'composer' | null
    recCid: null,      // target cid when mode === 'target'
    transcript: '',    // accumulating transcript for the active recording
    composerStartText: '',  // composer text snapshot when composer recording started
    tags: [],          // persistent target-recording tags
    history: [],       // composer submissions (prompt + tag snapshot)
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };

  function makeRecognizer(onFinal, onError) {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Ctor();
    r.lang = 'en-US'; r.continuous = true; r.interimResults = false;
    r.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) {
          const t = res[0].transcript.trim();
          if (t) onFinal(t);
        }
      }
    };
    r.onerror = (ev) => onError(ev.error || 'unknown');
    return r;
  }

  // Target-mode recording — Alt+click on a cid
  function startTargetRecord(cid) {
    if (!voice.supported) { toast('voice not supported in this browser', true); return; }
    if (voice.rec) stopRecord();
    const r = makeRecognizer(
      (t) => { voice.transcript = (voice.transcript ? voice.transcript + ' ' : '') + t; renderTags(); },
      (err) => toast('voice error: ' + err, true),
    );
    r.onend = () => finalizeTagRec();
    try { r.start(); voice.rec = r; voice.mode = 'target'; voice.recCid = cid; voice.transcript = ''; renderTags(); }
    catch (e) { toast('voice start failed: ' + e.message, true); }
  }

  // Composer-mode recording — mic button next to the composer input
  function startComposerRecord() {
    if (!voice.supported) { toast('voice not supported in this browser', true); return; }
    if (voice.rec) stopRecord();
    const r = makeRecognizer(
      (t) => {
        const input = $('#composerInput');
        const sep = input.value && !input.value.endsWith(' ') ? ' ' : '';
        input.value = input.value + sep + t;
        updateComposerSendState();
      },
      (err) => toast('voice error: ' + err, true),
    );
    r.onend = () => finalizeComposerRec();
    try { r.start(); voice.rec = r; voice.mode = 'composer'; voice.composerStartText = $('#composerInput').value; renderComposerMic(); }
    catch (e) { toast('voice start failed: ' + e.message, true); }
  }

  function stopRecord() { if (voice.rec) { try { voice.rec.stop(); } catch {} } }

  function finalizeTagRec() {
    if (voice.recCid && voice.transcript) {
      voice.tags.push({ id: 't' + Date.now(), cid: voice.recCid, text: voice.transcript, createdAt: Date.now() });
    }
    voice.rec = null; voice.mode = null; voice.recCid = null; voice.transcript = '';
    renderTags();
  }

  function finalizeComposerRec() {
    voice.rec = null; voice.mode = null; voice.composerStartText = '';
    renderComposerMic();
  }

  // ─── Tag rendering (right panel) ─────────────────────────────────────────
  function renderTags() {
    const root = $('#tagList');
    root.innerHTML = '';
    const hasContent = voice.recCid !== null || voice.tags.length > 0;
    $('#clearTagsBtn').disabled = voice.tags.length === 0;
    $('#composerTagCount').textContent = voice.tags.length + ' tag' + (voice.tags.length === 1 ? '' : 's') + ' attached';
    updateComposerSendState();

    if (!hasContent) {
      root.appendChild(el('div', { className: 'empty-hint' },
        'No context yet.',
        el('br'),
        el('br'),
        'Hold ',
        el('kbd', null, 'Alt'),
        ' and click any element to record a voice tag attached to that target. ',
        el('kbd', null, 'Alt+I'),
        ' toggles the dev outline so every cid becomes visible.'
      ));
      return;
    }

    if (voice.recCid) {
      const t = el('div', { className: 'tag recording', attrs: { 'data-cid': 'tag-recording' } });
      const head = el('div', { className: 'tag-head' });
      head.appendChild(el('span', { className: 'cidlabel' }, 'recording · ' + voice.recCid));
      head.appendChild(el('button', { onclick: stopRecord, title: 'stop recording' }, 'stop'));
      t.appendChild(head);
      t.appendChild(el('span', { className: 'ctext pending-rec' }, voice.transcript || '(speak now…)'));
      root.appendChild(t);
    }

    for (const tag of voice.tags) {
      const t = el('div', { className: 'tag', attrs: { 'data-cid': 'tag-' + tag.id } });
      const head = el('div', { className: 'tag-head' });
      head.appendChild(el('span', { className: 'cidlabel' }, tag.cid));
      t.appendChild(head);
      t.appendChild(el('span', { className: 'ctext' }, tag.text));
      const acts = el('div', { className: 'actions' });
      const canInject = tag.cid.startsWith('env-input-') || tag.cid.startsWith('env-var-');
      if (canInject) {
        acts.appendChild(el('button', { className: 'primary', title: 'inject transcript into matching input', onclick: () => injectTagIntoInput(tag) }, 'use as value'));
      }
      acts.appendChild(el('button', { title: 'copy transcript to clipboard', onclick: () => { navigator.clipboard.writeText(tag.text); toast('copied'); } }, 'copy'));
      acts.appendChild(el('button', { className: 'danger', title: 'detach this tag', onclick: () => dismissTag(tag.id) }, 'remove'));
      t.appendChild(acts);
      root.appendChild(t);
    }
  }

  function injectTagIntoInput(tag) {
    const key = tag.cid.replace(/^env-(input|var)-/, '').toUpperCase();
    const input = document.querySelector('input[data-key="' + key + '"]');
    if (!input) { toast('no matching input for ' + key, true); return; }
    input.value = tag.text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    toast('inserted into ' + key);
    dismissTag(tag.id);
  }

  function dismissTag(id) { voice.tags = voice.tags.filter((t) => t.id !== id); renderTags(); }
  function clearAllTags() { voice.tags = []; renderTags(); }

  // ─── Composer mic + send ─────────────────────────────────────────────────
  function toggleComposerMic() {
    if (voice.mode === 'composer') stopRecord();
    else startComposerRecord();
  }
  function renderComposerMic() {
    const btn = $('#composerMicBtn');
    if (voice.mode === 'composer') {
      btn.classList.add('recording');
      btn.textContent = 'stop';
    } else {
      btn.classList.remove('recording');
      btn.textContent = 'mic';
    }
  }
  function updateComposerSendState() {
    const text = $('#composerInput').value.trim();
    const hasContent = text.length > 0 || voice.tags.length > 0;
    $('#composerSendBtn').disabled = !hasContent;
  }
  function submitComposer(ev) {
    ev.preventDefault();
    const text = $('#composerInput').value.trim();
    if (!text && voice.tags.length === 0) return;
    const entry = {
      id: 'h' + Date.now(),
      prompt: text,
      tags: voice.tags.map((t) => ({ cid: t.cid, text: t.text })),
      ts: new Date().toISOString(),
    };
    voice.history.unshift(entry);
    if (voice.history.length > 12) voice.history.pop();
    // Reset
    $('#composerInput').value = '';
    voice.tags = [];
    renderTags();
    renderHistory();
    toast('captured: ' + entry.tags.length + ' tag' + (entry.tags.length === 1 ? '' : 's') + (text ? ' + prompt' : ''));
  }
  function renderHistory() {
    const root = $('#historyList');
    root.innerHTML = '';
    if (voice.history.length === 0) return;
    root.appendChild(el('h3', null, 'recent submissions'));
    for (const h of voice.history) {
      const e = el('div', { className: 'h-entry' });
      e.appendChild(el('div', { className: 'h-time' }, new Date(h.ts).toLocaleTimeString()));
      if (h.prompt) e.appendChild(el('div', { className: 'h-prompt' }, h.prompt));
      if (h.tags.length > 0) {
        const tagBlock = el('div', { className: 'h-tags' });
        for (const t of h.tags) tagBlock.appendChild(el('code', { title: t.text }, t.cid));
        e.appendChild(tagBlock);
      }
      root.appendChild(e);
    }
  }

  // Wire composer text events
  document.addEventListener('DOMContentLoaded', () => {
    const input = $('#composerInput');
    if (input) input.addEventListener('input', updateComposerSendState);
  });
  setTimeout(() => {
    const input = $('#composerInput');
    if (input && !input._wired) { input.addEventListener('input', updateComposerSendState); input._wired = true; }
  }, 0);

  // Alt+click → target-mode recording (composer-mode is button-driven)
  document.addEventListener('click', (e) => {
    if (!e.altKey) return;
    const target = e.target.closest('[data-cid]');
    if (!target) return;
    // Don't trigger target-record on side-panel internals (they have their own buttons).
    const cid = target.getAttribute('data-cid');
    if (cid.startsWith('env-web-side-panel') || cid.startsWith('env-web-composer') || cid.startsWith('env-web-tag-list') || cid.startsWith('env-web-history') || cid.startsWith('tag-')) return;
    e.preventDefault(); e.stopPropagation();
    if (voice.mode === 'target' && voice.recCid === cid) stopRecord();
    else if (voice.mode === 'target') stopRecord();  // finalize current, start new on next click cycle
    else startTargetRecord(cid);
  }, true);

  // Initial render of the empty-hint
  renderTags();

  // ─── Wire UI ─────────────────────────────────────────────────────────────
  $('#projectSel').addEventListener('change', (e) => {
    state.project = state.projects.find((p) => p.id === e.target.value);
    loadSchemaAndValues();
  });
  $('#envSel').addEventListener('change', (e) => { state.env = e.target.value; loadSchemaAndValues(); });

  (async () => {
    try { await loadProjects(); await loadSchemaAndValues(); }
    catch (err) { toast('init error: ' + err.message, true); }
  })();
</script>
</body></html>`;
}

// ─── Citty subcommand ────────────────────────────────────────────────────────

function createEnvWebCommand() {
  return defineCommand({
    meta: {
      name: 'web',
      description: 'Localhost env management surface — schema-driven inputs aggregated across all .env.example files in the active project, per-environment switching (.env.local / .env.production / etc.), .env base layer fallback, paste-to-distribute bulk parser. Built-in VCS: Alt+I toggles dev ids, Alt+click on any cid voice-records a chip. Default port 3030.',
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
      console.log(`[gad env web] projects    : ${projects.length} (${projects.map((p) => p.id + '×' + p.sourceCount).join(', ')})`);
      console.log(`[gad env web] starting on http://localhost:${port}`);
      const server = makeServer(repoRoot);
      server.on('error', (err) => { console.error(`[gad env web] server error: ${err.message}`); process.exit(1); });
      server.listen(port, '127.0.0.1', () => {
        console.log(`[gad env web] http://localhost:${port} ready. Ctrl+C to stop.`);
        if (!args['no-open']) openBrowser(`http://localhost:${port}`);
      });
    },
  });
}

module.exports = { createEnvWebCommand };
