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
 * Phase 161: added list_components, describe_component, find_component.
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const GAD_CLI = path.resolve(__dirname, '..', '..', 'bin', 'gad.cjs');
const GAD_CONFIG_PATH = path.resolve(__dirname, '..', '..', 'bin', 'gad-config.cjs');

// ---------------------------------------------------------------------------
// mcp-app manifest registry — loaded once per serve boot, reloaded on mtime change
// ---------------------------------------------------------------------------

const { aggregateManifests, findComponent: _findComponent } = require('../mcp-app/index.cjs');
const { runSweep } = require('../handoffs-sweep/index.cjs');
const GAD_CONFIG_PATH_FOR_SWEEP = path.resolve(__dirname, '..', '..', 'bin', 'gad-config.cjs');

// Lazy-loaded deps for sweep (mirrors how overnight.cjs gets its deps)
function _getSweepDeps() {
  const gadConfig = require(GAD_CONFIG_PATH_FOR_SWEEP);
  return {
    findRepoRoot: () => REPO_ROOT,
    gadConfig,
  };
}

/** Map from planningDir absolute path → last mtime (ms) of the manifest file. */
const _manifestMtimes = new Map();
/** Cached registry — { components, intent_capture, agent_issues } */
let _registry = null;

function _getManifestMtime(planningDir) {
  const p = path.join(planningDir, 'mcp-app.json');
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
}

/**
 * Return the current aggregated registry. Loads on first call; reloads
 * any individual manifest whose mtime changed since last load.
 */
function _getRegistry() {
  let gadConfig;
  try { gadConfig = require(GAD_CONFIG_PATH); } catch { return { components: [], intent_capture: [], agent_issues: {} }; }

  const config = gadConfig.load(REPO_ROOT);
  const projects = (config.roots || []).map((r) => ({
    projectId: r.id,
    rootPath: path.resolve(REPO_ROOT, r.path),
    planningDir: path.resolve(REPO_ROOT, r.path, r.planningDir || '.planning'),
  }));

  // Check if any manifest mtime changed
  let dirty = _registry === null;
  if (!dirty) {
    for (const proj of projects) {
      const current = _getManifestMtime(proj.planningDir);
      if (current !== (_manifestMtimes.get(proj.planningDir) || 0)) { dirty = true; break; }
    }
  }

  if (dirty) {
    _registry = aggregateManifests(projects);
    for (const proj of projects) {
      _manifestMtimes.set(proj.planningDir, _getManifestMtime(proj.planningDir));
    }
  }

  return _registry;
}

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

  // -------------------------------------------------------------------------
  // Phase 164 — on-demand handoff sweep (replaces always-on overnight daemon)
  // -------------------------------------------------------------------------

  {
    name: 'sweep_handoffs',
    description:
      'Run the handoff-sweep cycle on demand: restart stalled workers (after 2 strikes), ' +
      'build+export provenance (skipped if no new traces), auto-close phases with all tasks done, ' +
      'create handoffs for phases with planned-but-unclaimed work. Returns a JSON summary. ' +
      'Use when operator asks "sweep the team", "check on workers", "run a tick", or after a long ' +
      'idle period to reactivate the queue. Pass dry_run=true to preview without mutating.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Restrict sweep to one project id (e.g. "global"). Omit for all projects.' },
        dry_run: { type: 'boolean', description: 'Preview mode — reads state but does not restart workers, build provenance, close phases, or create handoffs.' },
        skip_health: { type: 'boolean', description: 'Skip the worker health/restart step.' },
        skip_provenance: { type: 'boolean', description: 'Skip the provenance build+export step.' },
        skip_sweep: { type: 'boolean', description: 'Skip the phase auto-close step.' },
        skip_handoffs: { type: 'boolean', description: 'Skip the handoff creation step.' },
      },
    },
    run: async (args) => {
      const messages = [];
      const log = (m) => messages.push(`[${new Date().toISOString()}] ${m}`);
      const deps = _getSweepDeps();
      const projectFilter = args.project ? [args.project] : undefined;
      const options = {
        dry_run: Boolean(args.dry_run),
        skip_health: Boolean(args.skip_health),
        skip_provenance: Boolean(args.skip_provenance),
        skip_sweep: Boolean(args.skip_sweep),
        skip_handoffs: Boolean(args.skip_handoffs),
      };
      let summary;
      try {
        summary = await runSweep({ deps, log, projects: projectFilter, options });
      } catch (e) {
        return JSON.stringify({ ok: false, error: e.message, log: messages }, null, 2);
      }
      return JSON.stringify({ ...summary, log: messages }, null, 2);
    },
  },

  // -------------------------------------------------------------------------
  // Phase 161 — mcp-app tray tools
  // -------------------------------------------------------------------------

  {
    name: 'list_components',
    description: 'List all MCP-navigable UI components declared in mcp-app.json manifests across all projects. Optionally filter to one project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Optional project id to filter (e.g. "global")' },
      },
    },
    run: async (args) => {
      const registry = _getRegistry();
      const components = args.project
        ? registry.components.filter((c) => c.project === args.project)
        : registry.components;
      if (components.length === 0) {
        return args.project
          ? `No components found for project "${args.project}".`
          : 'No mcp-app manifests found across any project.';
      }
      const lines = components.map(
        (c) => `[${c.project}] ${c.id}  (${c.surface})  — ${c.title}\n    intent: ${c.intent}\n    route: ${c.route}`
      );
      return `${components.length} component(s):\n\n${lines.join('\n\n')}`;
    },
  },

  {
    name: 'describe_component',
    description: 'Return the full spec for one MCP component by id, including args, capabilities, route, and tags.',
    inputSchema: {
      type: 'object',
      properties: {
        component_id: { type: 'string', description: 'Component id (kebab-case, e.g. "kael-route")' },
      },
      required: ['component_id'],
    },
    run: async (args) => {
      const registry = _getRegistry();
      const comp = registry.components.find((c) => c.id === args.component_id);
      if (!comp) {
        const ids = registry.components.map((c) => c.id).join(', ') || '(none)';
        return `Error: component "${args.component_id}" not found. Known ids: ${ids}`;
      }
      return JSON.stringify(comp, null, 2);
    },
  },

  {
    name: 'find_component',
    description: 'Find components matching an intent query. Ranks by keyword score: exact phrase in title (3pts), word in intent (2pts), word in tags (1pt). Returns top 5.',
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'Natural-language description of what you want to do (e.g. "manage operator todos")' },
        project: { type: 'string', description: 'Optional project id to restrict search to' },
      },
      required: ['intent'],
    },
    run: async (args) => {
      const registry = _getRegistry();
      const matches = _findComponent(registry, args.intent, args.project || undefined);
      if (matches.length === 0) {
        return `No components matched "${args.intent}".`;
      }
      const lines = matches.map(
        (c, i) => `${i + 1}. [${c.project}] ${c.id}  (${c.surface})  — ${c.title}\n   intent: ${c.intent}\n   route: ${c.route}`
      );
      return `${matches.length} match(es) for "${args.intent}":\n\n${lines.join('\n\n')}`;
    },
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function listTools() { return TOOLS; }
function getTool(name) { return BY_NAME.get(name); }

module.exports = { listTools, getTool };
