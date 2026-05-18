'use strict';
/**
 * bin/commands/repos.cjs — `gad repos` family (Phase 256-03)
 *
 * Manages a per-project repo registry at `.planning/repos.toml`.
 *
 * Subcommands:
 *   gad repos add <name> --path <p> [--remote <url>] [--default-branch <b>]
 *                                   [--github-owner <o>] [--github-repo <r>]
 *   gad repos list [--json]
 *   gad repos remove <name>
 *   gad repos show <name>
 *
 * Distinct namespace from `gad config register` (.gad/registry.json for
 * planning roots) — repos.toml is for git repos (cloneable, branchable),
 * not planning roots. Per 256 open-question decision: reuse registry
 * pattern but separate namespace.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
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
    // Unescape TOML basic string escape sequences
    return raw.slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
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

  return defineCommand({
    meta: { name: 'repos', description: 'Manage git repo registry (.planning/repos.toml)' },
    subCommands: {
      add: addCmd,
      list: listCmd,
      remove: removeCmd,
      show: showCmd,
    },
  });
}

function register({ common }) {
  const { findRepoRoot, outputError } = common;
  const reposCmd = createReposCommand({ findRepoRoot, outputError });
  return { repos: reposCmd };
}

module.exports = { createReposCommand, register };
