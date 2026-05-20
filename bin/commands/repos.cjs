'use strict';
/**
 * bin/commands/repos.cjs — `gad repos` family (Phase 256-03 + 266-05)
 *
 * Manages a per-project repo registry at `.planning/repos.toml`.
 *
 * Subcommands:
 *   gad repos add <name> --path <p> [--remote <url>] [--default-branch <b>]
 *                                   [--github-owner <o>] [--github-repo <r>]
 *   gad repos list [--json]
 *   gad repos remove <name>
 *   gad repos show <name>
 *   gad repos clone <url> [--name <n>] [--branch <b>] [--depth <d>]
 *   gad repos distill <name> [--out <path>] [--dry-run]
 *
 * clone  — git clone into vendor/research/<name>, then auto-register.
 * distill — read key files (README, manifest, top-level src), call the
 *            configured ai-chat-backend (same seam as .planning/commands/themes.cjs),
 *            write .planning/references/<name>.md with frontmatter.
 *
 * Distinct namespace from `gad config register` (.gad/registry.json for
 * planning roots) — repos.toml is for git repos (cloneable, branchable),
 * not planning roots. Per 256 open-question decision: reuse registry
 * pattern but separate namespace.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { defineCommand } = require('citty');

// ── TOML helpers ──────────────────────────────────────────────────────────────
// Inline minimal TOML serialiser — mirrors gad-config.cjs parser for the
// [[repos]] array-of-tables format.

function parseReposToml(src) {
  const root = { repos: [] };
  let current = null;

  for (const raw of src.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;

    if (line === '[[repos]]') {
      current = {};
      root.repos.push(current);
      continue;
    }

    if (!current) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const rawVal = line.slice(eqIdx + 1).trim();
    current[key] = parseTomlValue(rawVal);
  }

  return root;
}

function parseTomlValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.startsWith('"') && raw.endsWith('"')) {
    // Unescape TOML basic string escape sequences — single-pass to avoid
    // double-unescape (e.g. \\r must become literal \r not carriage return).
    return raw.slice(1, -1).replace(/\\(\\|n|t|r|")/g, (_, c) => {
      if (c === '\\') return '\\';
      if (c === 'n')  return '\n';
      if (c === 't')  return '\t';
      if (c === 'r')  return '\r';
      if (c === '"')  return '"';
      return c;
    });
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    // Literal string — no escaping
    return raw.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function serializeReposToml(data) {
  const lines = [];
  lines.push('# .planning/repos.toml — managed by `gad repos` (phase 256-03)');
  lines.push('# Schema: [[repos]] table with name, path, remote, default_branch,');
  lines.push('#   github_owner, github_repo (all optional except name + path).');
  lines.push('');

  for (const repo of data.repos || []) {
    lines.push('[[repos]]');
    for (const [k, v] of Object.entries(repo)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'boolean') {
        lines.push(`${k} = ${v}`);
      } else if (typeof v === 'number') {
        lines.push(`${k} = ${v}`);
      } else {
        lines.push(`${k} = "${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Registry helpers ──────────────────────────────────────────────────────────

function findReposTomlPath(findRepoRoot) {
  const root = findRepoRoot();
  return path.join(root, '.planning', 'repos.toml');
}

function loadRepos(tomlPath) {
  if (!fs.existsSync(tomlPath)) return [];
  const src = fs.readFileSync(tomlPath, 'utf8');
  return parseReposToml(src).repos || [];
}

function saveRepos(tomlPath, repos) {
  const dir = path.dirname(tomlPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tomlPath, serializeReposToml({ repos }), 'utf8');
}

// ── AI backend helpers (same seam as .planning/commands/themes.cjs) ───────────

/**
 * Load .planning/.ai-backend-config.json.
 * Falls back to ollama localhost if absent or malformed.
 * RULE: no AI SDK — raw fetch only (project memory feedback_no_ai_sdk_use_openai_compatible.md).
 */
function loadBackendConfig(projectRoot) {
  const cfgPath = path.join(projectRoot, '.planning', '.ai-backend-config.json');
  const defaults = {
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    model: 'llama3.2:3b-instruct-q4_K_M',
  };
  if (!fs.existsSync(cfgPath)) return defaults;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return {
      baseURL: cfg.baseURL || defaults.baseURL,
      apiKey: cfg.apiKey || defaults.apiKey,
      model: cfg.model || defaults.model,
    };
  } catch {
    return defaults;
  }
}

/**
 * OpenAI-compatible /chat/completions call — pure fetch, no AI SDK.
 * Mirrors themes.cjs::callBackend (themes.cjs line 135-160).
 */
async function callBackend(backendCfg, messages) {
  const url = backendCfg.baseURL.replace(/\/$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backendCfg.apiKey}`,
    },
    body: JSON.stringify({
      model: backendCfg.model,
      messages,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Backend returned HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Backend response missing choices[0].message.content');
  }
  return content;
}

// ── Distill helpers ───────────────────────────────────────────────────────────

/**
 * Collect representative files from a repo for the distill prompt.
 * Bounded: README(s), package.json / Cargo.toml / pyproject.toml,
 * top-level source files (max 6, max 2000 chars each), AGENTS.md / CLAUDE.md.
 */
function collectDistillFiles(repoPath) {
  const collected = [];

  function tryRead(rel, maxChars = 3000) {
    const full = path.join(repoPath, rel);
    if (!fs.existsSync(full)) return null;
    try {
      const raw = fs.readFileSync(full, 'utf8');
      return { rel, content: raw.slice(0, maxChars) + (raw.length > maxChars ? '\n... (truncated)' : '') };
    } catch { return null; }
  }

  // 1. README (root)
  for (const name of ['README.md', 'README.txt', 'README.rst', 'README']) {
    const r = tryRead(name, 4000);
    if (r) { collected.push(r); break; }
  }

  // 2. Manifest files (all that exist)
  for (const mf of ['package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod', 'setup.py', 'composer.json']) {
    const r = tryRead(mf, 2000);
    if (r) collected.push(r);
  }

  // 3. Agent/project instruction files (context)
  for (const af of ['AGENTS.md', 'CLAUDE.md', 'CONTRIBUTING.md']) {
    const r = tryRead(af, 2000);
    if (r) collected.push(r);
  }

  // 4. Top-level source files (max 6, skip node_modules/target/dist/.git)
  const srcExts = new Set(['.ts', '.tsx', '.js', '.rs', '.py', '.go', '.rb']);
  try {
    const entries = fs.readdirSync(repoPath, { withFileTypes: true });
    let srcCount = 0;
    for (const e of entries) {
      if (srcCount >= 6) break;
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!srcExts.has(ext)) continue;
      const r = tryRead(e.name, 1500);
      if (r) { collected.push(r); srcCount++; }
    }
  } catch { /* ignore */ }

  return collected;
}

/** Build the distill system prompt */
const DISTILL_SYSTEM = `You are a technical documentation assistant. Given source files from a repository, produce a concise reference document in Markdown.

Structure your output as:
# Overview
One paragraph: what this project does, its primary purpose.

## Architecture
Key components, modules, layers. Bullet list.

## Key APIs / Entry Points
Functions, commands, or interfaces that an external consumer would call. Include signatures/shapes where available.

## Patterns & Conventions
Coding conventions, important idioms, design patterns used.

## Integration Notes
How to depend on / embed / call this project from another codebase. Known requirements or gotchas.

Be concise — aim for 400-700 words total. This document will be used by agents building apps on top of this codebase.`;

/**
 * Build the user message with collected file contents.
 */
function buildDistillPrompt(repoName, files) {
  const fileBlocks = files.map(f =>
    `### ${f.rel}\n\`\`\`\n${f.content}\n\`\`\``
  ).join('\n\n');
  return `Distill a reference document for the repository: **${repoName}**\n\nSource files:\n\n${fileBlocks}`;
}

/**
 * Get the current HEAD commit hash of a local repo (best effort).
 */
function getHeadCommit(repoPath) {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch { return 'unknown'; }
}

// ── Command factory ───────────────────────────────────────────────────────────

function createReposCommand(deps) {
  const { findRepoRoot, outputError } = deps;

  const addCmd = defineCommand({
    meta: { name: 'add', description: 'Register a git repo in .planning/repos.toml' },
    args: {
      name: { type: 'positional', required: true, description: 'Short name for the repo' },
      path: { type: 'string', required: true, description: 'Absolute or relative path to repo root' },
      remote: { type: 'string', description: 'Remote URL (e.g. https://github.com/owner/repo)' },
      'default-branch': { type: 'string', default: 'main', description: 'Default branch name' },
      'github-owner': { type: 'string', description: 'GitHub owner / org' },
      'github-repo': { type: 'string', description: 'GitHub repo name (without owner)' },
    },
    async run({ args }) {
      const tomlPath = findReposTomlPath(findRepoRoot);
      const repos = loadRepos(tomlPath);

      const resolvedPath = path.isAbsolute(args.path)
        ? args.path
        : path.resolve(process.cwd(), args.path);

      if (repos.find(r => r.name === args.name)) {
        outputError(`Repo "${args.name}" already registered. Use \`gad repos remove\` first.`);
        process.exit(1);
      }

      const entry = { name: args.name, path: resolvedPath };
      if (args.remote) entry.remote = args.remote;
      entry.default_branch = args['default-branch'] || 'main';
      if (args['github-owner']) entry.github_owner = args['github-owner'];
      if (args['github-repo']) entry.github_repo = args['github-repo'];
      entry.registered_at = new Date().toISOString();

      repos.push(entry);
      saveRepos(tomlPath, repos);
      console.log(`Registered repo "${args.name}" → ${resolvedPath}`);
    },
  });

  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List all registered repos' },
    args: {
      json: { type: 'boolean', default: false, description: 'Output as JSON' },
    },
    async run({ args }) {
      const tomlPath = findReposTomlPath(findRepoRoot);
      const repos = loadRepos(tomlPath);
      if (args.json) {
        console.log(JSON.stringify(repos, null, 2));
        return;
      }
      if (repos.length === 0) {
        console.log('No repos registered. Use `gad repos add <name> --path <path>` to add one.');
        return;
      }
      const namePad = Math.max(...repos.map(r => r.name.length), 4);
      const branchPad = Math.max(...repos.map(r => (r.default_branch || '').length), 6);
      console.log(`${'NAME'.padEnd(namePad)}  ${'DEFAULT-BRANCH'.padEnd(branchPad)}  PATH`);
      console.log(`${'-'.repeat(namePad)}  ${'-'.repeat(branchPad)}  ${'-'.repeat(40)}`);
      for (const r of repos) {
        console.log(`${r.name.padEnd(namePad)}  ${(r.default_branch || 'main').padEnd(branchPad)}  ${r.path}`);
      }
    },
  });

  const removeCmd = defineCommand({
    meta: { name: 'remove', description: 'Remove a repo from .planning/repos.toml' },
    args: {
      name: { type: 'positional', required: true, description: 'Repo name to remove' },
    },
    async run({ args }) {
      const tomlPath = findReposTomlPath(findRepoRoot);
      const repos = loadRepos(tomlPath);
      const before = repos.length;
      const filtered = repos.filter(r => r.name !== args.name);
      if (filtered.length === before) {
        outputError(`Repo "${args.name}" not found.`);
        process.exit(1);
      }
      saveRepos(tomlPath, filtered);
      console.log(`Removed repo "${args.name}".`);
    },
  });

  const showCmd = defineCommand({
    meta: { name: 'show', description: 'Show details for a registered repo' },
    args: {
      name: { type: 'positional', required: true, description: 'Repo name' },
    },
    async run({ args }) {
      const tomlPath = findReposTomlPath(findRepoRoot);
      const repos = loadRepos(tomlPath);
      const repo = repos.find(r => r.name === args.name);
      if (!repo) {
        outputError(`Repo "${args.name}" not found.`);
        process.exit(1);
      }
      for (const [k, v] of Object.entries(repo)) {
        console.log(`${k.padEnd(20)} ${v}`);
      }
    },
  });

  // ── clone — git clone → vendor/research/<name> then auto-register ───────────

  const cloneCmd = defineCommand({
    meta: { name: 'clone', description: 'Clone a remote repo into vendor/research/<name> and register it' },
    args: {
      url: { type: 'positional', required: true, description: 'Remote URL to clone (https or ssh)' },
      name: { type: 'string', description: 'Short name for the repo (default: inferred from URL)' },
      branch: { type: 'string', description: 'Branch to clone (default: remote default)' },
      depth: { type: 'string', default: '1', description: 'Clone depth (default: 1 for shallow clone)' },
    },
    async run({ args }) {
      const root = findRepoRoot();
      const tomlPath = findReposTomlPath(findRepoRoot);
      const repos = loadRepos(tomlPath);

      // Infer name from URL if not provided
      const inferred = (args.url || '').replace(/\.git$/, '').split(/[\\/]/).pop() || '';
      const name = (args.name || inferred || '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
      if (!name) {
        outputError('Could not infer repo name from URL. Pass --name <n>.');
        process.exit(1);
      }

      // Target: vendor/research/<name>
      const vendorResearch = path.join(root, 'vendor', 'research');
      const destPath = path.join(vendorResearch, name);

      if (fs.existsSync(destPath)) {
        console.log(`vendor/research/${name} already exists — skipping clone.`);
      } else {
        fs.mkdirSync(vendorResearch, { recursive: true });

        const gitArgs = ['git', 'clone'];
        if (args.depth) gitArgs.push(`--depth`, args.depth);
        if (args.branch) gitArgs.push('-b', args.branch);
        gitArgs.push(args.url, destPath);

        console.log(`Cloning ${args.url} → vendor/research/${name} …`);
        try {
          execSync(gitArgs.join(' '), { stdio: 'inherit', cwd: root });
          console.log(`Clone complete.`);
        } catch (e) {
          outputError(`git clone failed: ${e.message || e}`);
          process.exit(1);
        }
      }

      // Auto-register if not already registered
      if (repos.find(r => r.name === name)) {
        console.log(`Repo "${name}" already registered in repos.toml.`);
      } else {
        const entry = {
          name,
          path: destPath,
          remote: args.url,
          default_branch: args.branch || 'main',
          registered_at: new Date().toISOString(),
          is_research: true,
        };
        repos.push(entry);
        saveRepos(tomlPath, repos);
        console.log(`Registered repo "${name}" → ${destPath}`);
      }

      console.log(`\nNext: gad repos distill ${name}`);
    },
  });

  // ── distill — LLM pass → .planning/references/<name>.md ─────────────────────

  const distillCmd = defineCommand({
    meta: { name: 'distill', description: 'Distill a registered repo into a reference doc at .planning/references/<name>.md' },
    args: {
      name: { type: 'positional', required: true, description: 'Repo name (must be registered)' },
      out: { type: 'string', description: 'Output path override (default: .planning/references/<name>.md)' },
      'dry-run': { type: 'boolean', default: false, description: 'Print prompt only — do not call backend or write file' },
    },
    async run({ args }) {
      const root = findRepoRoot();
      const tomlPath = findReposTomlPath(findRepoRoot);
      const repos = loadRepos(tomlPath);
      const repo = repos.find(r => r.name === args.name);
      if (!repo) {
        outputError(`Repo "${args.name}" not found. Run \`gad repos list\` to see registered repos.`);
        process.exit(1);
      }

      if (!fs.existsSync(repo.path)) {
        outputError(`Repo path does not exist: ${repo.path}\nRun \`gad repos clone <url> --name ${args.name}\` first.`);
        process.exit(1);
      }

      // Collect key files
      console.log(`Collecting files from ${repo.path} …`);
      const files = collectDistillFiles(repo.path);
      if (files.length === 0) {
        outputError(`No indexable files found in ${repo.path}`);
        process.exit(1);
      }
      console.log(`  ${files.length} file(s) collected: ${files.map(f => f.rel).join(', ')}`);

      const userPrompt = buildDistillPrompt(args.name, files);

      if (args['dry-run']) {
        console.log('\n--- SYSTEM ---\n' + DISTILL_SYSTEM);
        console.log('\n--- USER ---\n' + userPrompt);
        return;
      }

      // Call ai-chat-backend
      const backend = loadBackendConfig(root);
      console.log(`\nCalling backend: ${backend.baseURL} model=${backend.model} …`);

      let content;
      try {
        content = await callBackend(backend, [
          { role: 'system', content: DISTILL_SYSTEM },
          { role: 'user', content: userPrompt },
        ]);
      } catch (e) {
        outputError(`Backend call failed: ${e.message || e}`);
        process.exit(1);
      }

      // Write reference doc with frontmatter
      const refsDir = path.join(root, '.planning', 'references');
      fs.mkdirSync(refsDir, { recursive: true });
      const outPath = args.out
        ? (path.isAbsolute(args.out) ? args.out : path.resolve(process.cwd(), args.out))
        : path.join(refsDir, `${args.name}.md`);

      const commit = getHeadCommit(repo.path);
      const frontmatter = [
        '---',
        `source_repo: "${repo.name}"`,
        `remote: "${repo.remote || ''}"`,
        `source_path: "${repo.path}"`,
        `distilled_at: "${new Date().toISOString()}"`,
        `commit: "${commit}"`,
        `model: "${backend.model}"`,
        '---',
        '',
      ].join('\n');

      fs.writeFileSync(outPath, frontmatter + content + '\n', 'utf8');

      // Update repos.toml with distilled_at + ref_doc path
      const idx = repos.findIndex(r => r.name === args.name);
      if (idx !== -1) {
        repos[idx].distilled_at = new Date().toISOString();
        repos[idx].ref_doc = path.relative(root, outPath).replace(/\\/g, '/');
        saveRepos(tomlPath, repos);
      }

      console.log(`\nReference doc written → ${outPath}`);
      console.log(`  Indexed by: embeddings (embeddings_index re-run picks up .planning/references/*.md)`);
    },
  });

  return defineCommand({
    meta: { name: 'repos', description: 'Manage git repo registry (.planning/repos.toml)' },
    subCommands: {
      add: addCmd,
      list: listCmd,
      remove: removeCmd,
      show: showCmd,
      clone: cloneCmd,
      distill: distillCmd,
    },
  });
}

function register({ common }) {
  const { findRepoRoot, outputError } = common;
  const reposCmd = createReposCommand({ findRepoRoot, outputError });
  return { repos: reposCmd };
}

module.exports = { createReposCommand, register };
