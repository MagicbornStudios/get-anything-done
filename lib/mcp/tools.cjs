'use strict';
/**
 * lib/mcp/tools.cjs — GAD tool registry exposed via MCP.
 *
 * Each tool is a thin wrapper over an existing gad CLI primitive — no
 * duplicated business logic. The MCP server is a transport, not a
 * second source-of-truth.
 *
 * Phase 157. Adding a new tool: define it here with name + description +
 * inputSchema + run(args), and it shows up in tools/list automatically.
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const GAD_CLI = path.resolve(__dirname, '..', '..', 'bin', 'gad.cjs');

function runGad(args, { input } = {}) {
  // Run via node (the installed gad.exe may lag local source)
  const result = execFileSync('node', [GAD_CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result;
}

function safeRunGad(args, opts) {
  try { return { ok: true, output: runGad(args, opts) }; }
  catch (e) { return { ok: false, error: e.stderr || e.message || String(e) }; }
}

const TOOLS = [
  {
    name: 'gad_provenance_stats',
    description: 'Summary counts of provenance events by project / model / label. Optional projectid filter.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string', description: 'Filter to one project (optional)' },
      },
    },
    run: async (args) => {
      const cliArgs = ['provenance', 'stats'];
      if (args.projectid) cliArgs.push('--projectid', args.projectid);
      const r = safeRunGad(cliArgs);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_provenance_lookup',
    description: 'Find which event(s) wrote a file (or specific line). Returns model + task + phase + label.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'file path, optionally with :line suffix (e.g. apps/foo.ts:42)' },
        projectid: { type: 'string' },
      },
      required: ['target', 'projectid'],
    },
    run: async (args) => {
      const r = safeRunGad(['provenance', 'lookup', args.target, '--projectid', args.projectid]);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_concerns_list',
    description: 'List code-VCS @concern landmarks for a project. Each id maps to its file.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string' },
      },
      required: ['projectid'],
    },
    run: async (args) => {
      const r = safeRunGad(['concerns', 'list', '--projectid', args.projectid]);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_concerns_show',
    description: 'Show full record for one @concern id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Concern id (e.g. stripe.checkout)' },
        projectid: { type: 'string' },
      },
      required: ['id', 'projectid'],
    },
    run: async (args) => {
      const r = safeRunGad(['concerns', 'show', args.id, '--projectid', args.projectid]);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_handoffs_list',
    description: 'List open handoffs across all projects (or one). Returns id + projectid + phase + task_id + claimed_by.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string' },
        'mine-first': { type: 'boolean' },
      },
    },
    run: async (args) => {
      const cliArgs = ['handoffs', 'list'];
      if (args.projectid) cliArgs.push('--projectid', args.projectid);
      if (args['mine-first']) cliArgs.push('--mine-first');
      const r = safeRunGad(cliArgs);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_todos_list',
    description: 'List pending operator todos.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string' },
      },
    },
    run: async (args) => {
      const cliArgs = ['todos', 'list'];
      if (args.projectid) cliArgs.push('--projectid', args.projectid);
      const r = safeRunGad(cliArgs);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_todos_add',
    description: 'Capture a new todo for the operator.',
    inputSchema: {
      type: 'object',
      properties: {
        body: { type: 'string', description: 'Todo body (one or two lines)' },
        projectid: { type: 'string' },
      },
      required: ['body'],
    },
    run: async (args) => {
      const cliArgs = ['todos', 'add', '--body', args.body];
      if (args.projectid) cliArgs.push('--projectid', args.projectid);
      const r = safeRunGad(cliArgs);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_decisions_list',
    description: 'List decisions for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string' },
        search: { type: 'string', description: 'Free-text search filter' },
      },
      required: ['projectid'],
    },
    run: async (args) => {
      const cliArgs = ['decisions', 'list', '--projectid', args.projectid];
      if (args.search) cliArgs.push('--search', args.search);
      const r = safeRunGad(cliArgs);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_state_log',
    description: 'Append a one-line state log entry to STATE.xml for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'One-line summary (newest-first)' },
        projectid: { type: 'string' },
        tags: { type: 'string', description: 'Comma-separated tags (optional)' },
      },
      required: ['message', 'projectid'],
    },
    run: async (args) => {
      const cliArgs = ['state', 'log', args.message, '--projectid', args.projectid];
      if (args.tags) cliArgs.push('--tags', args.tags);
      const r = safeRunGad(cliArgs);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_team_health',
    description: 'Worker + dispatcher liveness across all projects (or one).',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string' },
        'only-bad': { type: 'boolean' },
      },
    },
    run: async (args) => {
      const cliArgs = ['team-health', '--json'];
      if (args.projectid) cliArgs.push('--projectid', args.projectid);
      if (args['only-bad']) cliArgs.push('--only-bad');
      const r = safeRunGad(cliArgs);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_env_list',
    description: 'List BYOK env keys for a project (names + metadata only — never values).',
    inputSchema: {
      type: 'object',
      properties: {
        projectid: { type: 'string' },
      },
      required: ['projectid'],
    },
    run: async (args) => {
      const r = safeRunGad(['env', 'list', '--projectid', args.projectid, '--json']);
      return r.ok ? r.output : `Error: ${r.error}`;
    },
  },
  {
    name: 'gad_ask_operator',
    description: 'Request human-in-the-loop input from the operator. Pops a browser form, blocks until operator submits. Use for env vars / BYOK keys / decision approvals / open questions. Returns the operator\'s answer.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['env', 'todo', 'decision', 'byok', 'text'], description: 'Form kind' },
        title: { type: 'string', description: 'Question or prompt shown to operator' },
        details: { type: 'string', description: 'Optional longer context' },
        key: { type: 'string', description: 'For kind=env/byok: the env key name' },
        projectid: { type: 'string', description: 'For kind=env/byok: project to scope to' },
        timeout_seconds: { type: 'number', description: 'Max wait (default 600)' },
      },
      required: ['kind', 'title'],
    },
    run: async (args) => {
      const cliArgs = ['ask', args.kind, '--title', args.title, '--mcp'];
      if (args.details) cliArgs.push('--details', args.details);
      if (args.key) cliArgs.push('--key', args.key);
      if (args.projectid) cliArgs.push('--projectid', args.projectid);
      if (args.timeout_seconds) cliArgs.push('--timeout', String(args.timeout_seconds));
      const r = safeRunGad(cliArgs);
      return r.ok ? r.output.trim() : `Error: ${r.error}`;
    },
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function listTools() { return TOOLS; }
function getTool(name) { return BY_NAME.get(name); }

module.exports = { listTools, getTool };
