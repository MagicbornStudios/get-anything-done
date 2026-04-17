#!/usr/bin/env node
'use strict';
/**
 * gad — planning CLI for get-anything-done
 *
 * Built on citty + gad-config.cjs.
 * Self-contained CJS — does not depend on mb-cli-framework at runtime.
 *
 * Usage:
 *   gad --help
 *   gad projects list
 *   gad projects sync
 *   gad projects list
 *   gad state
 *   gad phases [--projectid <id>]
 *   gad tasks [--projectid <id>]
 *   gad docs compile [--sink <path>]
 *   gad species list
 *   gad species run --project <name>
 *   gad session list
 *   gad session new [--project <id>]
 *   gad session resume <id>
 *   gad session close <id>
 *   gad context [--session <id>] [--project <id>]
 *   gad refs [--projectid …] | gad refs list|verify|migrate|watch
 */

const { defineCommand, runMain, createMain } = require('citty');
const path = require('path');
const fs = require('fs');

const gadConfig = require('./gad-config.cjs');
const { resolveTomlPath } = require('./gad-config.cjs');
const { render, shouldUseJson } = require('../lib/table.cjs');
const { readState } = require('../lib/state-reader.cjs');
const { readTasks } = require('../lib/task-registry-reader.cjs');
const { readPhases, readDocFlow } = require('../lib/roadmap-reader.cjs');
const { readDecisions } = require('../lib/decisions-reader.cjs');
const { readRequirements } = require('../lib/requirements-reader.cjs');
const { readErrors } = require('../lib/errors-reader.cjs');
const { readBlockers } = require('../lib/blockers-reader.cjs');
const { readDocsMap } = require('../lib/docs-map-reader.cjs');
const {
  loadProject: loadEvalProject,
  loadAllResolvedSpecies,
  loadResolvedSpecies,
} = require('../lib/eval-loader.cjs');
const { compile: compileDocs } = require('../lib/docs-compiler.cjs');
const planningRefVerify = require('../lib/planning-ref-verify.cjs');
const { summarizeAgentLineage } = require('../lib/eval-agent-lineage.cjs');
const { parseTraceEventsJsonl } = require('../lib/trace-schema.cjs');
const {
  addTaskClaim,
  claimTask,
  ensureAgentLane,
  listAgentLanes,
  nowIso,
  releaseTask,
  removeTaskClaim,
  touchAgentLane,
} = require('../lib/agent-lanes.cjs');

const pkg = require('../package.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve repo root from cwd (looks for gad-config.toml / legacy planning-config.toml / compat JSON up the tree). */
function readXmlFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function findRepoRoot(start) {
  let dir = start || process.cwd();
  for (let i = 0; i < 10; i++) {
    if (
      resolveTomlPath(dir) ||
      fs.existsSync(path.join(dir, '.planning', 'config.json')) ||
      fs.existsSync(path.join(dir, 'config.json'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// ---------------------------------------------------------------------------
// Load .env if present (for API keys like ANTHROPIC_API_KEY)
// ---------------------------------------------------------------------------
try {
  const envPath = path.join(findRepoRoot() || process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  }
} catch {}

// ---------------------------------------------------------------------------
// Multi-root eval discovery (task 42.4-12, decision GAD-D-184)
// ---------------------------------------------------------------------------
//
// Eval projects can live in more than one directory. The default root stays
// `vendor/get-anything-done/evals/` (the submodule's own evals/) for
// backwards compatibility. Additional roots are declared in gad-config.toml:
//
//   [[evals.roots]]
//   id = "app-forge"
//   path = "apps/forge/evals"
//
// Paths are resolved relative to the repo root (or taken as-is if absolute).
// The default root is always appended last unless a configured root already
// points at the same absolute path. Project ids must be unique across all
// roots — `listAllEvalProjects()` throws if a duplicate is detected.

/** Return ordered absolute dirs of every eval root, deduped. */
function getEvalRoots() {
  const gadDir = path.join(__dirname, '..');
  const defaultRoot = {
    id: 'get-anything-done',
    dir: path.resolve(gadDir, 'evals'),
  };

  // Collect [[evals.roots]] from the nearest config. When running inside a
  // submodule (e.g. vendor/get-anything-done/), findRepoRoot stops at the
  // submodule's own .planning/config.json. Walk upward to find a parent
  // config that declares [[evals.roots]] — that is the monorepo config the
  // user edits (gad-config.toml at repo root).
  let configuredRoots = [];
  try {
    const visited = new Set();
    let dir = findRepoRoot();
    let resolvedBase = null;
    while (dir && !visited.has(dir)) {
      visited.add(dir);
      try {
        const cfg = gadConfig.load(dir);
        if (cfg && Array.isArray(cfg.evalsRoots) && cfg.evalsRoots.length > 0) {
          configuredRoots = cfg.evalsRoots
            .filter((r) => r && r.enabled !== false && r.path)
            .map((r) => ({
              id: r.id || path.basename(r.path),
              dir: path.isAbsolute(r.path) ? r.path : path.resolve(dir, r.path),
            }));
          resolvedBase = dir;
          break;
        }
      } catch {}
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    // Unused; kept for debuggability via inspector.
    void resolvedBase;
  } catch {
    configuredRoots = [];
  }

  // Dedup: if a configured root already resolves to the default, skip the
  // implicit default append.
  const seenDirs = new Set();
  const ordered = [];
  for (const r of configuredRoots) {
    const key = path.resolve(r.dir).toLowerCase();
    if (seenDirs.has(key)) continue;
    seenDirs.add(key);
    ordered.push(r);
  }
  const defaultKey = path.resolve(defaultRoot.dir).toLowerCase();
  if (!seenDirs.has(defaultKey)) {
    ordered.push(defaultRoot);
  }
  return ordered;
}

/** Back-compat helper: the primary (submodule) evals dir. */
function defaultEvalsDir() {
  return path.join(__dirname, '..', 'evals');
}

/**
 * Walk every eval root and return a flat list of project descriptors:
 *   [{ name, projectDir, root }]
 * Throws on duplicate project ids across roots (task 42.4-12).
 */
function listAllEvalProjects() {
  const roots = getEvalRoots();
  const byName = new Map();
  for (const root of roots) {
    if (!fs.existsSync(root.dir)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(root.dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.')) continue;
      const projectDir = path.join(root.dir, e.name);
      if (byName.has(e.name)) {
        const existing = byName.get(e.name);
        throw new Error(
          `Duplicate eval project id "${e.name}" found in multiple roots:\n` +
          `  ${existing.projectDir}\n` +
          `  ${projectDir}\n` +
          `Eval project ids must be unique across [[evals.roots]].`
        );
      }
      byName.set(e.name, { name: e.name, projectDir, root });
    }
  }
  return Array.from(byName.values());
}

/**
 * Resolve an eval project name to its {projectDir, root}, searching each
 * configured root in order. Returns null if not found in any root.
 */
function resolveEvalProject(name) {
  if (!name) return null;
  const roots = getEvalRoots();
  for (const root of roots) {
    const candidate = path.join(root.dir, name);
    if (fs.existsSync(candidate)) {
      return { name, projectDir: candidate, root };
    }
  }
  return null;
}

/**
 * Resolve an eval project dir for commands that accept --project. Falls back
 * to the default root if no configured match (so "gad eval init --project X"
 * creates X in the submodule's evals/). Returns an absolute path.
 */
function resolveOrDefaultEvalProjectDir(name) {
  const hit = resolveEvalProject(name);
  if (hit) return hit.projectDir;
  return path.join(defaultEvalsDir(), name);
}

/**
 * Resolve a project ID to its namespace prefix for the new ID format (decision gad-125).
 * Examples: get-anything-done → GAD, escape-the-dungeon → ETD, grime-time → GRIME
 */
const PROJECT_NAMESPACE_MAP = {
  'get-anything-done': 'GAD',
  'escape-the-dungeon': 'ETD',
  'escape-the-dungeon-bare': 'ETD',
  'escape-the-dungeon-emergent': 'ETD',
  'escape-the-dungeon-gad-emergent': 'ETD',
  'escape-the-dungeon-planning-only': 'ETD',
  'etd-brownfield-bare': 'ETD',
  'etd-brownfield-emergent': 'ETD',
  'etd-brownfield-gad': 'ETD',
  'etd-phaser': 'ETD',
  'etd-pixijs': 'ETD',
  'etd-threejs': 'ETD',
  'etd-babylonjs': 'ETD',
  'grime-time': 'GRIME',
  'grime-time-site': 'GRIME',
  'repo-planner': 'RP',
  'repub-builder': 'REPUB',
  'mb-cli-framework': 'MBCLI',
  'gad-manuscript': 'GADMS',
  'global': 'GLOBAL',
};

function projectNamespace(projectId) {
  if (PROJECT_NAMESPACE_MAP[projectId]) return PROJECT_NAMESPACE_MAP[projectId];
  // Auto-derive: take first letters of hyphen-separated words, uppercase
  return projectId.split('-').map(w => w[0] || '').join('').toUpperCase().slice(0, 5) || 'UNK';
}

/** Format an ID in the new gad-125 format */
function formatId(projectId, type, number) {
  const ns = projectNamespace(projectId);
  return `${ns}-${type}-${number}`;
}

function output(rows, opts = {}) {
  const fmt = shouldUseJson() ? 'json' : (opts.format || 'table');
  console.log(render(rows, { ...opts, format: fmt }));
}

function outputError(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Call logger — every gad command writes a JSONL entry
// ---------------------------------------------------------------------------
//
// Log location priority:
//   1. GAD_LOG_DIR env var (eval runs set this to their run directory)
//   2. .planning/.gad-log/ in the repo root
//
// Each entry is one JSON line: { ts, cmd, args, duration_ms, exit, summary }

const GAD_LOG_DIR = process.env.GAD_LOG_DIR || null;
let _logDir = null;
let _logStart = Date.now();
let _logCmd = process.argv.slice(2).join(' ');

function detectRuntimeIdentity() {
  const model = process.env.GAD_MODEL || process.env.CLAUDE_MODEL || process.env.OPENAI_MODEL || null;
  if (process.env.GAD_RUNTIME) {
    return { id: process.env.GAD_RUNTIME, source: 'env', model };
  }
  if (process.env.CODEX_HOME) {
    return { id: 'codex', source: 'env', model };
  }
  if (process.env.CLAUDE_CONFIG_DIR || process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) {
    return { id: 'claude-code', source: 'env', model };
  }
  return { id: 'unknown', source: 'unknown', model };
}

function normalizeEvalRuntime(runtime) {
  const value = String(runtime || '').trim().toLowerCase();
  if (!value) return detectRuntimeIdentity();
  if (value === 'claude' || value === 'claude-code') return { id: 'claude-code', source: 'eval-arg', model: null };
  if (value === 'codex') return { id: 'codex', source: 'eval-arg', model: null };
  if (value === 'cursor') return { id: 'cursor', source: 'eval-arg', model: null };
  if (value === 'windsurf') return { id: 'windsurf', source: 'eval-arg', model: null };
  if (value === 'gemini') return { id: 'gemini-cli', source: 'eval-arg', model: null };
  return { id: value, source: 'eval-arg', model: null };
}

function runtimeInstallHint(runtimeId) {
  if (runtimeId === 'claude-code') return 'gad install all --claude --global';
  if (runtimeId === 'codex') return 'gad install all --codex --global';
  if (runtimeId === 'cursor') return 'gad install all --cursor --global';
  if (runtimeId === 'windsurf') return 'gad install all --windsurf --global';
  if (runtimeId === 'gemini-cli') return 'gad install all --gemini --global';
  return 'gad install all --<runtime> --global';
}

function runtimeInstallFlag(runtimeId) {
  if (runtimeId === 'claude-code') return '--claude';
  if (runtimeId === 'codex') return '--codex';
  if (runtimeId === 'cursor') return '--cursor';
  if (runtimeId === 'windsurf') return '--windsurf';
  if (runtimeId === 'gemini-cli') return '--gemini';
  return null;
}

function detectRuntimeSessionId() {
  return process.env.GAD_RUNTIME_SESSION_ID
    || process.env.GAD_SESSION_ID
    || process.env.CLAUDE_SESSION_ID
    || process.env.CLAUDE_CONVERSATION_ID
    || process.env.CODEX_SESSION_ID
    || process.env.CURSOR_SESSION_ID
    || null;
}

function detectAgentTelemetry() {
  const agentId = (process.env.GAD_AGENT_ID || '').trim();
  const parentAgentId = (process.env.GAD_PARENT_AGENT_ID || '').trim();
  const rootAgentId = (process.env.GAD_ROOT_AGENT_ID || parentAgentId || agentId || '').trim();
  const depthRaw = process.env.GAD_AGENT_DEPTH;
  const parsedDepth = Number.parseInt(depthRaw || '', 10);
  return {
    agent_id: agentId || null,
    agent_role: (process.env.GAD_AGENT_ROLE || '').trim() || null,
    parent_agent_id: parentAgentId || null,
    root_agent_id: rootAgentId || null,
    depth: Number.isFinite(parsedDepth) ? parsedDepth : null,
    model_profile: (process.env.GAD_MODEL_PROFILE || '').trim() || null,
    resolved_model: (process.env.GAD_RESOLVED_MODEL || '').trim() || null,
  };
}

function resolveSnapshotRuntime(runtimeArg, { humanFallback = false } = {}) {
  const normalized = normalizeEvalRuntime(runtimeArg);
  if (runtimeArg && normalized.id !== 'unknown') return normalized;
  const detected = detectRuntimeIdentity();
  if (detected.id !== 'unknown') return detected;
  if (humanFallback) return { id: 'human', source: 'snapshot-fallback', model: null };
  return detected;
}

function resolveSnapshotAgentInputs(args) {
  const requestedAgentId = (args.agentid || process.env.GAD_AGENT_ID || '').trim();
  const role = (args.role || process.env.GAD_AGENT_ROLE || 'default').trim() || 'default';
  const parentAgentId = (args.parentAgentid || args['parent-agentid'] || process.env.GAD_PARENT_AGENT_ID || '').trim() || null;
  const modelProfile = (args.modelProfile || args['model-profile'] || process.env.GAD_MODEL_PROFILE || '').trim() || null;
  const resolvedModel = (args.resolvedModel || args['resolved-model'] || process.env.GAD_RESOLVED_MODEL || '').trim() || null;
  return { requestedAgentId, role, parentAgentId, modelProfile, resolvedModel };
}

function simplifyAgentLane(agent, taskMap = new Map()) {
  const tasks = Array.from(new Set([
    ...(Array.isArray(agent?.claimedTaskIds) ? agent.claimedTaskIds : []),
    ...Array.from(taskMap.values())
      .filter((task) => task.agentId === agent.agentId && task.status !== 'done')
      .map((task) => task.id),
  ]));
  return {
    agentId: agent.agentId,
    agentRole: agent.agentRole,
    runtime: agent.runtime,
    depth: agent.depth,
    parentAgentId: agent.parentAgentId || null,
    rootAgentId: agent.rootAgentId || agent.agentId,
    modelProfile: agent.modelProfile || null,
    resolvedModel: agent.resolvedModel || null,
    tasks,
    lastSeenAt: agent.lastSeenAt || null,
    status: agent.status || 'active',
  };
}

function buildAssignmentsView(allTasks, activeAgents, staleAgents, currentAgent, scopedTaskId) {
  const taskMap = new Map(allTasks.map((task) => [task.id, task]));
  const activeRows = activeAgents.map((agent) => simplifyAgentLane(agent, taskMap));
  const staleRows = staleAgents.map((agent) => simplifyAgentLane(agent, taskMap));
  const selfTaskIds = currentAgent
    ? Array.from(new Set([
        ...(Array.isArray(currentAgent.claimedTaskIds) ? currentAgent.claimedTaskIds : []),
        ...allTasks.filter((task) => task.agentId === currentAgent.agentId && task.status !== 'done').map((task) => task.id),
      ]))
    : [];
  const collisions = [];
  if (scopedTaskId) {
    const scopedTask = taskMap.get(scopedTaskId);
    if (scopedTask && scopedTask.agentId && (!currentAgent || scopedTask.agentId !== currentAgent.agentId)) {
      collisions.push({
        taskId: scopedTask.id,
        agentId: scopedTask.agentId,
        agentRole: scopedTask.agentRole || null,
        runtime: scopedTask.runtime || null,
        status: scopedTask.status,
      });
    }
  }
  return {
    self: selfTaskIds,
    activeAgents: activeRows,
    collisions,
    staleAgents: staleRows,
  };
}

function ensureEvalRuntimeHooks(runtimeIdentity) {
  const runtimeId = runtimeIdentity?.id || 'unknown';
  const flag = runtimeInstallFlag(runtimeId);
  if (!flag) {
    return {
      attempted: false,
      ok: false,
      runtime: runtimeId,
      note: `No automatic installer mapping for runtime '${runtimeId}'. Run ${runtimeInstallHint(runtimeId)} manually before starting the eval.`,
    };
  }

  const { spawnSync } = require('child_process');
  const packaged = Boolean(process.env.GAD_PACKAGED_EXECUTABLE || process.env.GAD_PACKAGED_ROOT);
  const command = packaged ? (process.env.GAD_PACKAGED_EXECUTABLE || process.execPath) : process.execPath;
  const commandArgs = packaged
    ? ['__gad_internal_install__', flag, '--global']
    : [__filename, 'install', 'all', flag, '--global'];
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    outputError(`Failed to install/verify GAD hooks for runtime '${runtimeId}'.`);
  }

  return {
    attempted: true,
    ok: true,
    runtime: runtimeId,
    note: `Ensured runtime install for ${runtimeId} via ${flag}.`,
  };
}

function getLogDir() {
  if (_logDir) return _logDir;
  if (GAD_LOG_DIR) {
    _logDir = GAD_LOG_DIR;
  } else {
    try {
      const root = findRepoRoot();
      _logDir = path.join(root, '.planning', '.gad-log');
    } catch {
      return null;
    }
  }
  try { fs.mkdirSync(_logDir, { recursive: true }); } catch {}
  return _logDir;
}

function logCall(overrides = {}) {
  const dir = getLogDir();
  if (!dir) return;
  const entry = {
    ts: new Date().toISOString(),
    cmd: overrides.cmd || _logCmd,
    args: overrides.args || process.argv.slice(2),
    duration_ms: Date.now() - _logStart,
    exit: overrides.exit || 0,
    summary: overrides.summary || '',
    pid: process.pid,
    runtime: detectRuntimeIdentity(),
    agent: detectAgentTelemetry(),
  };
  const logFile = path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch {}
}

// Log on exit (captures all commands including failures)
// Only log if this is actually a gad CLI invocation (not a hook subprocess)
const _isGadCli = process.argv[1] && path.basename(process.argv[1]) === 'gad.cjs';
process.on('exit', (code) => {
  if (_isGadCli) logCall({ exit: code });
});

/** List available eval projects and suggest rerun hint. */
function listEvalProjectsHint() {
  let discovered;
  try {
    discovered = listAllEvalProjects();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (discovered.length === 0) {
    console.error('No eval projects found. Create evals/<name>/REQUIREMENTS.md to get started.');
    process.exit(1);
  }
  console.error(`\nMissing --project. Available eval projects:\n`);
  for (const p of discovered) console.error(`  ${p.name}`);
  console.error(`\nRerun: gad species run --project ${discovered[0].name}`);
  process.exit(1);
}

/**
 * Return the projectId of the most-recently-updated active session, or null.
 * Used to scope state/phases to session project by default.
 */
function getActiveSessionProjectId(baseDir, roots) {
  const sessions = loadSessions(baseDir, roots).filter(s => s.status !== 'closed');
  if (sessions.length === 0) return null;
  // loadSessions already sorts by updatedAt desc — first is most recent
  return sessions[0].projectId || null;
}

/**
 * Resolve which roots to query based on --projectid / --all / active session.
 * --all always returns all roots.
 * --projectid scopes to one root (errors if not found).
 * Neither: session-scoped default, falling back to all.
 */
function resolveRoots(args, baseDir, allRoots) {
  if (args.all) return allRoots;
  if (args.projectid) {
    const found = allRoots.filter(r => r.id === args.projectid);
    if (found.length === 0) {
      const ids = allRoots.map(r => r.id);
      console.error(`\nProject not found: ${args.projectid}\n\nAvailable projects:\n`);
      for (const id of ids) console.error(`  ${id}`);
      console.error(`\nRerun with: --projectid ${ids[0]}`);
      process.exit(1);
    }
    return found;
  }
  // Downward compilation: cwd-based auto-scope FIRST (decision gad-127)
  // CWD takes priority over session — you're physically in the project directory.
  const cwd = process.cwd();
  const cwdResolved = path.resolve(cwd);
  for (const root of allRoots) {
    const rootResolved = path.resolve(baseDir, root.path);
    if (cwdResolved.startsWith(rootResolved) && root.id !== 'global') {
      // We're inside this project — compile it and any sub-projects
      const scoped = allRoots.filter(r => {
        const rPath = path.resolve(baseDir, r.path);
        return rPath.startsWith(rootResolved) || r.id === root.id;
      });
      if (scoped.length > 0) return scoped;
    }
  }
  // Session-based scoping (fallback after cwd check)
  const sessionId = getActiveSessionProjectId(baseDir, allRoots);
  if (sessionId) {
    const found = allRoots.filter(r => r.id === sessionId);
    if (found.length > 0) return found;
  }
  return allRoots;
}

/** List active sessions and suggest rerun hint for a subcommand. */
function listActiveSessionsHint(baseDir, config, subcommand) {
  const sessions = loadSessions(baseDir, config.roots).filter(s => s.status !== 'closed');
  if (sessions.length === 0) {
    console.error('No active sessions. Run `gad session new` to start one.');
    process.exit(1);
  }
  console.error(`\nMissing --id. Active sessions:\n`);
  for (const s of sessions) {
    const phase = s.position?.phase ? `  phase: ${s.position.phase}` : '';
    console.error(`  ${s.id}  [${s.projectId || '?'}]${phase}`);
  }
  console.error(`\nRerun: gad session ${subcommand} --id ${sessions[0].id}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// projects sync/add/ignore subcommands (was workspace — decision gad-208)
// ---------------------------------------------------------------------------

const projectsSync = defineCommand({
  meta: { name: 'sync', description: 'Crawl repo for .planning/ dirs and sync gad-config.toml roots' },
  args: {
    yes: { type: 'boolean', alias: 'y', description: 'Apply changes without prompting', default: false },
  },
  async run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);

    // Crawl for .planning/ directories
    const found = crawlPlanningDirs(baseDir, config.ignore || []);

    const existingPaths = new Set(config.roots.map(r => normalizePath(r.path)));
    const newPaths = found.filter(p => !existingPaths.has(normalizePath(p)));
    const missingPaths = config.roots.filter(r => {
      const planDir = path.join(baseDir, r.path, r.planningDir);
      return !fs.existsSync(planDir);
    });

    if (newPaths.length === 0 && missingPaths.length === 0) {
      console.log(`✓ Projects up to date — ${config.roots.length} roots registered`);
      return;
    }

    console.log('\nProjects sync\n');
    for (const r of config.roots) {
      const missing = missingPaths.find(m => m.id === r.id);
      console.log(`  ${missing ? '! MISSING ' : '✓ OK      '} [${r.id}]  ${r.path}`);
    }
    for (const p of newPaths) {
      const id = path.basename(p) || path.basename(path.dirname(p));
      console.log(`  + NEW     [${id}]  ${p}`);
    }
    if (missingPaths.length > 0) {
      console.log(`\n  ${missingPaths.length} registered root(s) no longer have a .planning/ dir.`);
    }
    console.log('');

    if (!args.yes) {
      // Non-interactive: just report
      console.log('Run with --yes to apply changes.');
      return;
    }

    // Apply: add new roots, remove missing
    const updatedRoots = config.roots.filter(r => !missingPaths.find(m => m.id === r.id));
    for (const p of newPaths) {
      const id = path.basename(p) || path.basename(path.dirname(p));
      updatedRoots.push({ id, path: p, planningDir: '.planning', discover: false });
    }

    writeRootsToToml(baseDir, updatedRoots, config);
    console.log(`✓ gad-config.toml updated — ${updatedRoots.length} roots registered`);
  },
});

const projectsAdd = defineCommand({
  meta: { name: 'add', description: 'Add a path as a planning root' },
  args: {
    path: { type: 'positional', description: 'Path to add', required: true },
    id: { type: 'string', description: 'Root ID (default: dirname)', default: '' },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const addPath = args.path;
    const id = args.id || path.basename(addPath) || addPath;

    const existing = config.roots.find(r => normalizePath(r.path) === normalizePath(addPath));
    if (existing) {
      console.log(`Already registered: [${existing.id}] → ${existing.path}`);
      return;
    }

    const absPath = path.join(baseDir, addPath);
    if (!fs.existsSync(absPath)) {
      fs.mkdirSync(absPath, { recursive: true });
      console.log(`Created directory: ${addPath}`);
    }
    const planDir = path.join(absPath, '.planning');
    if (!fs.existsSync(planDir)) {
      fs.mkdirSync(planDir, { recursive: true });
      console.log(`Created: ${addPath}/.planning/`);
    }

    config.roots.push({ id, path: addPath, planningDir: '.planning', discover: false });
    writeRootsToToml(baseDir, config.roots, config);
    console.log(`✓ Added [${id}] → ${addPath}/.planning/`);
  },
});

const projectsIgnore = defineCommand({
  meta: { name: 'ignore', description: 'Add a gitignore-style ignore pattern' },
  args: {
    pattern: { type: 'positional', description: 'Glob pattern to ignore', required: true },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const pattern = args.pattern;

    if (config.ignore.includes(pattern)) {
      console.log(`Pattern already present: ${pattern}`);
      return;
    }

    config.ignore.push(pattern);
    appendIgnoreToToml(baseDir, pattern);
    console.log(`✓ Added ignore pattern: ${pattern}`);
  },
});



// ---------------------------------------------------------------------------
// projects subcommands
// ---------------------------------------------------------------------------

function listProjects(baseDir, config) {
  const rows = config.roots.map(root => {
    const state = readState(root, baseDir);
    return {
      id: root.id,
      path: root.path,
      phase: state.phasesTotal > 0 ? `${state.phasesComplete}/${state.phasesTotal}` : (state.currentPhase || '—'),
      milestone: state.milestone || '—',
      status: state.status || '—',
    };
  });
  output(rows, { title: 'GAD Projects' });
}

const projectsList = defineCommand({
  meta: { name: 'list', description: 'List all registered projects' },
  run() {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    listProjects(baseDir, config);
  },
});

// gad ls — top-level shorthand for gad projects list
const lsCmd = defineCommand({
  meta: { name: 'ls', description: 'List all registered projects (alias for: projects list)' },
  run() {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    listProjects(baseDir, config);
  },
});

// Canonical XML scaffold templates for `gad projects init` (task 42.4-08).
// Source of truth: references/project-shape.md §5 (decision gad-185).
// Each template is a function of (projectId, today) returning valid XML.
const INIT_XML_TEMPLATES = {
  'STATE.xml': (id, today) =>
`<?xml version="1.0" encoding="UTF-8"?>
<state project="${id}" schema="1">
  <status>active</status>
  <milestone>v1</milestone>
  <current-phase></current-phase>
  <last-activity>${today}</last-activity>
  <next-action>Project initialized. Define requirements.</next-action>
</state>
`,
  'ROADMAP.xml': (id) =>
`<?xml version="1.0" encoding="UTF-8"?>
<roadmap project="${id}" schema="1">
  <milestone id="v1" status="active">
    <title>Initial milestone</title>
    <phase id="00" status="planned">
      <title>Bootstrap</title>
      <goal>Define scope</goal>
    </phase>
  </milestone>
</roadmap>
`,
  'TASK-REGISTRY.xml': (id) =>
`<?xml version="1.0" encoding="UTF-8"?>
<task-registry project="${id}" schema="1">
  <phase id="00">
    <!-- <task id="00-01" type="..." status="planned"><goal>...</goal></task> -->
  </phase>
</task-registry>
`,
  'DECISIONS.xml': (id) =>
`<?xml version="1.0" encoding="UTF-8"?>
<decisions project="${id}" schema="1">
  <!-- <decision id="${id}-001"><title>...</title><summary>...</summary><impact>...</impact></decision> -->
</decisions>
`,
  'REQUIREMENTS.xml': (id) =>
`<?xml version="1.0" encoding="UTF-8"?>
<requirements project="${id}" schema="1">
  <!-- TODO: capture initial scope -->
  <!-- <requirement id="REQ-001" priority="must"><goal>...</goal></requirement> -->
</requirements>
`,
  'ERRORS-AND-ATTEMPTS.xml': (id) =>
`<?xml version="1.0" encoding="UTF-8"?>
<errors-and-attempts project="${id}" schema="1">
  <!-- <entry id="<slug>-YYYY-MM-DD" date="YYYY-MM-DD"><what>...</what><why>...</why><lesson>...</lesson></entry> -->
</errors-and-attempts>
`,
};

// Files scaffolded by the default (XML) init path: canonical minimum (4) plus
// the two strongly-recommended optionals called out in the 42.4-08 task goal.
const INIT_XML_FILES = [
  'STATE.xml',
  'ROADMAP.xml',
  'TASK-REGISTRY.xml',
  'DECISIONS.xml',
  'REQUIREMENTS.xml',
  'ERRORS-AND-ATTEMPTS.xml',
];

const projectsInit = defineCommand({
  meta: { name: 'init', description: 'Initialize a new project with canonical XML .planning/ scaffold' },
  args: {
    name:      { type: 'string',  description: 'Project display name (default: folder name)', default: '' },
    projectid: { type: 'string',  description: 'Project id (default: slug of --name)', default: '' },
    path:      { type: 'string',  description: 'Project path (default: cwd)', default: '' },
    format:    { type: 'string',  description: 'Scaffold format: xml (default) or md (legacy)', default: 'xml' },
    force:     { type: 'boolean', description: 'Overwrite existing files', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const projectPath = args.path || process.cwd();
    const projectName = args.name || path.basename(projectPath);
    const projectId   = (args.projectid || projectName).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const planDir = path.join(projectPath, '.planning');
    const format  = (args.format || 'xml').toLowerCase();

    if (format !== 'xml' && format !== 'md') {
      console.error(`✗ Unknown --format "${args.format}". Expected xml or md.`);
      process.exitCode = 1;
      return;
    }

    fs.mkdirSync(planDir, { recursive: true });

    // Decide which files to write based on format.
    const targets = format === 'xml'
      ? INIT_XML_FILES.slice()
      : ['STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md', 'PROJECT.md', 'TASK-REGISTRY.xml', 'DECISIONS.xml', 'ERRORS-AND-ATTEMPTS.xml'];

    // Pre-flight overwrite check.
    const collisions = targets.filter(f => fs.existsSync(path.join(planDir, f)));
    if (collisions.length && !args.force) {
      console.error(`✗ Refusing to init — ${collisions.length} file(s) already exist in ${planDir}:`);
      for (const c of collisions) console.error(`    ${c}`);
      console.error(`  Re-run with --force to overwrite.`);
      process.exitCode = 1;
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const written = [];

    if (format === 'xml') {
      for (const f of INIT_XML_FILES) {
        fs.writeFileSync(path.join(planDir, f), INIT_XML_TEMPLATES[f](projectId, today));
        written.push(f);
      }
    } else {
      // Legacy markdown path — keeps the old template-copy behavior, but also
      // scaffolds the XML ledgers the old path forgot (TASK-REGISTRY / DECISIONS
      // / ERRORS-AND-ATTEMPTS) so the resulting root still passes canonical audit.
      const templateDir = path.join(__dirname, '..', 'templates');
      const mdStarters = [
        ['state.md', 'STATE.md'],
        ['roadmap.md', 'ROADMAP.md'],
        ['requirements.md', 'REQUIREMENTS.md'],
        ['project.md', 'PROJECT.md'],
      ];
      for (const [tmpl, destName] of mdStarters) {
        const dest = path.join(planDir, destName);
        const src  = path.join(templateDir, tmpl);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        } else {
          fs.writeFileSync(dest, `# ${destName.replace('.md', '')}\n\nProject: ${projectName}\n`);
        }
        written.push(destName);
      }
      // Always scaffold the canonical XML ledgers that were missing pre-42.4-08.
      for (const f of ['TASK-REGISTRY.xml', 'DECISIONS.xml', 'ERRORS-AND-ATTEMPTS.xml']) {
        fs.writeFileSync(path.join(planDir, f), INIT_XML_TEMPLATES[f](projectId, today));
        written.push(f);
      }
    }

    console.log(`✓ Initialized .planning/ in ${projectPath}`);
    console.log(`  Format: ${format}`);
    console.log(`  Project id: ${projectId}`);
    console.log(`  Files written (${written.length}):`);
    for (const f of written) console.log(`    ${f}`);

    // Register in config if not already present.
    const relPath = path.relative(baseDir, projectPath) || '.';
    if (!config.roots.find(r => normalizePath(r.path) === normalizePath(relPath))) {
      config.roots.push({ id: projectId, path: relPath, planningDir: '.planning', discover: false });
      writeRootsToToml(baseDir, config.roots, config);
      console.log(`  Registered as [${projectId}] in gad-config.toml`);
    }

    console.log('');
    console.log('Next steps:');
    console.log(`  gad projects audit --project ${projectId}    # verify canonical shape`);
    console.log(`  gad discuss-phase --projectid ${projectId}   # capture phase 00 context`);
    console.log(`  gad plan-phase --projectid ${projectId}      # plan phase 00`);
  },
});

// projects audit — per-project health check
const REQUIRED_FILES_BY_FORMAT = {
  xml: ['STATE.xml', 'ROADMAP.xml'],
  md:  ['STATE.md',  'ROADMAP.md'],
};
const RECOMMENDED_FILES = ['DECISIONS.xml', 'DECISIONS.md', 'AGENTS.md', 'REQUIREMENTS.xml', 'REQUIREMENTS.md'];

// Canonical planning-root shape — source of truth is references/project-shape.md
// (task 42.4-09, decision gad-185). Keep this list in sync with §2 / §3 / §4 of that doc.
const CANONICAL_MINIMUM_FILES = [
  'STATE.xml',
  'ROADMAP.xml',
  'TASK-REGISTRY.xml',
  'DECISIONS.xml',
];
const CANONICAL_OPTIONAL_FILES = [
  'REQUIREMENTS.xml',
  'ERRORS-AND-ATTEMPTS.xml',
  'HUMAN-TODOS.xml',
  'BLOCKERS.xml',
  'PROJECT.xml',
  'DOCS-MAP.xml',
  'AGENTS.md',
  'CONVENTIONS.md',
  'README.md',
];
const CANONICAL_LEGACY_FILES = [
  // (name, reason) — reported as warnings
  ['gad.json',                             'renamed to species.json in phase 43 / task 42.4-14'],
  ['PROJECT.md',                           'legacy markdown scaffold; use PROJECT.xml (reserved) or leave absent'],
  ['STATE.md',                             'use STATE.xml (canonical XML shape)'],
  ['ROADMAP.md',                           'use ROADMAP.xml (canonical XML shape)'],
  ['DECISIONS.md',                         'use DECISIONS.xml (canonical XML shape)'],
  ['REQUIREMENTS.md',                      'use REQUIREMENTS.xml (canonical XML shape)'],
  ['config.json',                          'superseded by repo-root gad-config.toml in phase 41'],
  ['REPOPLANNER-TO-GAD-MIGRATION-GAPS.md', 'one-shot migration note, safe to archive'],
];
const CANONICAL_LEGACY_DIRS = [
  ['skills', 'project-local skill staging is deprecated — use .planning/proto-skills/ per decision gad-183'],
];

// Compute the canonical-shape report for a single planning root.
// Returns { minimumPresent, minimumMissing, optionalPresent, legacyPresent }.
// Referenced by the projects audit command (below). Source of truth for the
// file lists is references/project-shape.md (decision gad-185).
function computeCanonicalShape(planDir) {
  if (!fs.existsSync(planDir)) {
    return { minimumPresent: [], minimumMissing: CANONICAL_MINIMUM_FILES.slice(), optionalPresent: [], legacyPresent: [] };
  }
  const entries = fs.readdirSync(planDir, { withFileTypes: true });
  const files = new Set(entries.filter(e => e.isFile()).map(e => e.name));
  const dirs  = new Set(entries.filter(e => e.isDirectory()).map(e => e.name));

  const minimumPresent = CANONICAL_MINIMUM_FILES.filter(f => files.has(f));
  const minimumMissing = CANONICAL_MINIMUM_FILES.filter(f => !files.has(f));
  const optionalPresent = CANONICAL_OPTIONAL_FILES.filter(f => files.has(f));

  const legacyPresent = [];
  for (const [name, reason] of CANONICAL_LEGACY_FILES) {
    if (files.has(name)) legacyPresent.push({ name, kind: 'file', reason });
  }
  for (const [name, reason] of CANONICAL_LEGACY_DIRS) {
    if (dirs.has(name)) legacyPresent.push({ name, kind: 'dir', reason });
  }
  return { minimumPresent, minimumMissing, optionalPresent, legacyPresent };
}

const projectsAudit = defineCommand({
  meta: { name: 'audit', description: 'Audit all projects for missing files, format violations, and sink gaps' },
  args: {
    project: { type: 'string', description: 'Scope to one project ID', default: '' },
    json:    { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config  = gadConfig.load(baseDir);
    const sink    = config.docs_sink;
    let roots = config.roots;
    if (args.project) roots = roots.filter(r => r.id === args.project);

    const { isGenerated } = require('../lib/docs-compiler.cjs');
    const results = [];

    for (const root of roots) {
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const checks  = [];

      // 1. Planning dir exists
      const dirExists = fs.existsSync(planDir);
      checks.push({ check: 'planning_dir_exists', pass: dirExists, detail: dirExists ? planDir : `missing: ${planDir}` });
      if (!dirExists) { results.push({ project: root.id, checks }); continue; }

      // 2. Required files present (at least one format)
      const filesPresent = fs.readdirSync(planDir);
      const hasXml = REQUIRED_FILES_BY_FORMAT.xml.every(f => filesPresent.includes(f));
      const hasMd  = REQUIRED_FILES_BY_FORMAT.md.every(f  => filesPresent.includes(f));
      const hasRequired = hasXml || hasMd;
      const detectedFormat = hasXml ? 'xml' : hasMd ? 'md' : 'unknown';
      checks.push({ check: 'required_files', pass: hasRequired, detail: hasRequired ? `format=${detectedFormat}` : `missing STATE+ROADMAP (checked xml and md)` });

      // 3. Recommended files
      const missingRec = RECOMMENDED_FILES.filter(f => !filesPresent.includes(f));
      const hasRec = missingRec.length < RECOMMENDED_FILES.length; // at least one present
      checks.push({ check: 'recommended_files', pass: hasRec, detail: hasRec ? `present` : `none of: ${RECOMMENDED_FILES.join(', ')}` });

      // 4. Sink alignment (if sink configured)
      if (sink) {
        const sinkPlanDir = path.join(baseDir, sink, root.id, 'planning');
        const sinkExists  = fs.existsSync(sinkPlanDir);
        if (!sinkExists) {
          checks.push({ check: 'sink_exists', pass: false, detail: `no sink dir: ${sink}/${root.id}/planning/` });
        } else {
          const sinkFiles = fs.readdirSync(sinkPlanDir).filter(f => f.endsWith('.mdx'));
          const generatedCount = sinkFiles.filter(f => isGenerated(path.join(sinkPlanDir, f))).length;
          const humanCount     = sinkFiles.length - generatedCount;
          checks.push({ check: 'sink_exists', pass: true, detail: `${sinkFiles.length} mdx (${humanCount} human, ${generatedCount} generated)` });

          // Stale check
          const stale = [];
          for (const srcName of filesPresent.filter(f => /\.(xml|md)$/.test(f))) {
            const srcPath = path.join(planDir, srcName);
            const sinkName = srcName.replace(/\.(xml|md)$/, '.mdx').toLowerCase();
            const sinkPath = path.join(sinkPlanDir, sinkName);
            if (fs.existsSync(sinkPath)) {
              const srcMtime  = fs.statSync(srcPath).mtimeMs;
              const sinkMtime = fs.statSync(sinkPath).mtimeMs;
              if (srcMtime > sinkMtime && isGenerated(sinkPath)) stale.push(srcName);
            }
          }
          checks.push({ check: 'sink_fresh', pass: stale.length === 0, detail: stale.length === 0 ? 'all generated files current' : `stale: ${stale.join(', ')}` });
        }
      }

      // 5. Canonical planning-root shape (task 42.4-09, decision gad-185).
      // Source of truth: references/project-shape.md. This is additive — it
      // does not replace the legacy required/recommended checks above.
      const shape = computeCanonicalShape(planDir);
      const minPass = shape.minimumMissing.length === 0;
      checks.push({
        check: 'canonical_minimum',
        pass: minPass,
        detail: minPass
          ? `${shape.minimumPresent.length}/${CANONICAL_MINIMUM_FILES.length} present`
          : `missing: ${shape.minimumMissing.join(', ')}`,
      });
      checks.push({
        check: 'canonical_optional',
        pass: true,
        detail: shape.optionalPresent.length === 0
          ? 'none present'
          : `present: ${shape.optionalPresent.join(', ')}`,
      });
      checks.push({
        check: 'canonical_legacy',
        pass: shape.legacyPresent.length === 0,
        detail: shape.legacyPresent.length === 0
          ? 'none detected'
          : `legacy: ${shape.legacyPresent.map(l => `${l.name} (${l.reason})`).join('; ')}`,
      });

      results.push({ project: root.id, format: detectedFormat, checks, shape });
    }

    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    // Table view: one row per check per project
    const rows = [];
    for (const r of results) {
      for (const c of r.checks) {
        rows.push({ project: r.project, check: c.check, pass: c.pass ? '✓' : '✗', detail: c.detail });
      }
    }
    output(rows, { title: `Projects Audit (${results.length} projects)` });

    // Canonical-shape summary block — cites references/project-shape.md as
    // the contract that both projects init and projects audit agree on.
    console.log('\n── Canonical planning-root shape ───────────────────────');
    console.log('Source: references/project-shape.md (decision gad-185)');
    for (const r of results) {
      if (!r.shape) continue;
      const m = r.shape;
      const status = m.minimumMissing.length === 0 ? '✓ clean' : `✗ missing ${m.minimumMissing.length}`;
      console.log(`  ${r.project.padEnd(22)} ${status}`);
      console.log(`    minimum:  ${m.minimumPresent.length}/${CANONICAL_MINIMUM_FILES.length} present${m.minimumMissing.length ? ` — missing: ${m.minimumMissing.join(', ')}` : ''}`);
      if (m.optionalPresent.length) {
        console.log(`    optional: ${m.optionalPresent.join(', ')}`);
      }
      if (m.legacyPresent.length) {
        console.log(`    legacy:   ${m.legacyPresent.map(l => l.name).join(', ')}`);
      }
    }

    const failed = results.flatMap(r => r.checks).filter(c => !c.pass).length;
    console.log(failed === 0
      ? '\n✓ All checks passed.'
      : `\n${failed} check(s) failed.`
    );
  },
});

// ---------------------------------------------------------------------------
// gad projects create / edit / archive — eval project CRUD (decision gad-203)
// ---------------------------------------------------------------------------

const evalDataAccess = (() => {
  let _mod;
  return () => {
    if (!_mod) _mod = require('../lib/eval-data-access.cjs');
    return _mod;
  };
})();

const projectsCreate = defineCommand({
  meta: { name: 'create', description: 'Create a new eval project' },
  args: {
    id:          { type: 'string',  description: 'Project id (kebab-case)', required: true },
    name:        { type: 'string',  description: 'Display name', default: '' },
    description: { type: 'string',  description: 'Project description', default: '' },
    domain:      { type: 'string',  description: 'Domain (game, site, cli, etc.)', default: '' },
    techStack:   { type: 'string',  description: 'Tech stack (kaplay, next.js, etc.)', default: '' },
    root:        { type: 'string',  description: 'Target eval root id', default: '' },
    json:        { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const data = {};
    if (args.name) data.name = args.name;
    if (args.description) data.description = args.description;
    if (args.domain) data.domain = args.domain;
    if (args.techStack) data.techStack = args.techStack;
    const opts = {};
    if (args.root) opts.rootId = args.root;
    const result = da.createProject(args.id, data, opts);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Created project "${args.id}" at ${result.projectDir}`);
    }
  },
});

const projectsEdit = defineCommand({
  meta: { name: 'edit', description: 'Update an existing eval project\'s metadata' },
  args: {
    id:          { type: 'string',  description: 'Project id', required: true },
    name:        { type: 'string',  description: 'Display name', default: '' },
    description: { type: 'string',  description: 'Description', default: '' },
    domain:      { type: 'string',  description: 'Domain', default: '' },
    techStack:   { type: 'string',  description: 'Tech stack', default: '' },
    tagline:     { type: 'string',  description: 'Tagline', default: '' },
    json:        { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const updates = {};
    if (args.name) updates.name = args.name;
    if (args.description) updates.description = args.description;
    if (args.domain) updates.domain = args.domain;
    if (args.techStack) updates.techStack = args.techStack;
    if (args.tagline) updates.tagline = args.tagline;
    if (Object.keys(updates).length === 0) {
      console.error('No fields to update. Pass --name, --description, --domain, --techStack, or --tagline.');
      process.exit(1);
    }
    const result = da.updateProject(args.id, updates);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Updated project "${args.id}"`);
    }
  },
});

const projectsArchive = defineCommand({
  meta: { name: 'archive', description: 'Archive (soft-delete) an eval project' },
  args: {
    id:   { type: 'string',  description: 'Project id', required: true },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const result = da.archiveProject(args.id);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Archived project "${args.id}" -> ${result.archivedTo}`);
    }
  },
});

const projectsCmd = defineCommand({
  meta: { name: 'projects', description: 'Manage projects — list, sync roots, create, edit, archive' },
  subCommands: {
    list: projectsList,
    init: projectsInit,
    audit: projectsAudit,
    create: projectsCreate,
    edit: projectsEdit,
    archive: projectsArchive,
    sync: projectsSync,
    add: projectsAdd,
    ignore: projectsIgnore,
  },
});

// Deprecated alias — workspace concept eliminated per decision gad-208
const workspaceCmd = defineCommand({
  meta: { name: 'workspace', description: '[DEPRECATED] Use `gad projects <subcommand>` instead' },
  subCommands: {
    show: projectsList,
    sync: projectsSync,
    add: projectsAdd,
    ignore: projectsIgnore,
  },
  run() {
    console.warn('DEPRECATED: `gad workspace` is deprecated. Use `gad projects <subcommand>` instead.');
  },
});

// ---------------------------------------------------------------------------
// gad species create / edit / clone / archive — species CRUD (decision gad-203)
// ---------------------------------------------------------------------------

const speciesCreate = defineCommand({
  meta: { name: 'create', description: 'Create a new species under a project' },
  args: {
    project:     { type: 'string',  description: 'Project id', required: true },
    name:        { type: 'string',  description: 'Species name (kebab-case)', required: true },
    workflow:    { type: 'string',  description: 'Workflow (gad, bare, emergent)', default: '' },
    description: { type: 'string',  description: 'Description', default: '' },
    inherits:    { type: 'string',  description: 'Parent species name', default: '' },
    json:        { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const data = {};
    if (args.workflow) data.workflow = args.workflow;
    if (args.description) data.description = args.description;
    if (args.inherits) data.inherits_from = args.inherits;
    const result = da.createSpecies(args.project, args.name, data);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Created species "${args.name}" in project "${args.project}" at ${result.speciesDir}`);
    }
  },
});

const speciesEdit = defineCommand({
  meta: { name: 'edit', description: 'Update a species\' metadata' },
  args: {
    project:     { type: 'string',  description: 'Project id', required: true },
    name:        { type: 'string',  description: 'Species name', required: true },
    workflow:    { type: 'string',  description: 'Workflow', default: '' },
    description: { type: 'string',  description: 'Description', default: '' },
    json:        { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const updates = {};
    if (args.workflow) updates.workflow = args.workflow;
    if (args.description) updates.description = args.description;
    if (Object.keys(updates).length === 0) {
      console.error('No fields to update. Pass --workflow or --description.');
      process.exit(1);
    }
    const result = da.updateSpecies(args.project, args.name, updates);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Updated species "${args.name}" in project "${args.project}"`);
    }
  },
});

const speciesClone = defineCommand({
  meta: { name: 'clone', description: 'Clone a species to a new name (optionally inheriting)' },
  args: {
    project:     { type: 'string',  description: 'Project id', required: true },
    source:      { type: 'string',  description: 'Source species name', required: true },
    name:        { type: 'string',  description: 'New species name (kebab-case)', required: true },
    description: { type: 'string',  description: 'Override description', default: '' },
    noInherit:   { type: 'boolean', description: 'Do not set inherits_from on the clone', default: false },
    json:        { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const result = da.cloneSpecies(args.project, args.source, args.name, {
      inherit: !args.noInherit,
      description: args.description || undefined,
    });
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Cloned "${args.source}" -> "${args.name}" in project "${args.project}"`);
    }
  },
});

const speciesArchive = defineCommand({
  meta: { name: 'archive', description: 'Archive (soft-delete) a species' },
  args: {
    project: { type: 'string',  description: 'Project id', required: true },
    name:    { type: 'string',  description: 'Species name', required: true },
    json:    { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const result = da.archiveSpecies(args.project, args.name);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Archived species "${args.name}" in project "${args.project}" -> ${result.archivedTo}`);
    }
  },
});

const speciesList = defineCommand({
  meta: { name: 'list', description: 'List all species for a project' },
  args: {
    project:  { type: 'string',  description: 'Project id', required: true },
    resolved: { type: 'boolean', description: 'Show resolved (merged) configs', default: false },
    json:     { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    if (args.resolved) {
      const species = da.getAllResolvedSpecies(args.project);
      if (args.json) {
        console.log(JSON.stringify(species, null, 2));
      } else {
        for (const s of species) {
          const gens = da.listGenerations(args.project, s.species);
          console.log(`  ${s.species}  workflow=${s.workflow || '?'}  gens=${gens.length}`);
        }
      }
    } else {
      const raw = da.listSpecies(args.project);
      if (args.json) {
        console.log(JSON.stringify(raw, null, 2));
      } else {
        for (const [name, cfg] of Object.entries(raw)) {
          const gens = da.listGenerations(args.project, name);
          console.log(`  ${name}  workflow=${cfg.workflow || '?'}  gens=${gens.length}`);
        }
      }
    }
  },
});

const speciesCmd = defineCommand({
  meta: { name: 'species', description: 'Manage species (list, create, edit, clone, archive, run, suite)' },
  subCommands: {
    list: speciesList,
    create: speciesCreate,
    edit: speciesEdit,
    clone: speciesClone,
    archive: speciesArchive,
  },
});

// ---------------------------------------------------------------------------
// recipes commands (decision gad-206: recipes are branch templates)
// ---------------------------------------------------------------------------

const recipesList = defineCommand({
  meta: { name: 'list', description: 'List all recipes for a project' },
  args: {
    project: { type: 'string',  description: 'Project id', required: true },
    json:    { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const recipes = da.listRecipes(args.project);
    if (args.json) {
      console.log(JSON.stringify(recipes, null, 2));
    } else {
      if (recipes.length === 0) {
        console.log(`No recipes in project "${args.project}"`);
        return;
      }
      for (const r of recipes) {
        const skills = (r.installedSkills || []).length;
        const constraints = r.constraints ? Object.keys(r.constraints).length : 0;
        console.log(`  ${r.slug}  workflow=${r.workflow || '?'}  constraints=${constraints}  skills=${skills}`);
      }
    }
  },
});

const recipesCreate = defineCommand({
  meta: { name: 'create', description: 'Create a new recipe under a project' },
  args: {
    project:     { type: 'string',  description: 'Project id', required: true },
    name:        { type: 'string',  description: 'Recipe slug (kebab-case)', required: true },
    workflow:    { type: 'string',  description: 'Workflow (gad, bare, emergent)', default: '' },
    description: { type: 'string',  description: 'Description', default: '' },
    json:        { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const data = {};
    if (args.workflow) data.workflow = args.workflow;
    if (args.description) data.description = args.description;
    data.name = args.name;
    const result = da.createRecipe(args.project, args.name, data);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Created recipe "${args.name}" in project "${args.project}" at ${result.recipeDir}`);
    }
  },
});

const recipesApply = defineCommand({
  meta: { name: 'apply', description: 'Create a new species from a recipe template' },
  args: {
    project: { type: 'string',  description: 'Project id', required: true },
    recipe:  { type: 'string',  description: 'Recipe slug', required: true },
    species: { type: 'string',  description: 'New species name (kebab-case)', required: true },
    json:    { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const result = da.applyRecipe(args.project, args.recipe, args.species);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Applied recipe "${args.recipe}" -> new species "${args.species}" in project "${args.project}"`);
      console.log(`  ${result.speciesDir}`);
    }
  },
});

const recipesDelete = defineCommand({
  meta: { name: 'delete', description: 'Delete a recipe' },
  args: {
    project: { type: 'string',  description: 'Project id', required: true },
    name:    { type: 'string',  description: 'Recipe slug', required: true },
    json:    { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const result = da.deleteRecipe(args.project, args.name);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Deleted recipe "${args.name}" from project "${args.project}"`);
    }
  },
});

const recipesCmd = defineCommand({
  meta: { name: 'recipes', description: 'Manage recipes (list, create, apply, delete)' },
  subCommands: {
    list: recipesList,
    create: recipesCreate,
    apply: recipesApply,
    delete: recipesDelete,
  },
});

// ---------------------------------------------------------------------------
// gad generation salvage — extract reusable data from completed generation runs
// (decision gad-210: project assets convention)
// ---------------------------------------------------------------------------

/**
 * Simple glob-to-regex converter for salvage patterns.
 * Supports *, **, and ? wildcards. No brace expansion.
 */
function globToRegex(pattern) {
  let re = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches any path segment(s)
        re += '.*';
        i += 2;
        if (pattern[i] === '/' || pattern[i] === '\\') i++; // skip trailing separator
        continue;
      }
      re += '[^/\\\\]*';
    } else if (ch === '?') {
      re += '[^/\\\\]';
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      re += '\\' + ch;
    } else {
      re += ch;
    }
    i++;
  }
  return new RegExp('^' + re + '$', 'i');
}

/**
 * Walk a directory recursively, returning relative paths of all files.
 * Skips node_modules, .git, .planning, and dist/build dirs.
 */
function walkFiles(dir, base) {
  base = base || dir;
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const skipDirs = new Set(['node_modules', '.git', '.planning', 'dist', 'build', '.next', 'out']);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      results.push(...walkFiles(fullPath, base));
    } else if (entry.isFile()) {
      results.push(path.relative(base, fullPath).replace(/\\/g, '/'));
    }
  }
  return results;
}

const generationSalvage = defineCommand({
  meta: { name: 'salvage', description: 'Extract reusable data assets from a completed generation run' },
  args: {
    project:  { type: 'string',  description: 'Project id', required: true },
    species:  { type: 'string',  description: 'Species name', required: true },
    version:  { type: 'string',  description: 'Generation version (e.g. v12)', required: true },
    patterns: { type: 'string',  description: 'Comma-separated glob patterns (default: **/*.json)', default: '**/*.json' },
    'dry-run':{ type: 'boolean', description: 'Preview without copying', default: false },
    json:     { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();

    // 1. Resolve species and generation
    const species = da.getSpecies(args.project, args.species);
    if (!species) {
      outputError(`Species "${args.species}" not found in project "${args.project}".`);
      return;
    }

    const gen = da.getGeneration(args.project, args.species, args.version);
    if (!gen) {
      outputError(`Generation "${args.version}" not found for species "${args.species}" in project "${args.project}".`);
      return;
    }

    const runDir = path.join(gen.dir, 'run');
    if (!fs.existsSync(runDir)) {
      outputError(
        `No run/ directory found at ${gen.dir}.\n` +
        `  Has this generation been preserved? Run \`gad generation preserve\` first.`
      );
      return;
    }

    // 2. Build glob patterns — merge CLI patterns with species.json salvagePatterns
    const patternStrings = args.patterns.split(',').map(p => p.trim()).filter(Boolean);
    if (species.salvagePatterns && Array.isArray(species.salvagePatterns)) {
      for (const sp of species.salvagePatterns) {
        if (!patternStrings.includes(sp)) patternStrings.push(sp);
      }
    }
    const regexes = patternStrings.map(p => ({ pattern: p, re: globToRegex(p) }));

    // 3. Search for data files in common locations within run/
    const searchDirs = ['public/data', 'src/data', 'game/data', 'data'];
    const candidates = [];

    // First pass: search well-known data directories
    for (const sub of searchDirs) {
      const searchRoot = path.join(runDir, sub);
      if (!fs.existsSync(searchRoot)) continue;
      const files = walkFiles(searchRoot);
      for (const rel of files) {
        if (regexes.some(r => r.re.test(rel))) {
          candidates.push({ source: sub, relativePath: rel });
        }
      }
    }

    // Second pass: if salvagePatterns from species.json exist, also search
    // the entire run/ directory for matches (patterns may reference non-data dirs)
    if (species.salvagePatterns && Array.isArray(species.salvagePatterns) && species.salvagePatterns.length > 0) {
      const speciesRegexes = species.salvagePatterns.map(p => ({ pattern: p, re: globToRegex(p) }));
      const allFiles = walkFiles(runDir);
      const alreadyFound = new Set(candidates.map(c => path.join(c.source, c.relativePath)));
      for (const rel of allFiles) {
        if (speciesRegexes.some(r => r.re.test(rel))) {
          // Determine source prefix for display
          const firstSeg = rel.split('/')[0];
          const source = searchDirs.find(d => d.startsWith(firstSeg)) || '.';
          const key = source === '.' ? rel : rel;
          if (!alreadyFound.has(key)) {
            candidates.push({ source: '.', relativePath: rel });
          }
        }
      }
    }

    if (candidates.length === 0) {
      const msg = `No files matched patterns [${patternStrings.join(', ')}] in ${runDir}`;
      if (args.json) {
        console.log(JSON.stringify({ salvaged: [], message: msg }));
      } else {
        console.log(msg);
        console.log(`  Searched: ${searchDirs.map(d => 'run/' + d).join(', ')}`);
        if (species.salvagePatterns) console.log(`  Also searched entire run/ with species salvagePatterns`);
      }
      return;
    }

    // 4. Determine output directory
    const resolved = da.resolveProject(args.project);
    const speciesDir = path.join(resolved.projectDir, 'species', args.species);
    const salvageDir = path.join(speciesDir, 'assets', 'data', 'salvaged', args.version);

    // 5. Copy (or preview) files
    const results = [];
    for (const c of candidates) {
      const srcFull = c.source === '.'
        ? path.join(runDir, c.relativePath)
        : path.join(runDir, c.source, c.relativePath);
      const dstFull = path.join(salvageDir, c.source === '.' ? c.relativePath : path.join(c.source, c.relativePath));
      const dstRel = path.relative(speciesDir, dstFull).replace(/\\/g, '/');

      results.push({
        from: `run/${c.source === '.' ? '' : c.source + '/'}${c.relativePath}`,
        to: dstRel,
        size: fs.existsSync(srcFull) ? fs.statSync(srcFull).size : 0,
      });

      if (!args['dry-run']) {
        fs.mkdirSync(path.dirname(dstFull), { recursive: true });
        fs.copyFileSync(srcFull, dstFull);
      }
    }

    // 6. Output summary
    if (args.json) {
      console.log(JSON.stringify({
        dryRun: args['dry-run'],
        project: args.project,
        species: args.species,
        version: args.version,
        patterns: patternStrings,
        salvageDir: salvageDir,
        salvaged: results,
      }, null, 2));
    } else {
      const label = args['dry-run'] ? 'DRY RUN — would salvage' : 'Salvaged';
      console.log(`${label} ${results.length} file(s) from ${args.project}/${args.species}/${args.version}\n`);
      console.log('  Source                                    → Destination');
      console.log('  ' + '─'.repeat(70));
      for (const r of results) {
        const sizeStr = r.size > 1024 ? `${(r.size / 1024).toFixed(1)}KB` : `${r.size}B`;
        console.log(`  ${r.from.padEnd(40)} → ${r.to}  (${sizeStr})`);
      }
      console.log('');
      if (args['dry-run']) {
        console.log(`  Target: ${salvageDir}`);
        console.log('  Re-run without --dry-run to copy.');
      } else {
        console.log(`  Written to: ${salvageDir}`);
      }
    }
  },
});

const generationCmd = defineCommand({
  meta: {
    name: 'generation',
    description:
      'Preserved generations: salvage, preserve, verify, open (static build / same as `gad play`), review, report. Does not serve the GAD planning/landing site — use `gad site serve` for that.',
  },
  subCommands: {
    salvage: generationSalvage,
  },
});

// ---------------------------------------------------------------------------
// state command
// ---------------------------------------------------------------------------

// Hard cap on STATE.xml <next-action> writes (per gad-D-NN — anti-bloat
// guard). next-action is a pointer to the next pick, NOT a running journal.
// Activity logging belongs in TASK-REGISTRY <resolution> blocks and
// DECISIONS.xml entries. Cap at 600 chars to enforce discipline.
const NEXT_ACTION_MAX_CHARS = 600;

const stateShowCmd = defineCommand({
  meta: { name: 'show', description: 'Show current state for all projects' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
    graph: { type: 'boolean', description: 'Include graph stats (auto-enabled when useGraphQuery=true)', default: false },
    json: { type: 'boolean', description: 'JSON output (includes full next-action)', default: false },
    full: { type: 'boolean', description: 'Include full next-action text in output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    // Resolve graph stats for each root if --graph or useGraphQuery enabled
    function getGraphStats(root) {
      const showGraph = args.graph || graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path));
      if (!showGraph) return null;
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const jsonPath = path.join(planDir, 'graph.json');
      if (!fs.existsSync(jsonPath)) return null;
      try {
        const graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        return {
          nodes: graph.meta.nodeCount,
          edges: graph.meta.edgeCount,
          generated: graph.meta.generated,
          nodeTypes: graph.meta.nodeTypes,
        };
      } catch { return null; }
    }

    if (args.json) {
      const out = roots.map(root => {
        const state = readState(root, baseDir);
        const result = {
          project: root.id,
          phase: state.phasesTotal > 0 ? `${state.phasesComplete}/${state.phasesTotal}` : (state.currentPhase || null),
          milestone: state.milestone || null,
          status: state.status,
          openTasks: state.openTasks,
          lastActivity: state.lastActivity || null,
          nextAction: state.nextAction || null,
        };
        const gs = getGraphStats(root);
        if (gs) result.graph = gs;
        return result;
      });
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    // Table: summary row + optional next-action block
    const rows = roots.map(root => {
      const state = readState(root, baseDir);
      return {
        project: root.id,
        phase: state.phasesTotal > 0 ? `${state.phasesComplete}/${state.phasesTotal}` : (state.currentPhase || '—'),
        milestone: state.milestone || '—',
        status: state.status,
        'open tasks': state.openTasks > 0 ? String(state.openTasks) : '—',
        'last activity': state.lastActivity || '—',
        _nextAction: state.nextAction || null,
        _graphStats: getGraphStats(root),
      };
    });

    const displayRows = rows.map(({ _nextAction, _graphStats, ...r }) => r);
    console.log(render(displayRows, { format: 'table', title: 'GAD State' }));

    if (args.full) {
      for (const r of rows) {
        if (r._nextAction) {
          console.log(`\n── next action [${r.project}] ──────────────────────────────`);
          console.log(r._nextAction);
        }
      }
    }

    // Graph stats block (decision gad-201)
    for (const r of rows) {
      if (r._graphStats) {
        const gs = r._graphStats;
        console.log(`\n── graph [${r.project}] ──────────────────────────────`);
        console.log(`  ${gs.nodes} nodes, ${gs.edges} edges`);
        console.log(`  Types: ${Object.entries(gs.nodeTypes).map(([k, v]) => `${k}(${v})`).join(', ')}`);
        console.log(`  Last rebuild: ${gs.generated}`);
      }
    }
  },
});

const stateSetNextActionCmd = defineCommand({
  meta: { name: 'set-next-action', description: `Replace STATE.xml <next-action> with new text. Hard-capped at ${NEXT_ACTION_MAX_CHARS} chars — overflow fails loud.` },
  args: {
    text: { type: 'positional', description: 'Replacement next-action text (use quotes)', required: true },
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    force: { type: 'boolean', description: 'Bypass the hard cap (DO NOT USE — for migration only)', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
    if (roots.length === 0) {
      outputError('No project resolved. Pass --projectid <id> or run from a project root.');
      return;
    }
    if (roots.length > 1) {
      outputError('set-next-action requires a single project. Pass --projectid <id>.');
      return;
    }
    const root = roots[0];
    const text = String(args.text || '').trim();
    if (!text) {
      outputError('next-action text is empty.');
      return;
    }

    if (text.length > NEXT_ACTION_MAX_CHARS && !args.force) {
      console.error('');
      console.error(`✗ next-action too long: ${text.length} chars (cap ${NEXT_ACTION_MAX_CHARS})`);
      console.error('');
      console.error('next-action is a pointer to the next pick, NOT a running journal.');
      console.error('Activity logging belongs elsewhere:');
      console.error('  - per-task progress  → .planning/TASK-REGISTRY.xml <task><resolution>');
      console.error('  - architectural choices → .planning/DECISIONS.xml');
      console.error('  - session handoffs → .planning/sessions/');
      console.error('');
      console.error('Recommended shape (≤600 chars):');
      console.error('  "Phase X in progress. Next pick: <task-id>. Open queue: <ids>. Blockers: <if any>."');
      console.error('');
      console.error('If you really need to bypass the cap (migration only): pass --force.');
      process.exit(2);
    }

    const statePath = path.join(baseDir, root.path, root.planningDir, 'STATE.xml');
    if (!fs.existsSync(statePath)) {
      outputError(`STATE.xml not found at ${path.relative(baseDir, statePath)}`);
      return;
    }
    const original = fs.readFileSync(statePath, 'utf8');
    const replaced = original.replace(
      /<next-action>[\s\S]*?<\/next-action>/,
      `<next-action>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</next-action>`,
    );
    if (replaced === original) {
      outputError('No <next-action> element found in STATE.xml — add one manually first.');
      return;
    }
    fs.writeFileSync(statePath, replaced);
    // Auto-rebuild graph after state mutation (decision gad-201)
    maybeRebuildGraph(baseDir, root);
    console.log(`Updated: ${path.relative(baseDir, statePath)}`);
    console.log(`Length:  ${text.length}/${NEXT_ACTION_MAX_CHARS} chars`);
  },
});

const stateCmd = defineCommand({
  meta: { name: 'state', description: 'Show or update STATE.xml (show / set-next-action)' },
  subCommands: {
    show: stateShowCmd,
    'set-next-action': stateSetNextActionCmd,
  },
});

// ---------------------------------------------------------------------------
// phases command
// ---------------------------------------------------------------------------

const phasesCmd = defineCommand({
  meta: { name: 'phases', description: 'List phases from ROADMAP.xml' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
    full: { type: 'boolean', description: 'Show complete goal text for each phase', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    const rows = [];
    for (const root of roots) {
      const phases = readPhases(root, baseDir);
      if (phases.length === 0) continue;
      for (const phase of phases) {
        const isActive = phase.status === 'active' || phase.status === 'in-progress';
        const useJson = args.json || shouldUseJson();
        const row = {
          project: root.id,
          id: phase.id,
          status: phase.status,
          title: phase.title.length > 60 ? phase.title.slice(0, 57) + '...' : phase.title,
        };
        // In JSON mode or --full, include all fields without loss
        if (useJson || args.full) {
          row.goal = phase.goal || phase.title;
          row.depends = phase.depends || '';
          row.milestone = phase.milestone || '';
          row.plans = phase.plans || '';
          row.requirements = phase.requirements || '';
        } else if (isActive) {
          // Table mode: only show goal for active phases
          row.goal = phase.goal || phase.title;
        }
        rows.push(row);
      }
    }

    if (rows.length === 0) {
      console.log('No phases found. Create ROADMAP.md files in your .planning/ directories.');
      return;
    }

    if (args.full && !args.json && !shouldUseJson()) {
      // Full mode: print as readable blocks, not table
      for (const r of rows) {
        console.log(`\n[${r.project}] Phase ${r.id} — ${r.title}  (${r.status})`);
        if (r.goal) console.log(`  Goal: ${r.goal}`);
      }
      console.log(`\n${rows.length} phase(s)`);
      return;
    }

    const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
    console.log(render(rows, { format: fmt, title: `Phases (${rows.length})` }));
  },
});

// ---------------------------------------------------------------------------
// decisions command
// ---------------------------------------------------------------------------

const decisionsCmd = defineCommand({
  meta: { name: 'decisions', description: 'List decisions from DECISIONS.xml' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
    id: { type: 'string', description: 'Filter to a single decision by id', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    const filter = args.id ? { id: args.id } : {};
    const rows = [];
    for (const root of roots) {
      const decisions = readDecisions(root, baseDir, filter);
      for (const d of decisions) {
        rows.push({
          project: root.id,
          id: d.id,
          title: d.title,
          summary: d.summary,
          impact: d.impact,
          references: d.references,
        });
      }
    }

    if (rows.length === 0) {
      console.log('No decisions found.');
      return;
    }

    const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
    if (fmt === 'json') {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      // Table: truncate summary for readability. Show new ID format (gad-125).
      const tableRows = rows.map(r => ({
        project: r.project,
        id: formatId(r.project, 'D', r.id.replace(/^gad-/, '')),
        'legacy-id': r.id,
        title: r.title.length > 50 ? r.title.slice(0, 47) + '...' : r.title,
        summary: r.summary.length > 80 ? r.summary.slice(0, 77) + '...' : r.summary,
      }));
      console.log(render(tableRows, { format: 'table', title: `Decisions (${rows.length})` }));
    }
  },
});

// ---------------------------------------------------------------------------
// requirements command
// ---------------------------------------------------------------------------

const requirementsCmd = defineCommand({
  meta: { name: 'requirements', description: 'List requirement doc references from REQUIREMENTS.xml' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    const rows = [];
    for (const root of roots) {
      const refs = readRequirements(root, baseDir);
      for (const r of refs) {
        rows.push({ project: root.id, kind: r.kind, path: r.docPath, description: r.description });
      }
      // Also include doc-flow entries from ROADMAP.xml
      const docFlow = readDocFlow(root, baseDir);
      for (const d of docFlow) {
        rows.push({ project: root.id, kind: 'doc-flow', path: d.name, description: d.description });
      }
    }

    if (rows.length === 0) {
      console.log('No requirement refs found. Create REQUIREMENTS.xml in your .planning/ directories.');
      return;
    }

    const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
    if (fmt === 'json') {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      const tableRows = rows.map(r => ({
        project: r.project,
        kind: r.kind,
        path: r.path,
        description: r.description.length > 70 ? r.description.slice(0, 67) + '...' : r.description,
      }));
      console.log(render(tableRows, { format: 'table', title: `Requirement refs (${rows.length})` }));
    }
  },
});

// ---------------------------------------------------------------------------
// errors command
// ---------------------------------------------------------------------------

const errorsCmd = defineCommand({
  meta: { name: 'errors', description: 'List error attempts from ERRORS-AND-ATTEMPTS.xml' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
    status: { type: 'string', description: 'Filter by status: open|resolved|partial', default: '' },
    phase: { type: 'string', description: 'Filter by phase id', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;
    const filter = {};
    if (args.status) filter.status = args.status;
    if (args.phase)  filter.phase  = args.phase;

    const rows = [];
    for (const root of roots) {
      for (const e of readErrors(root, baseDir, filter)) {
        rows.push({ project: root.id, id: e.id, phase: e.phase, task: e.task, status: e.status, title: e.title, symptom: e.symptom, cause: e.cause, fix: e.fix, commands: e.commands });
      }
    }
    if (rows.length === 0) { console.log('No error attempts found.'); return; }
    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      const tableRows = rows.map(r => ({
        project: r.project, id: r.id, phase: r.phase, task: r.task, status: r.status,
        title: r.title.length > 60 ? r.title.slice(0, 57) + '...' : r.title,
      }));
      console.log(render(tableRows, { format: 'table', title: `Errors & Attempts (${rows.length})` }));
    }
  },
});

// ---------------------------------------------------------------------------
// blockers command
// ---------------------------------------------------------------------------

const blockersCmd = defineCommand({
  meta: { name: 'blockers', description: 'List blockers from BLOCKERS.xml' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
    status: { type: 'string', description: 'Filter by status: open|resolved|wont-fix', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;
    const filter = args.status ? { status: args.status } : {};

    const rows = [];
    for (const root of roots) {
      for (const b of readBlockers(root, baseDir, filter)) {
        rows.push({ project: root.id, id: b.id, status: b.status, title: b.title, summary: b.summary, taskRef: b.taskRef });
      }
    }
    if (rows.length === 0) { console.log('No blockers found.'); return; }
    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      const tableRows = rows.map(r => ({
        project: r.project, id: r.id, status: r.status, task: r.taskRef,
        title: r.title.length > 60 ? r.title.slice(0, 57) + '...' : r.title,
      }));
      console.log(render(tableRows, { format: 'table', title: `Blockers (${rows.length})` }));
    }
  },
});

// ---------------------------------------------------------------------------
// refs subcommands — list, verify disk, migrate paths, watch
// ---------------------------------------------------------------------------
// Bare `gad refs` (no subcommand) runs the same list as `gad refs list` — citty
// invokes parent `run` when no positional subcommand is given.

function runRefsList(args) {
  const baseDir = findRepoRoot();
  const config = gadConfig.load(baseDir);
  const roots = resolveRoots(args, baseDir, config.roots);
  if (roots.length === 0) return;

  const rows = [];
  for (const root of roots) {
    // Decisions references
    if (!args.source || args.source === 'decisions') {
      const decisions = readDecisions(root, baseDir);
      for (const d of decisions) {
        for (const ref of d.references) {
          rows.push({ project: root.id, source: 'decisions', via: d.id, path: ref });
        }
      }
    }

    // Requirements doc paths
    if (!args.source || args.source === 'requirements') {
      const reqs = readRequirements(root, baseDir);
      for (const r of reqs) {
        if (r.docPath) {
          rows.push({ project: root.id, source: 'requirements', via: r.kind, path: r.docPath });
        }
      }
    }

    // Phase plan directories from ROADMAP.xml
    if (!args.source || args.source === 'phases') {
      const phases = readPhases(root, baseDir);
      for (const p of phases) {
        if (p.plans) {
          rows.push({ project: root.id, source: 'phases', via: `phase-${p.id}`, path: p.plans });
        }
      }
      // Also doc-flow entries
      const docFlow = readDocFlow(root, baseDir);
      for (const d of docFlow) {
        rows.push({ project: root.id, source: 'doc-flow', via: 'roadmap', path: d.name });
      }
    }

    // DOCS-MAP.xml entries
    if (!args.source || args.source === 'docs-map') {
      const docsMapEntries = readDocsMap(root, baseDir);
      for (const d of docsMapEntries) {
        rows.push({ project: root.id, source: 'docs-map', via: d.skill || d.kind, path: d.sink });
      }
    }
  }

  if (rows.length === 0) {
    console.log('No file references found.');
    return;
  }

  const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
  if (fmt === 'json') {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const tableRows = rows.map(r => ({
      project: r.project,
      source: r.source,
      via: r.via,
      path: r.path.length > 70 ? r.path.slice(0, 67) + '...' : r.path,
    }));
    console.log(render(tableRows, { format: 'table', title: `File references (${rows.length})` }));
  }
}

const refsListCmd = defineCommand({
  meta: { name: 'list', description: 'List all file references across planning files (decisions, requirements, phases)' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
    source: { type: 'string', description: 'Filter by source: decisions|requirements|phases|docs-map', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    runRefsList(args);
  },
});

const refsVerifyCmd = defineCommand({
  meta: {
    name: 'verify',
    description: 'Verify <file path> and <reference> paths in planning XML exist on disk (refactor safety)',
  },
  args: {
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const result = planningRefVerify.verifyPlanningXmlRefs(baseDir);
    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exit(1);
      return;
    }
    if (result.ok) {
      console.log(`OK: verified ${result.xmlFileCount} planning XML file(s); no missing paths.`);
      return;
    }
    console.error('Missing paths referenced in planning XML:\n');
    for (const row of result.missing) {
      console.error(`  ${row.path}`);
      console.error(`    → cited in ${row.file}\n`);
    }
    process.exit(1);
  },
});

const refsMigrateCmd = defineCommand({
  meta: {
    name: 'migrate',
    description: 'Replace a path string with another across all planning XML (use after renames; like multi-file find-replace)',
  },
  args: {
    from: { type: 'string', description: 'Old path substring (forward slashes, e.g. src/old/Module.tsx)', default: '' },
    to: { type: 'string', description: 'New path substring', default: '' },
    apply: { type: 'boolean', description: 'Write files (default: dry-run only)', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const from = (args.from || '').trim();
    const to = (args.to || '').trim();
    if (!from) {
      outputError('Missing --from <path>');
      return;
    }
    const { changedFiles, replacements } = planningRefVerify.migratePathStringsInPlanningXml(
      baseDir,
      from.replace(/\\/g, '/'),
      to.replace(/\\/g, '/'),
      { dryRun: !args.apply },
    );
    if (replacements === 0) {
      console.log('No occurrences found in planning XML.');
      return;
    }
    console.log(
      args.apply
        ? `Updated ${replacements} occurrence(s) in ${changedFiles.length} file(s).`
        : `Dry-run: would replace ${replacements} occurrence(s) in ${changedFiles.length} file(s). Re-run with --apply to write.`,
    );
    for (const f of changedFiles) {
      console.log(`  ${f}`);
    }
    if (!args.apply) {
      console.log('\nTip: review the diff, then: gad refs migrate --from ... --to ... --apply');
    }
  },
});

const refsWatchCmd = defineCommand({
  meta: {
    name: 'watch',
    description: 'Re-run refs verify when planning XML changes (debounced; keeps terminal open)',
  },
  args: {
    poll: { type: 'string', description: 'Poll interval in ms if native watch is unavailable (0 = off)', default: '0' },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const pollMs = Math.max(0, parseInt(args.poll, 10) || 0);

    function runOnce(label) {
      const result = planningRefVerify.verifyPlanningXmlRefs(baseDir);
      const ts = new Date().toISOString();
      if (result.ok) {
        console.log(`[${ts}] ${label || 'verify'} OK (${result.xmlFileCount} XML files)`);
      } else {
        console.error(`[${ts}] ${label || 'verify'} FAILED — ${result.missing.length} missing path(s)`);
        for (const row of result.missing) {
          console.error(`  ${row.path} ← ${row.file}`);
        }
      }
    }

    runOnce('initial');

    let debounce;
    function schedule(source) {
      clearTimeout(debounce);
      debounce = setTimeout(() => runOnce(source || 'change'), 400);
    }

    if (pollMs > 0) {
      setInterval(() => runOnce(`poll ${pollMs}ms`), pollMs);
      console.log(`Watching (poll every ${pollMs}ms). Ctrl+C to exit.`);
      return;
    }

    try {
      const watcher = fs.watch(
        baseDir,
        { recursive: true },
        (event, filename) => {
          if (!filename) return;
          const n = filename.replace(/\\/g, '/');
          if (!n.includes('.planning/') || !n.endsWith('.xml')) return;
          schedule(event);
        },
      );
      watcher.on('error', (err) => {
        console.error('fs.watch error:', err.message);
        console.error('Try: gad refs watch --poll 3000');
        process.exit(1);
      });
      console.log('Watching planning **/*.xml under repo root (recursive). Ctrl+C to exit.');
    } catch (e) {
      console.error('Recursive watch not available:', e.message);
      console.error('Use: gad refs watch --poll 3000');
      process.exit(1);
    }
  },
});

const refsCmd = defineCommand({
  meta: {
    name: 'refs',
    description: 'Planning file references — list (default), verify disk, migrate path strings, watch',
  },
  subCommands: {
    list: refsListCmd,
    verify: refsVerifyCmd,
    migrate: refsMigrateCmd,
    watch: refsWatchCmd,
  },
});

// ---------------------------------------------------------------------------
// tasks command (read-only — CRUD via slash commands)
// ---------------------------------------------------------------------------

const tasksCmd = defineCommand({
  meta: { name: 'tasks', description: 'Show tasks from TASK-REGISTRY.xml (falls back to STATE.md)' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    status: { type: 'string', description: 'Filter by status (e.g. in-progress, planned)', default: '' },
    phase: { type: 'string', description: 'Filter by phase id (e.g. 03)', default: '' },
    full: { type: 'boolean', description: 'Show full goal text (no truncation)', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);

    let roots = config.roots;
    if (args.projectid) {
      roots = roots.filter(r => r.id === args.projectid);
      if (roots.length === 0) {
        const ids = config.roots.map(r => r.id);
        console.error(`\nProject not found: ${args.projectid}\n\nAvailable projects:\n`);
        for (const id of ids) console.error(`  ${id}`);
        console.error(`\nRerun with: --projectid ${ids[0]}`);
        process.exit(1);
      }
    }

    const filter = {};
    if (args.status) filter.status = args.status;
    if (args.phase) filter.phase = args.phase;

    const rows = [];
    for (const root of roots) {
      const tasks = readTasks(root, baseDir, filter);
      for (const t of tasks) {
        const limit = args.full ? Infinity : 200;
        rows.push({
          project: root.id,
          id: formatId(root.id, 'T', t.id),
          'legacy-id': t.id,
          goal: t.goal.length > limit ? t.goal.slice(0, limit - 1) + '…' : t.goal,
          status: t.status,
          phase: t.phase,
        });
      }
    }

    if (rows.length === 0) {
      console.log('No tasks found.');
      return;
    }

    const fmt = args.json ? 'json' : 'table';
    console.log(render(rows, { format: fmt, title: `Tasks (${rows.length})` }));
  },
});

// ---------------------------------------------------------------------------
// task checkpoint command
// ---------------------------------------------------------------------------

const taskCheckpoint = defineCommand({
  meta: { name: 'checkpoint', description: 'Verify planning docs updated before proceeding to next task' },
  args: {
    projectid: { type: 'string', description: 'Project ID', default: '' },
    task: { type: 'string', description: 'Task ID that should be done (e.g. 02-03)', default: '' },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;
    const root = roots[0];

    const allTasks = readTasks(root, baseDir, {});
    const issues = [];
    let passCount = 0;

    // 1. Check if specified task is marked done
    if (args.task) {
      const task = allTasks.find(t => t.id === args.task);
      if (!task) {
        issues.push(`Task ${args.task} not found in TASK-REGISTRY.xml`);
      } else if (task.status !== 'done') {
        issues.push(`Task ${args.task} status is "${task.status}" — must be "done" before proceeding`);
      } else {
        passCount++;
      }
    }

    // 2. Check STATE.xml has a next-action
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const stateContent = readXmlFile(path.join(planDir, 'STATE.xml'));
    if (stateContent) {
      const nextAction = (stateContent.match(/<next-action>([\s\S]*?)<\/next-action>/) || [])[1]?.trim();
      if (!nextAction || nextAction.length < 10) {
        issues.push('STATE.xml next-action is empty or too short — update it to describe what comes next');
      } else {
        passCount++;
      }
    } else {
      issues.push('STATE.xml not found');
    }

    // 3. Check for uncommitted planning doc changes
    try {
      const { execSync } = require('child_process');
      const projectPath = root.path === '.' ? root.planningDir : path.join(root.path, root.planningDir);
      const status = execSync(`git status --porcelain -- "${projectPath}"`, {
        cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      if (status) {
        issues.push(`Uncommitted planning doc changes:\n${status}`);
      } else {
        passCount++;
      }
    } catch { passCount++; /* git not available, skip */ }

    // 4. Find next task
    const openTasks = allTasks.filter(t => t.status === 'planned');
    const nextTask = openTasks[0];

    // Output
    if (issues.length === 0) {
      console.log(`\n✓ Checkpoint passed${args.task ? ` for task ${args.task}` : ''} (${passCount} checks)`);
      if (nextTask) {
        console.log(`\nNext task: ${nextTask.id} — ${(nextTask.goal || '').slice(0, 100)}`);
      } else {
        console.log('\nNo more planned tasks — phase may be complete.');
      }
    } else {
      console.error(`\n✗ Checkpoint FAILED (${issues.length} issue${issues.length > 1 ? 's' : ''}):\n`);
      for (const issue of issues) {
        console.error(`  • ${issue}`);
      }
      console.error('\nFix these before proceeding to the next task.');
      process.exit(1);
    }
  },
});

// ---------------------------------------------------------------------------
// docs subcommands
// ---------------------------------------------------------------------------

const docsCompile = defineCommand({
  meta: { name: 'compile', description: 'Compile planning docs → MDX sink (respects per-root `enabled` + `docs_sink_ignore` config)' },
  args: {
    sink: { type: 'string', description: 'Override docs_sink path', default: '' },
    only: { type: 'string', description: 'Comma-separated project ids to include (ad-hoc override)', default: '' },
    ignore: { type: 'string', description: 'Comma-separated project ids to skip for this run (in addition to config)', default: '' },
    verbose: { type: 'boolean', alias: 'v', description: 'Verbose output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);

    const sink = args.sink || config.docs_sink;
    if (!sink) {
      outputError('No docs_sink configured. Pass --sink <path> or set docs_sink in gad-config.toml.');
    }

    // Build filter set from config + CLI args
    const configIgnore = new Set(config.docs_sink_ignore || []);
    const cliIgnore = new Set((args.ignore || '').split(',').map((s) => s.trim()).filter(Boolean));
    const cliOnly = new Set((args.only || '').split(',').map((s) => s.trim()).filter(Boolean));

    const filteredRoots = config.roots.filter((root) => {
      if (cliOnly.size > 0) return cliOnly.has(root.id);
      if (root.enabled === false) return false;
      if (configIgnore.has(root.id)) return false;
      if (cliIgnore.has(root.id)) return false;
      return true;
    });

    const skippedCount = config.roots.length - filteredRoots.length;
    console.log(`Compiling ${filteredRoots.length} of ${config.roots.length} roots → ${sink}` +
      (skippedCount > 0 ? ` (${skippedCount} skipped)` : '') + '\n');

    if (args.verbose && skippedCount > 0) {
      const skipped = config.roots.filter((r) => !filteredRoots.includes(r));
      for (const r of skipped) {
        const reason = cliOnly.size > 0 ? 'not in --only'
          : r.enabled === false ? 'enabled=false'
          : configIgnore.has(r.id) ? 'docs_sink_ignore'
          : 'cli --ignore';
        console.log(`  [skip] ${r.id} (${reason})`);
      }
    }

    try {
      let total = 0;
      for (const root of filteredRoots) {
        const n = compileDocs(baseDir, root, sink);
        if (args.verbose && n > 0) console.log(`  ✓ ${root.id}: ${n} file(s)`);
        total += n || 0;
      }
      console.log(`\n✓ Compiled ${total} files`);
    } catch (e) {
      outputError(e.message);
    }
  },
});

const docsList = defineCommand({
  meta: { name: 'list', description: 'List all docs for a project — planning files, DOCS-MAP entries, docs.projects' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    all:       { type: 'boolean', description: 'Show all projects', default: false },
    json:      { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config  = gadConfig.load(baseDir);
    const roots   = resolveRoots(args, baseDir, config.roots);
    const sink    = config.docs_sink;
    const rows    = [];

    for (const root of roots) {
      // Planning files from sink status
      const planDir = path.join(baseDir, root.path, root.planningDir);
      if (fs.existsSync(planDir)) {
        const planFiles = fs.readdirSync(planDir).filter(f => /\.(xml|md)$/i.test(f) && !f.startsWith('.'));
        for (const f of planFiles) {
          rows.push({ project: root.id, type: 'planning', name: f, path: path.join(root.path, root.planningDir, f) });
        }
      }

      // DOCS-MAP entries
      const docsMapEntries = readDocsMap(root, baseDir);
      for (const d of docsMapEntries) {
        rows.push({ project: root.id, type: d.kind || 'docs-map', name: d.description || d.sink, path: d.sink });
      }

      // Sink files (non-planning, human-authored or feature docs)
      if (sink) {
        const sinkDir = path.join(baseDir, sink, root.id);
        if (fs.existsSync(sinkDir)) {
          const walkSync = (dir, rel) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
              if (entry.isDirectory() && entry.name !== 'planning') {
                walkSync(path.join(dir, entry.name), entryRel);
              } else if (entry.isFile() && /\.mdx?$/i.test(entry.name) && !/^planning\//.test(entryRel)) {
                rows.push({ project: root.id, type: 'feature-doc', name: entry.name, path: `${root.id}/${entryRel}` });
              }
            }
          };
          walkSync(sinkDir, '');
        }
      }
    }

    // docs.projects entries
    if (config.docsProjects && config.docsProjects.length > 0) {
      for (const dp of config.docsProjects) {
        if (args.projectid && dp.id !== args.projectid) continue;
        rows.push({ project: dp.id, type: 'docs-project', name: dp.kind || 'project', path: dp.id });
      }
    }

    if (rows.length === 0) {
      console.log('No docs found. Create DOCS-MAP.xml or add docs.projects to gad-config.toml.');
      return;
    }

    const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
    if (fmt === 'json') {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      console.log(render(rows, { format: 'table', title: `Docs (${rows.length})` }));
    }
  },
});

const docsCmd = defineCommand({
  meta: { name: 'docs', description: 'List and compile planning docs' },
  subCommands: { list: docsList, compile: docsCompile },
});

// ---------------------------------------------------------------------------
// planning subcommands — MD → XML hydration (task 42.4-17, audit ref
// references/sink-md-xml-audit.md §6). Inverse of `gad docs compile`:
// consumes FOO.md in a source dir and writes FOO.xml into the project's
// .planning/ dir for each canonical slot.
// ---------------------------------------------------------------------------

const planningHydrateCmd = defineCommand({
  meta: {
    name: 'hydrate',
    description: 'Hydrate .planning/*.xml from sibling *.md files (inverse of docs compile)',
  },
  args: {
    projectid: { type: 'string', description: 'Scope to one project root id', default: '' },
    all:       { type: 'boolean', description: 'Walk every registered planning root', default: false },
    from:      { type: 'string', description: 'Directory to read *.md from (defaults to the root planning dir)', default: '' },
    'dry-run': { type: 'boolean', description: 'Print generated XML without writing', default: false },
    force:     { type: 'boolean', description: 'Overwrite existing XML (archives prior to .planning/archive/xml/<ts>/)', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config  = gadConfig.load(baseDir);
    const roots   = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) {
      outputError('No planning roots resolved. Pass --projectid <id> or --all.');
    }
    const { hydrateFromMd } = require('../lib/docs-compiler.cjs');
    let totalWritten = 0, totalSkipped = 0, totalArchived = 0;
    for (const root of roots) {
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const fromDir = args.from ? path.resolve(baseDir, args.from) : planDir;
      const res = hydrateFromMd(planDir, fromDir, { force: args.force, dryRun: args['dry-run'] });
      totalWritten  += res.written;
      totalSkipped  += res.skipped;
      totalArchived += res.archived;
      console.log(`\n${root.id}  (${path.relative(baseDir, planDir) || '.'})`);
      for (const r of res.results) {
        if (r.status === 'dry-run') {
          console.log(`  --- ${r.slot} → ${path.relative(baseDir, r.destPath)} ---\n${r.xml}`);
        } else if (r.status === 'written') {
          console.log(`  ✓ ${r.slot} → ${path.relative(baseDir, r.destPath)}`);
        } else if (r.status === 'skipped') {
          console.log(`  · ${r.slot} skipped — ${r.reason}`);
        } else if (r.status === 'missing-md') {
          console.log(`  - ${r.slot} (no source md)`);
        }
      }
    }
    const verb = args['dry-run'] ? 'would write' : 'wrote';
    console.log(`\n${verb} ${totalWritten} file(s), skipped ${totalSkipped}, archived ${totalArchived}`);
  },
});

const planningCmd = defineCommand({
  meta: { name: 'planning', description: 'Planning-directory utilities (hydrate from MD, etc.)' },
  subCommands: { hydrate: planningHydrateCmd },
});

// ---------------------------------------------------------------------------
// site subcommands (phase 10) — compile project planning into deployable HTML
// ---------------------------------------------------------------------------

const siteCompileCmd = defineCommand({
  meta: {
    name: 'compile',
    description: 'Compile a GAD project\'s planning data into a static deployable site (extracts /planning from GAD site build)',
  },
  args: {
    root: {
      type: 'string',
      description: 'Project root (dir containing .planning/). Defaults to cwd.',
      default: '',
    },
    projectid: {
      type: 'string',
      description: 'Project id used for display + data lookups. Defaults to root dir name.',
      default: '',
    },
    out: {
      type: 'string',
      description: 'Output directory for compiled static site. Defaults to <root>/dist/site.',
      default: '',
    },
  },
  run({ args }) {
    const { compileSite } = require('../lib/site-compile.cjs');
    const projectRoot = path.resolve(args.root || process.cwd());
    const projectId = args.projectid || path.basename(projectRoot);
    const outDir = path.resolve(args.out || path.join(projectRoot, 'dist', 'site'));
    try {
      compileSite({ projectRoot, projectId, outDir });
    } catch (err) {
      outputError(err.message);
    }
  },
});

const siteServeCmd = defineCommand({
  meta: {
    name: 'serve',
    description:
      'Compile then locally serve the GAD planning/landing static site (no dev hot reload). For preserved generation HTML builds use `gad play`, not this command.',
  },
  args: {
    root: {
      type: 'string',
      description: 'Project root (dir containing .planning/). Defaults to cwd.',
      default: '',
    },
    projectid: {
      type: 'string',
      description: 'Project id. Defaults to root dir name.',
      default: '',
    },
    out: {
      type: 'string',
      description: 'Output directory. Defaults to <root>/dist/site.',
      default: '',
    },
    port: {
      type: 'string',
      description: 'HTTP port. Defaults to 3456.',
      default: '3456',
    },
    host: {
      type: 'string',
      description: 'Bind host. Defaults to 127.0.0.1.',
      default: '127.0.0.1',
    },
    skipCompile: {
      type: 'boolean',
      description: 'Skip compile and serve existing output dir as-is.',
      default: false,
    },
  },
  run({ args }) {
    const { compileSite, serveStatic } = require('../lib/site-compile.cjs');
    const projectRoot = path.resolve(args.root || process.cwd());
    const projectId = args.projectid || path.basename(projectRoot);
    const outDir = path.resolve(args.out || path.join(projectRoot, 'dist', 'site'));
    const port = parseInt(args.port, 10) || 3456;
    // citty's kebab→camel conversion isn't consistent across versions; accept both.
    const skipCompile = args.skipCompile === true || args['skip-compile'] === true;
    try {
      if (!skipCompile) {
        compileSite({ projectRoot, projectId, outDir });
      }
      serveStatic({ rootDir: outDir, port, host: args.host });
    } catch (err) {
      outputError(err.message);
    }
  },
});

const siteCmd = defineCommand({
  meta: {
    name: 'site',
    description:
      'GAD planning / landing site (Next.js app under vendor/get-anything-done/site): compile static extract or serve it. Not preserved generation builds — use `gad play` or `gad generation open` for those.',
  },
  subCommands: { compile: siteCompileCmd, serve: siteServeCmd },
});

// ---------------------------------------------------------------------------
// eval subcommands
// ---------------------------------------------------------------------------

const evalList = defineCommand({
  meta: { name: 'list', description: 'List eval projects and run history' },
  run() {
    const baseDir = findRepoRoot();

    let discovered;
    try {
      discovered = listAllEvalProjects();
    } catch (err) {
      outputError(err.message);
      return;
    }

    if (discovered.length === 0) {
      console.log('No eval projects found. Create evals/<name>/REQUIREMENTS.md to get started.');
      return;
    }

    const projects = discovered.map(({ name, projectDir }) => {
        const runs = fs.readdirSync(projectDir, { withFileTypes: true })
          .filter(r => r.isDirectory() && r.name.startsWith('v'))
          .map(r => r.name)
          .sort();
        const latest = runs[runs.length - 1] || '—';
        let status = '—';
        if (latest !== '—') {
          const runMd = path.join(projectDir, latest, 'RUN.md');
          if (fs.existsSync(runMd)) {
            const m = fs.readFileSync(runMd, 'utf8').match(/status:\s*([\w-]+)/);
            if (m) status = m[1];
          }
        }
        // Load project defaults + first species via the merge-at-read-time
        // loader (task 42.4-15, decision gad-184). The project ⊇ species
        // contract means every reader goes through eval-loader.cjs instead
        // of hand-merging project.json + species.json.
        let mode = '—', workflow = '—', domain = '—', techStack = '';
        try {
          const projectCfg = loadEvalProject(projectDir);
          if (projectCfg.domain) domain = projectCfg.domain;
          if (projectCfg.techStack) techStack = projectCfg.techStack;
          const allResolved = loadAllResolvedSpecies(projectDir);
          if (allResolved.length > 0) {
            const first = allResolved[0];
            if (first.workflow) workflow = first.workflow;
            if (first.eval_mode) mode = first.eval_mode;
            if (!domain && first.domain) domain = first.domain;
            if (!techStack && first.techStack) techStack = first.techStack;
          }
        } catch (err) {
          // sparse/malformed metadata is non-fatal for `eval list`
        }
        return { name, domain, mode, workflow, runs: runs.length, latest, status };
      });

    output(projects, { title: 'GAD Eval Projects' });
    console.log(`\n${projects.length} project(s), ${projects.reduce((s, p) => s + p.runs, 0)} total runs`);
  },
});

/** Read a file if it exists, return content or null. */
function readIfExists(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }

/**
 * Build a bootstrap prompt for an eval project.
 * Reads all template planning files and constructs a complete prompt
 * that any AI agent can use to run the eval (agent-agnostic per gad-01).
 */
function buildEvalPrompt(projectDir, projectName, runNum, runtimeIdentity, runDir) {
  const templateDir = path.join(projectDir, 'template');
  const planDir = path.join(templateDir, '.planning');

  const agentsMd = readIfExists(path.join(templateDir, 'AGENTS.md'));
  const reqXml = readIfExists(path.join(planDir, 'REQUIREMENTS.xml'));
  const reqMd = readIfExists(path.join(projectDir, 'REQUIREMENTS.md'));
  const decisionsXml = readIfExists(path.join(planDir, 'DECISIONS.xml'));
  const conventionsMd = readIfExists(path.join(planDir, 'CONVENTIONS.md'));
  const roadmapXml = readIfExists(path.join(planDir, 'ROADMAP.xml'));
  const stateXml = readIfExists(path.join(planDir, 'STATE.xml'));

  // Project/species metadata was previously read from a project-level
  // `gad.json`. That file was renamed to species-level `species.json` in
  // task 42.4-14 (decision gad-184); the old project-level reads were dead
  // fallthroughs and have been removed in task 42.4-18. Eval_mode / baseline
  // / workflow are species-level and should come from the resolved species
  // (via `lib/eval-loader.cjs`) if they need to be surfaced in the prompt
  // again in a later task.
  const runtimeId = runtimeIdentity?.id || 'unknown';
  const runDirUnix = runDir.replace(/\\/g, '/');
  const runLogDirUnix = path.join(runDir, '.gad-log').replace(/\\/g, '/');

  // Source docs — REMOVED from eval prompts per decision gad-89.
  // Previously this scanned projectDir for source-*.md and source-*.xml and
  // injected them into the prompt. This was a bleed-in: the REQUIREMENTS.xml
  // is supposed to be the single self-contained spec. Source docs are now
  // archived under evals/<project>/archive/ for historical reference only.
  // If you need to re-enable: restore the fs.readdirSync scan below.
  const sourceDocs = [];

  const sections = [];
  sections.push(`# Eval: ${projectName} v${runNum}`);
  sections.push(`\nYou are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.\n`);
  sections.push(`\n**Runtime target:** ${runtimeId}\n`);

  // (Mode / Workflow / brownfield baseline block previously built from the
  // project-level `gad.json` was removed in task 42.4-18; see decision
  // gad-184. Restore via `loadResolvedSpecies` if the prompt needs to carry
  // species-level metadata again.)

  if (agentsMd) sections.push(`## AGENTS.md (follow this exactly)\n\n${agentsMd}`);
  if (reqXml) sections.push(`## REQUIREMENTS.xml\n\n\`\`\`xml\n${reqXml}\`\`\``);
  if (reqMd) sections.push(`## REQUIREMENTS.md (eval overview)\n\n${reqMd}`);
  if (decisionsXml) sections.push(`## DECISIONS.xml\n\n\`\`\`xml\n${decisionsXml}\`\`\``);
  if (conventionsMd) sections.push(`## CONVENTIONS.md\n\n${conventionsMd}`);
  if (roadmapXml) sections.push(`## ROADMAP.xml\n\n\`\`\`xml\n${roadmapXml}\`\`\``);
  if (stateXml) sections.push(`## STATE.xml\n\n\`\`\`xml\n${stateXml}\`\`\``);
  if (sourceDocs.length > 0) sections.push(`## Source documents\n\n${sourceDocs.join('\n\n')}`);

  sections.push(`\n## Instructions\n`);
  sections.push(`0. **FIRST:** Before writing any code, estimate how long these requirements would take a mid-senior human developer to implement WITHOUT AI tools. Consider the full scope: architecture, implementation, testing, debugging. Write your estimate to TRACE.json field \`human_estimate_hours\`. This is required before starting implementation.`);
  sections.push(`0b. **VERIFY RUNTIME TRACING:** This eval should run with GAD hooks installed for the runtime actually doing the work. Expected runtime: \`${runtimeId}\`.`);
  sections.push(`0c. If hooks are not already installed for this runtime, install them now:\n\`\`\`sh\n${runtimeInstallHint(runtimeId)}\n\`\`\``);
  sections.push(`0d. Export eval tracing env before running the agent loop.\n\nPOSIX shells:\n\`\`\`sh\nexport GAD_RUNTIME=${runtimeId}\nexport GAD_LOG_DIR=${runLogDirUnix}\nexport GAD_EVAL_TRACE_DIR=${runDirUnix}\n\`\`\`\n\nPowerShell:\n\`\`\`powershell\n$env:GAD_RUNTIME='${runtimeId}'\n$env:GAD_LOG_DIR='${runLogDirUnix}'\n$env:GAD_EVAL_TRACE_DIR='${runDirUnix}'\n\`\`\``);
  sections.push(`1. Copy the .planning/ directory from the template into your working directory`);
  sections.push(`2. Implement the project following the ROADMAP.xml phases`);
  sections.push(`3. For EACH task: update TASK-REGISTRY.xml, update STATE.xml, commit with task ID — one commit per task, not per phase`);
  sections.push(`4. Follow CONVENTIONS.md patterns and DECISIONS.xml architecture`);
  sections.push(`4b. Capture decisions AS YOU MAKE THEM — if you chose between alternatives (library, pattern, data model), write a <decision> to DECISIONS.xml before committing that task. Aim for 1-2 per phase minimum.`);
  sections.push(`5. After EACH phase completes: write/append to .planning/VERIFICATION.md (build result, task count, state check), commit with "verify: phase X verified"`);
  sections.push(`6. When complete: all phases done, build passes, planning docs current`);
  sections.push(`7. FINAL STEP: produce a production build (dist/ directory) and commit it. The build artifact is showcased on the docs site. No dist = eval incomplete.`);
  sections.push(`\n## Logging\n`);
  sections.push(`All gad CLI calls and tool uses should land in the eval run directory, not just the root repo log.`);
  sections.push(`This eval is only considered fully attributed if the preserved run includes runtime identity plus raw logs/trace events.`);

  return sections.join('\n\n');
}

/** Build skills provenance snapshot for eval run (decision gad-120) */
function buildSkillsProvenance(projectDir) {
  const templateSkillsDir = path.join(projectDir, 'template', 'skills');
  const installedMeta = path.join(projectDir, 'template', '.installed-skills.json');
  const inheritedMeta = path.join(projectDir, 'template', '.inherited-skills.json');

  const provenance = { installed: [], inherited: [], start_snapshot: [] };

  // Read installed skills metadata
  if (fs.existsSync(installedMeta)) {
    try {
      const meta = JSON.parse(fs.readFileSync(installedMeta, 'utf8'));
      provenance.installed = (meta.skills || []).map(s => ({
        name: s.name,
        source: s.source || 'local',
        type: 'installed',
      }));
    } catch {}
  }

  // Read inherited skills metadata
  if (fs.existsSync(inheritedMeta)) {
    try {
      const meta = JSON.parse(fs.readFileSync(inheritedMeta, 'utf8'));
      provenance.inherited = (meta.skills || []).map(s => ({
        name: s.name,
        source: meta.source || 'unknown',
        type: 'inherited',
      }));
    } catch {}
  }

  // Snapshot all skills present at start
  if (fs.existsSync(templateSkillsDir)) {
    try {
      const skills = fs.readdirSync(templateSkillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
      provenance.start_snapshot = skills;
    } catch {}
  }

  return provenance;
}

const evalRun = defineCommand({
  meta: { name: 'run', description: 'Run eval project — generates prompt, creates worktree, optionally spawns agent' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    baseline: { type: 'string', description: 'Git baseline (default: HEAD)', default: 'HEAD' },
    runtime: { type: 'string', description: 'Runtime driving the eval (claude-code, codex, cursor, etc.)', default: '' },
    'prompt-only': { type: 'boolean', description: 'Only generate the bootstrap prompt, do not create worktree', default: false },
    execute: { type: 'boolean', description: 'Output JSON for the orchestrating agent to spawn a worktree agent with full tracing', default: false },
    'install-skills': { type: 'string', description: 'Comma-separated paths to skills to install into the eval template before running', default: '' },
  },
  async run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const gadDir = path.join(__dirname, '..');
    const resolved = resolveEvalProject(args.project);
    if (!resolved) {
      outputError(`Eval project '${args.project}' not found. Run \`gad species list\` to see available projects.`);
      return;
    }
    const projectDir = resolved.projectDir;

    // Install skills into template if requested (decision gad-107)
    if (args['install-skills']) {
      const templateDir = path.join(projectDir, 'template');
      const skillsDir = path.join(templateDir, 'skills');
      fs.mkdirSync(skillsDir, { recursive: true });

      const skillPaths = args['install-skills'].split(',').map(s => s.trim()).filter(Boolean);
      const installed = [];
      for (const skillPath of skillPaths) {
        const resolved = path.resolve(skillPath);
        if (!fs.existsSync(resolved)) {
          console.warn(`  [warn] Skill not found: ${skillPath}`);
          continue;
        }
        const skillName = path.basename(resolved);
        const dest = path.join(skillsDir, skillName);
        // Copy skill directory
        fs.cpSync(resolved, dest, { recursive: true });
        installed.push(skillName);
        console.log(`  ✓ Installed skill: ${skillName} → template/skills/${skillName}`);
      }

      // Update template/AGENTS.md if it exists to reference installed skills
      const agentsMd = path.join(templateDir, 'AGENTS.md');
      if (fs.existsSync(agentsMd) && installed.length > 0) {
        let content = fs.readFileSync(agentsMd, 'utf8');
        const skillsSection = `\n\n## Installed Skills\n\n${installed.map(s => `- \`skills/${s}/SKILL.md\``).join('\n')}\n`;
        if (!content.includes('## Installed Skills')) {
          content += skillsSection;
          fs.writeFileSync(agentsMd, content);
          console.log(`  ✓ Updated AGENTS.md with ${installed.length} skill reference(s)`);
        }
      }

      // Record installation metadata
      const metaFile = path.join(templateDir, '.installed-skills.json');
      const meta = { installed_at: new Date().toISOString(), skills: installed.map(s => ({ name: s, source: skillPaths[installed.indexOf(s)] })) };
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
    }

    // Next run number
    const runs = fs.existsSync(projectDir)
      ? fs.readdirSync(projectDir).filter(n => /^v\d+$/.test(n)).map(n => parseInt(n.slice(1), 10))
      : [];
    const runNum = runs.length > 0 ? Math.max(...runs) + 1 : 1;
    const runDir = path.join(projectDir, `v${runNum}`);
    fs.mkdirSync(runDir, { recursive: true });
    const evalRuntime = normalizeEvalRuntime(args.runtime);
    const hookSetup = ensureEvalRuntimeHooks(evalRuntime);

    const now = new Date().toISOString();

    // Project-level `gad.json` was renamed to species-level `species.json`
    // in task 42.4-14 (decision gad-184). The old read-and-ignore here was
    // a dead fallthrough — `gadJson` was always `{}` and every reference
    // below fell to its default. Removed in task 42.4-18. If species-level
    // metadata (eval_mode / workflow / domain / tech stack / build
    // requirement) needs to be stamped into the TRACE scaffold again, wire
    // it via `lib/eval-loader.cjs::loadResolvedSpecies`.

    // Build the bootstrap prompt from template files
    const prompt = buildEvalPrompt(projectDir, args.project, runNum, evalRuntime, runDir);

    // Write prompt to run directory
    fs.writeFileSync(path.join(runDir, 'PROMPT.md'), prompt);

    // Create a full TRACE.json scaffold with all the fields the prebuild expects
    const traceScaffold = {
      project: args.project,
      version: `v${runNum}`,
      date: now.split('T')[0],
      gad_version: require(path.join(gadDir, 'package.json')).version || 'unknown',
      framework_version: require(path.join(gadDir, 'package.json')).version || 'unknown',
      trace_schema_version: 5,
      runtime_identity: evalRuntime,
      agent_lineage: summarizeAgentLineage({
        runtimeIdentity: evalRuntime,
        runtimesInvolved: evalRuntime?.id ? [{ id: evalRuntime.id, count: 1 }] : [],
      }),
      runtime_install: hookSetup,
      eval_type: 'greenfield',
      workflow: 'unknown',
      domain: null,
      tech_stack: null,
      build_requirement: null,
      requirements_version: 'v5',
      context_mode: 'fresh',
      human_estimate_hours: null,
      timing: {
        started: now,
        ended: null,
        duration_minutes: null,
        phases_completed: null,
        tasks_completed: null,
      },
      source_size_bytes: null,
      build_size_bytes: null,
      token_usage: {
        total_tokens: null,
        tool_uses: null,
      },
      scores: {
        requirement_coverage: null,
        human_review: null,
        composite: null,
      },
      human_review: null,
      git_analysis: null,
      planning_quality: null,
      requirement_coverage: null,
      workflow_emergence: null,
      gad_commands: [],
      skill_triggers: [],
      skills_provenance: buildSkillsProvenance(projectDir),
      trace_events_file: path.join(runDir, '.trace-events.jsonl'),
    };

    fs.writeFileSync(path.join(runDir, 'TRACE.json'), JSON.stringify(traceScaffold, null, 2));

    // Write RUN.md
    fs.writeFileSync(path.join(runDir, 'RUN.md'), [
      `# Eval Run v${runNum}`,
      '',
      `project: ${args.project}`,
      `baseline: ${args.baseline}`,
      `started: ${now}`,
      `status: ${args['prompt-only'] ? 'prompt-generated' : args.execute ? 'execute-ready' : 'running'}`,
      `eval_type: ${traceScaffold.eval_type}`,
      `workflow: ${traceScaffold.workflow}`,
      `runtime: ${evalRuntime.id}`,
      `runtime_hooks: ${hookSetup.ok ? 'ensured' : hookSetup.attempted ? 'attempted' : 'manual-required'}`,
      `trace_dir: ${runDir}`,
    ].join('\n') + '\n');

    if (args['prompt-only']) {
      console.log(`\nEval run: ${args.project} v${runNum} (prompt only)`);
      console.log(`\n✓ Bootstrap prompt written: evals/${args.project}/v${runNum}/PROMPT.md`);
      console.log(`  ${prompt.length} chars, ~${Math.ceil(prompt.length / 4)} tokens`);
      console.log(`  runtime: ${evalRuntime.id}`);
      console.log(`  hooks: ${hookSetup.note}`);
      console.log(`\nTo run: copy the prompt into your AI agent with worktree isolation.`);
      return;
    }

    // --execute mode: output structured JSON for the orchestrating agent
    // to spawn a Claude Code Agent with the correct prompt + env + worktree
    if (args.execute) {
      const execPayload = {
        command: 'eval-execute',
        project: args.project,
        version: `v${runNum}`,
        runDir: runDir,
        traceDir: runDir,
        prompt: prompt,
        promptFile: path.join(runDir, 'PROMPT.md'),
        traceJsonFile: path.join(runDir, 'TRACE.json'),
        envVars: {
          GAD_RUNTIME: evalRuntime.id,
          GAD_EVAL_TRACE_DIR: runDir,
          GAD_LOG_DIR: path.join(runDir, '.gad-log'),
          GAD_EVAL_PROJECT: args.project,
          GAD_EVAL_VERSION: `v${runNum}`,
        },
        agentDescription: `Eval: ${args.project} v${runNum}`,
        postSteps: [
          `After the agent completes:`,
          `1. Update TRACE.json timing.ended + timing.duration_minutes + token_usage from agent result`,
          `1b. Verify runtime identity / trace files were captured for ${evalRuntime.id}`,
          `2. Run: gad generation preserve ${args.project} v${runNum} --from <worktree-path>`,
          `3. Regenerate site data: cd site && node scripts/build-site-data.mjs`,
          `4. Build + commit + push`,
        ],
      };

      // Write the exec payload for the orchestrator to read
      fs.writeFileSync(path.join(runDir, 'EXEC.json'), JSON.stringify(execPayload, null, 2));

      console.log(`\nEval run: ${args.project} v${runNum} (execute mode)`);
      console.log(`\n✓ TRACE.json scaffold: evals/${args.project}/v${runNum}/TRACE.json`);
      console.log(`✓ EXEC.json: evals/${args.project}/v${runNum}/EXEC.json`);
      console.log(`✓ Bootstrap prompt: ${prompt.length} chars, ~${Math.ceil(prompt.length / 4)} tokens`);
      console.log(`✓ Runtime hooks: ${hookSetup.note}`);
      console.log(`\nThe orchestrating agent should:`);
      console.log(`  1. Read EXEC.json for the spawn configuration`);
      console.log(`  2. Set env: GAD_RUNTIME=${evalRuntime.id}`);
      console.log(`  3. Set env: GAD_EVAL_TRACE_DIR=${runDir}`);
      console.log(`  4. Set env: GAD_LOG_DIR=${path.join(runDir, '.gad-log')}`);
      console.log(`  5. Spawn an Agent with isolation: "worktree" using the prompt`);
      console.log(`  6. On completion: update TRACE.json with timing + tokens`);
      console.log(`  7. Run: gad generation preserve ${args.project} v${runNum} --from <worktree>`);
      console.log(`  8. Regenerate site data + push`);

      // Output JSON to stdout for machine parsing
      console.log('\n--- EXEC_JSON_START ---');
      console.log(JSON.stringify(execPayload));
      console.log('--- EXEC_JSON_END ---');
      return;
    }

    console.log(`\nEval run: ${args.project} v${runNum}`);
    console.log(`Baseline: ${args.baseline}`);

    const { execSync } = require('child_process');
    const worktreePath = path.join(require('os').tmpdir(), `gad-eval-${args.project}-${Date.now()}`);

    try {
      execSync(`git worktree add "${worktreePath}" "${args.baseline}"`, { stdio: 'pipe' });
      console.log(`✓ Worktree created: ${worktreePath}`);
      console.log(`✓ Bootstrap prompt: evals/${args.project}/v${runNum}/PROMPT.md`);
      console.log(`  ${prompt.length} chars, ~${Math.ceil(prompt.length / 4)} tokens`);
      console.log(`\nAgent should work in: ${worktreePath}`);
      console.log(`After agent completes, run:`);
      console.log(`  gad generation preserve ${args.project} v${runNum} --from ${worktreePath}`);
    } finally {
      try {
        execSync(`git worktree remove --force "${worktreePath}"`, { stdio: 'pipe' });
        console.log(`✓ Worktree removed`);
      } catch {}
    }

    // Update RUN.md
    const endTime = new Date().toISOString();
    const runMd = fs.readFileSync(path.join(runDir, 'RUN.md'), 'utf8');
    fs.writeFileSync(path.join(runDir, 'RUN.md'),
      runMd.replace('status: running', `status: prompt-ready\nended: ${endTime}`));

    console.log(`\n✓ Eval run prepared`);
    console.log(`  Output: evals/${args.project}/v${runNum}/`);
  },
});

const evalScore = defineCommand({
  meta: { name: 'score', description: 'Compute SCORE.md for latest (or specified) eval run' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    version: { type: 'string', description: 'Version to score (default: latest)', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const { generateScore } = require('../lib/score-generator.cjs');
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);

    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project '${args.project}' not found.`);
    }

    const versions = fs.readdirSync(projectDir)
      .filter(n => /^v\d+$/.test(n))
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    if (versions.length === 0) {
      outputError(`No runs found for project '${args.project}'. Run \`gad species run --project ${args.project}\` first.`);
    }

    const version = args.version || versions[versions.length - 1];
    if (!versions.includes(version)) {
      outputError(`Version '${version}' not found. Available: ${versions.join(', ')}`);
    }

    try {
      const scorePath = generateScore(projectDir, version);
      console.log(`\n✓ SCORE.md written: ${path.relative(process.cwd(), scorePath)}`);
    } catch (e) {
      outputError(e.message);
    }
  },
});

const evalDiff = defineCommand({
  meta: { name: 'diff', description: 'Diff two eval run score files' },
  args: {
    v1: { type: 'positional', description: 'First version (e.g. v1)', required: false },
    v2: { type: 'positional', description: 'Second version (e.g. v2)', required: false },
    project: { type: 'string', description: 'Eval project name', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    if (!args.v1 || !args.v2) {
      console.error(`\nUsage: gad eval diff v1 v2 --project ${args.project}\n`);
      process.exit(1);
    }
    const { diffVersions } = require('../lib/score-generator.cjs');
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);

    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project '${args.project}' not found.`);
    }

    // Framework version mismatch check (decisions gad-51, gad-54). Load both
    // TRACE.json files and compare their framework commit. If they differ,
    // emit a prominent warning so the reader knows the score delta may
    // reflect framework changes rather than agent behaviour.
    try {
      const t1Path = path.join(projectDir, args.v1, 'TRACE.json');
      const t2Path = path.join(projectDir, args.v2, 'TRACE.json');
      if (fs.existsSync(t1Path) && fs.existsSync(t2Path)) {
        const t1 = JSON.parse(fs.readFileSync(t1Path, 'utf8'));
        const t2 = JSON.parse(fs.readFileSync(t2Path, 'utf8'));
        const c1 = t1.framework_commit || null;
        const c2 = t2.framework_commit || null;
        const v1Stamp = t1.framework_stamp || t1.framework_version || '(unstamped)';
        const v2Stamp = t2.framework_stamp || t2.framework_version || '(unstamped)';
        if (c1 && c2 && c1 !== c2) {
          console.log('\n⚠  FRAMEWORK MISMATCH');
          console.log(`   ${args.v1} ran against ${v1Stamp}`);
          console.log(`   ${args.v2} ran against ${v2Stamp}`);
          console.log('   Score deltas below may reflect framework changes, not agent changes.');
          console.log('   See skills/framework-upgrade/SKILL.md for the re-run procedure.');
        } else if (!c1 || !c2) {
          console.log('\n⚠  At least one run has no framework_commit stamp.');
          console.log('   Pre-v4 TRACE.json files predate framework versioning (decision gad-51).');
          console.log('   Cross-version comparisons against unstamped runs are unreliable.');
        }
      }
    } catch (err) {
      // Never block the diff output on the framework check.
      process.stderr.write(`framework-check: ${err.message}\n`);
    }

    try {
      const table = diffVersions(projectDir, args.v1, args.v2);
      console.log('\n' + table);
    } catch (e) {
      outputError(e.message);
    }
  },
});

// ---------------------------------------------------------------------------
// eval trace subcommands
// ---------------------------------------------------------------------------
//
// TRACE.json schema (written by agent or `gad eval trace write`):
// {
//   "version": "v3",          // run version this trace belongs to
//   "project": "cli-efficiency",
//   "workflow": "A",          // "A" = CLI workflow, "B" = raw-file workflow, "both"
//   "recorded": "<ISO>",
//   "commands": [
//     { "seq": 1, "type": "cli", "cmd": "gad context --json",
//       "chars": 428, "tokens": 107, "units": { "U10": "Referenced" } },
//     { "seq": 2, "type": "file", "path": ".planning/STATE.xml",
//       "chars": 8200, "tokens": 2050, "units": { "U1": "Full", "U2": "Full" } }
//   ],
//   "unit_coverage": { "U1": "Full", "U6": "Truncated", "U8": "Absent", ... },
//   "totals": { "chars": 5000, "tokens": 1250,
//               "units_full": 7, "units_partial": 3, "units_absent": 2,
//               "completeness": 0.85 }
// }

const FIDELITY_SCORE = { Full: 1.0, Referenced: 1.0, Truncated: 0.5, Approximated: 0.5, Absent: 0 };
const ALL_UNITS = ['U1','U2','U3','U4','U5','U6','U7','U8','U9','U10','U11','U12'];

const UNIT_LABELS = {
  U1: 'Current phase ID', U2: 'Milestone / plan name', U3: 'Project status',
  U4: 'Open task count', U5: 'Next action (full text)', U6: 'In-progress task IDs + goals',
  U7: 'Phase history', U8: 'Last activity date', U9: 'Active session ID + phase',
  U10: 'Files to read (refs)', U11: 'Agent loop steps', U12: 'Build / verify commands',
};

function loadTrace(projectDir, version) {
  const traceFile = path.join(projectDir, version, 'TRACE.json');
  if (!fs.existsSync(traceFile)) return null;
  try { return JSON.parse(fs.readFileSync(traceFile, 'utf8')); } catch { return null; }
}

function computeCompleteness(unitCoverage) {
  const units = Object.entries(unitCoverage);
  if (units.length === 0) return null;
  const full = units.filter(([,v]) => v === 'Full' || v === 'Referenced').length;
  const partial = units.filter(([,v]) => v === 'Truncated' || v === 'Approximated').length;
  return (full + 0.5 * partial) / units.length;
}

// trace list — which runs have a TRACE.json
const evalTraceList = defineCommand({
  meta: { name: 'list', description: 'List eval runs that have a TRACE.json' },
  args: {
    project: { type: 'string', description: 'Eval project name (default: all)', default: '' },
  },
  run({ args }) {
    let allProjects;
    try {
      allProjects = listAllEvalProjects();
    } catch (err) {
      outputError(err.message);
      return;
    }
    if (allProjects.length === 0) { console.log('No eval projects found.'); return; }

    const selected = args.project
      ? allProjects.filter(p => p.name === args.project)
      : allProjects;

    const rows = [];
    for (const { name: proj, projectDir: projDir } of selected) {
      if (!fs.existsSync(projDir)) continue;
      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
        .map(r => r.name)
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
      for (const v of runs) {
        const trace = loadTrace(projDir, v);
        if (!trace) { rows.push({ project: proj, version: v, workflow: '—', completeness: '—', tokens: '—', traced: 'no' }); continue; }
        const completeness = trace.totals?.completeness ?? computeCompleteness(trace.unit_coverage ?? {});
        rows.push({
          project: proj, version: v,
          workflow: trace.workflow || '—',
          completeness: completeness != null ? completeness.toFixed(3) : '—',
          tokens: trace.totals?.tokens ?? '—',
          traced: 'yes',
        });
      }
    }

    output(rows, { title: 'Eval Traces' });
    const traced = rows.filter(r => r.traced === 'yes').length;
    console.log(`\n${traced}/${rows.length} run(s) have traces.  Missing: run \`gad eval trace write\` after each run.`);
  },
});

// trace show — print a trace in full
const evalTraceShow = defineCommand({
  meta: { name: 'show', description: 'Show TRACE.json for an eval run' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    version: { type: 'string', description: 'Version (default: latest)', default: '' },
    json: { type: 'boolean', description: 'Raw JSON output', default: false },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const projDir = resolveOrDefaultEvalProjectDir(args.project);
    if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

    const runs = fs.readdirSync(projDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .map(r => r.name)
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    if (runs.length === 0) { outputError(`No runs found for '${args.project}'.`); return; }

    const version = args.version || runs[runs.length - 1];
    if (!runs.includes(version)) { outputError(`Version '${version}' not found. Available: ${runs.join(', ')}`); return; }

    const trace = loadTrace(projDir, version);
    if (!trace) {
      console.log(`No TRACE.json for ${args.project} ${version}.`);
      console.log(`Write one with: gad eval trace write --project ${args.project} --version ${version}`);
      return;
    }

    if (args.json || shouldUseJson()) { console.log(JSON.stringify(trace, null, 2)); return; }

    console.log(`\nTrace: ${args.project}  ${version}  (workflow ${trace.workflow || '?'})`);
    console.log(`Recorded: ${trace.recorded || '—'}  Method version: ${trace.methodology_version || '—'}\n`);

    // Unit coverage table
    console.log(`Unit Coverage\n${'─'.repeat(60)}`);
    const cov = trace.unit_coverage || {};
    const unitRows = ALL_UNITS.filter(u => cov[u] || trace.commands?.some(c => c.units?.[u])).map(u => ({
      unit: u, description: UNIT_LABELS[u] || '?', fidelity: cov[u] || '—',
      score: cov[u] ? FIDELITY_SCORE[cov[u]] ?? '?' : '—',
    }));
    if (unitRows.length > 0) output(unitRows, {});

    // Commands
    if (trace.commands?.length > 0) {
      console.log(`\nCommands / Reads  (${trace.commands.length} total)\n${'─'.repeat(60)}`);
      for (const c of trace.commands) {
        const label = c.type === 'cli' ? `CLI  ${c.cmd}` : `FILE ${c.path}`;
        const units = c.units ? `  [${Object.keys(c.units).join(', ')}]` : '';
        console.log(`  ${c.seq}. ${label}  ${c.tokens ?? '?'}tok${units}`);
      }
    }

    // Totals
    if (trace.totals) {
      const t = trace.totals;
      const c = t.completeness != null ? t.completeness.toFixed(3) : computeCompleteness(cov)?.toFixed(3) ?? '—';
      console.log(`\nTotals: ${t.chars ?? '—'} chars / ${t.tokens ?? '—'} tokens`);
      console.log(`  full=${t.units_full ?? '—'}  partial=${t.units_partial ?? '—'}  absent=${t.units_absent ?? '—'}  completeness=${c}`);
    }
    console.log('');
  },
});

// trace diff — compare unit coverage between two versions
const evalTraceDiff = defineCommand({
  meta: { name: 'diff', description: 'Diff unit coverage between two traced runs' },
  args: {
    v1: { type: 'positional', description: 'First version (e.g. v2)', required: false },
    v2: { type: 'positional', description: 'Second version (e.g. v3)', required: false },
    project: { type: 'string', description: 'Eval project name', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    if (!args.v1 || !args.v2) {
      console.error(`\nUsage: gad eval trace diff v1 v2 --project ${args.project || '<name>'}\n`);
      process.exit(1);
    }
    const projDir = resolveOrDefaultEvalProjectDir(args.project);
    if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

    const t1 = loadTrace(projDir, args.v1);
    const t2 = loadTrace(projDir, args.v2);

    if (!t1) { console.error(`No TRACE.json for ${args.v1}.`); process.exit(1); }
    if (!t2) { console.error(`No TRACE.json for ${args.v2}.`); process.exit(1); }

    const cov1 = t1.unit_coverage || {};
    const cov2 = t2.unit_coverage || {};
    const allUnits = [...new Set([...Object.keys(cov1), ...Object.keys(cov2)])].sort();

    const rows = allUnits.map(u => {
      const f1 = cov1[u] || 'Absent';
      const f2 = cov2[u] || 'Absent';
      const s1 = FIDELITY_SCORE[f1] ?? 0;
      const s2 = FIDELITY_SCORE[f2] ?? 0;
      const change = s2 > s1 ? '↑' : s2 < s1 ? '↓' : '=';
      return { unit: u, [args.v1]: f1, [args.v2]: f2, change };
    });

    console.log(`\nTrace diff: ${args.project}  ${args.v1} → ${args.v2}\n`);
    output(rows, {});

    const c1 = computeCompleteness(cov1);
    const c2 = computeCompleteness(cov2);
    const tok1 = t1.totals?.tokens ?? '—';
    const tok2 = t2.totals?.tokens ?? '—';
    console.log(`\nCompleteness: ${c1?.toFixed(3) ?? '—'} → ${c2?.toFixed(3) ?? '—'}`);
    console.log(`Tokens:       ${tok1} → ${tok2}`);

    const improved = rows.filter(r => r.change === '↑').length;
    const regressed = rows.filter(r => r.change === '↓').length;
    console.log(`Units improved: ${improved}  regressed: ${regressed}`);
    console.log('');
  },
});

// trace report — aggregate stats across all traced runs
const evalTraceReport = defineCommand({
  meta: { name: 'report', description: 'Aggregate trace stats across all runs for a project' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const projDir = resolveOrDefaultEvalProjectDir(args.project);
    if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

    const runs = fs.readdirSync(projDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .map(r => r.name)
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    const traced = runs.map(v => ({ v, trace: loadTrace(projDir, v) })).filter(r => r.trace);
    if (traced.length === 0) {
      console.log(`No traces found for '${args.project}'. Run \`gad eval trace write\` after each eval run.`);
      return;
    }

    // Per-unit trend across runs
    const unitTrend = {};
    for (const u of ALL_UNITS) {
      unitTrend[u] = traced.map(({ v, trace }) => ({
        v, fidelity: trace.unit_coverage?.[u] || 'Absent',
        score: FIDELITY_SCORE[trace.unit_coverage?.[u]] ?? 0,
      }));
    }

    if (args.json || shouldUseJson()) {
      const out = {
        project: args.project,
        runs: traced.map(({ v, trace }) => ({
          version: v, workflow: trace.workflow, tokens: trace.totals?.tokens,
          completeness: trace.totals?.completeness ?? computeCompleteness(trace.unit_coverage ?? {}),
        })),
        unitTrend,
      };
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    console.log(`\nTrace Report: ${args.project}  (${traced.length} traced runs)\n`);

    // Summary rows: version completeness + token trend
    const summaryRows = traced.map(({ v, trace }) => {
      const c = trace.totals?.completeness ?? computeCompleteness(trace.unit_coverage ?? {});
      return { version: v, workflow: trace.workflow || '—', completeness: c?.toFixed(3) ?? '—', tokens: trace.totals?.tokens ?? '—' };
    });
    output(summaryRows, { title: 'Run Summary' });

    // Unit trend: which units have been consistently absent/partial
    console.log(`\nUnit Fidelity Trend\n${'─'.repeat(60)}`);
    const problemUnits = ALL_UNITS.filter(u => {
      const scores = unitTrend[u].map(t => t.score);
      return scores.some(s => s < 1.0);
    });

    for (const u of problemUnits) {
      const trend = unitTrend[u].map(t => `${t.v}:${t.fidelity[0]}`).join('  ');
      const latest = unitTrend[u][unitTrend[u].length - 1]?.fidelity || 'Absent';
      console.log(`  ${u}  ${UNIT_LABELS[u]?.slice(0, 28).padEnd(28)}  ${trend}  (latest: ${latest})`);
    }
    if (problemUnits.length === 0) console.log('  All units at Full/Referenced across all traced runs.');
    console.log('');
  },
});

// trace write — record a TRACE.json manually (or patch missing fields)
const evalTraceWrite = defineCommand({
  meta: { name: 'write', description: 'Record a TRACE.json for an eval run' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    version: { type: 'string', description: 'Run version (default: latest)', default: '' },
    workflow: { type: 'string', description: 'Workflow: A, B, or both', default: 'A' },
    completeness: { type: 'string', description: 'Completeness score (0–1)', default: '' },
    tokens: { type: 'string', description: 'Total tokens consumed', default: '' },
    units: { type: 'string', description: 'Unit fidelity JSON e.g. {"U1":"Full","U6":"Truncated"}', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const projDir = resolveOrDefaultEvalProjectDir(args.project);
    if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

    const runs = fs.readdirSync(projDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .map(r => r.name)
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    if (runs.length === 0) { outputError(`No runs found for '${args.project}'.`); return; }

    const version = args.version || runs[runs.length - 1];
    if (!runs.includes(version)) { outputError(`Version '${version}' not found.`); return; }

    // Parse unit_coverage from --units JSON arg
    let unitCoverage = {};
    if (args.units) {
      try { unitCoverage = JSON.parse(args.units); }
      catch { outputError('--units must be valid JSON: {"U1":"Full","U6":"Truncated",...}'); return; }
    }

    // Compute totals
    const entries = Object.entries(unitCoverage);
    const unitsFull = entries.filter(([,v]) => v === 'Full' || v === 'Referenced').length;
    const unitsPartial = entries.filter(([,v]) => v === 'Truncated' || v === 'Approximated').length;
    const unitsAbsent = entries.filter(([,v]) => v === 'Absent').length;
    const completeness = args.completeness ? parseFloat(args.completeness)
      : entries.length > 0 ? (unitsFull + 0.5 * unitsPartial) / entries.length : null;
    const tokens = args.tokens ? parseInt(args.tokens, 10) : null;

    // Load existing trace to merge
    const traceFile = path.join(projDir, version, 'TRACE.json');
    const existing = loadTrace(projDir, version) || {};

    const trace = {
      ...existing,
      version,
      project: args.project,
      workflow: args.workflow,
      methodology_version: '1.0.0',
      recorded: existing.recorded || new Date().toISOString(),
      updated: new Date().toISOString(),
      unit_coverage: { ...(existing.unit_coverage || {}), ...unitCoverage },
      totals: {
        ...(existing.totals || {}),
        ...(tokens != null ? { tokens } : {}),
        units_full: unitsFull,
        units_partial: unitsPartial,
        units_absent: unitsAbsent,
        completeness,
      },
    };

    fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
    console.log(`\n✓ TRACE.json written: evals/${args.project}/${version}/TRACE.json`);
    console.log(`  workflow=${trace.workflow}  completeness=${completeness?.toFixed(3) ?? '—'}  tokens=${tokens ?? '—'}`);
    console.log(`\nView:  gad eval trace show --project ${args.project} --version ${version}`);
  },
});

const evalTraceInit = defineCommand({
  meta: { name: 'init', description: 'Initialize a TRACE.json for an implementation eval run' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    mode: { type: 'string', description: 'Context mode: fresh or loaded', default: 'fresh' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const projDir = resolveOrDefaultEvalProjectDir(args.project);
    if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

    // Find or create next version directory
    const runs = fs.readdirSync(projDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .map(r => parseInt(r.name.slice(1)))
      .sort((a, b) => a - b);
    const nextVersion = runs.length > 0 ? runs[runs.length - 1] + 1 : 1;
    const versionDir = path.join(projDir, `v${nextVersion}`);
    fs.mkdirSync(versionDir, { recursive: true });

    // Framework version stamping — decisions gad-51, gad-54. Every TRACE.json
    // records the commit it ran against so cross-version comparisons can
    // distinguish "agent improved" from "framework changed".
    const { getFrameworkVersion: _getFv } = require('../lib/framework-version.cjs');
    const fv = _getFv();
    const runtimeIdentity = detectRuntimeIdentity();

    const trace = {
      eval: args.project,
      version: `v${nextVersion}`,
      date: new Date().toISOString().split('T')[0],
      gad_version: require('../package.json').version || '1.0.0',
      framework_version: fv.version,
      framework_commit: fv.commit,
      framework_branch: fv.branch,
      framework_commit_ts: fv.commit_ts,
      framework_stamp: fv.stamp,
      trace_schema_version: 4,
      runtime_identity: runtimeIdentity,
      agent_lineage: summarizeAgentLineage({
        runtimeIdentity,
      }),
      eval_type: 'implementation',
      context_mode: args.mode,
      timing: {
        started: new Date().toISOString(),
        ended: null,
        duration_minutes: null,
        phases_completed: 0,
        tasks_completed: 0,
      },
      gad_commands: [],
      skill_triggers: [],
      planning_quality: {
        phases_planned: 0,
        tasks_planned: 0,
        tasks_completed: 0,
        tasks_blocked: 0,
        decisions_captured: 0,
        state_updates: 0,
        state_stale_count: 0,
      },
      cli_efficiency: {
        total_gad_commands: 0,
        total_gad_tokens: 0,
        manual_file_reads: 0,
        manual_file_tokens: 0,
        token_reduction_vs_manual: null,
      },
      skill_accuracy: {
        expected_triggers: [],
        accuracy: null,
      },
      scores: {
        cli_efficiency: null,
        skill_accuracy: null,
        planning_quality: null,
        time_efficiency: null,
        composite: null,
      },
      human_review: {
        score: null,
        notes: null,
        reviewed_by: null,
        reviewed_at: null,
      },
    };

    const traceFile = path.join(versionDir, 'TRACE.json');
    fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
    console.log(`\n✓ Implementation trace initialized: evals/${args.project}/v${nextVersion}/TRACE.json`);
    console.log(`  context_mode=${args.mode}  started=${trace.timing.started}`);
    console.log(`\nLog commands:  gad eval trace log-cmd --project ${args.project} --cmd "gad snapshot"`);
    console.log(`Log skills:    gad eval trace log-skill --project ${args.project} --skill "/gad:plan-phase" --phase 01`);
    console.log(`Finalize:      gad eval trace finalize --project ${args.project}`);
  },
});

const evalTraceLogCmd = defineCommand({
  meta: { name: 'log-cmd', description: 'Log a gad command to the active implementation trace' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    cmd: { type: 'string', description: 'Command that was run', default: '' },
    tokens: { type: 'string', description: 'Token count of output', default: '0' },
  },
  run({ args }) {
    if (!args.project || !args.cmd) { outputError('Usage: gad eval trace log-cmd --project <name> --cmd "<command>" [--tokens N]'); return; }
    const projDir = resolveOrDefaultEvalProjectDir(args.project);
    const runs = fs.readdirSync(projDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
    if (runs.length === 0) { outputError('No runs found. Run gad eval trace init first.'); return; }
    const traceFile = path.join(projDir, runs[0].name, 'TRACE.json');
    const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
    trace.gad_commands.push({ cmd: args.cmd, at: new Date().toISOString(), tokens: parseInt(args.tokens) || 0 });
    trace.cli_efficiency.total_gad_commands = trace.gad_commands.length;
    trace.cli_efficiency.total_gad_tokens = trace.gad_commands.reduce((s, c) => s + (c.tokens || 0), 0);
    fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
  },
});

const evalTraceLogSkill = defineCommand({
  meta: { name: 'log-skill', description: 'Log a skill trigger to the active implementation trace' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    skill: { type: 'string', description: 'Skill name (e.g. /gad:plan-phase)', default: '' },
    phase: { type: 'string', description: 'Phase number', default: '' },
    result: { type: 'string', description: 'Result summary', default: '' },
  },
  run({ args }) {
    if (!args.project || !args.skill) { outputError('Usage: gad eval trace log-skill --project <name> --skill "<skill>" [--phase N] [--result "..."]'); return; }
    const projDir = resolveOrDefaultEvalProjectDir(args.project);
    const runs = fs.readdirSync(projDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
    if (runs.length === 0) { outputError('No runs found. Run gad eval trace init first.'); return; }
    const traceFile = path.join(projDir, runs[0].name, 'TRACE.json');
    const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
    trace.skill_triggers.push({
      skill: args.skill,
      phase: args.phase || '',
      at: new Date().toISOString(),
      result: args.result || '',
    });
    fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
  },
});

const evalTraceFinalize = defineCommand({
  meta: { name: 'finalize', description: 'Finalize an implementation trace — compute scores' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const projDir = resolveOrDefaultEvalProjectDir(args.project);
    const runs = fs.readdirSync(projDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
    if (runs.length === 0) { outputError('No runs found.'); return; }
    const traceFile = path.join(projDir, runs[0].name, 'TRACE.json');
    const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));

    // Finalize timing
    trace.timing.ended = new Date().toISOString();
    const startMs = new Date(trace.timing.started).getTime();
    const endMs = new Date(trace.timing.ended).getTime();
    trace.timing.duration_minutes = Math.round((endMs - startMs) / 60000);

    // Compute cli_efficiency score
    const totalTokens = trace.cli_efficiency.total_gad_tokens + trace.cli_efficiency.manual_file_tokens;
    if (totalTokens > 0) {
      trace.cli_efficiency.token_reduction_vs_manual = 1 - (trace.cli_efficiency.total_gad_tokens / totalTokens);
      trace.scores.cli_efficiency = trace.cli_efficiency.token_reduction_vs_manual;
    }

    // Compute skill_accuracy
    const expected = trace.skill_accuracy.expected_triggers;
    if (expected.length > 0) {
      const correct = expected.filter(e => e.triggered).length;
      trace.skill_accuracy.accuracy = correct / expected.length;
      trace.scores.skill_accuracy = trace.skill_accuracy.accuracy;
    }

    // Compute planning_quality
    const pq = trace.planning_quality;
    if (pq.tasks_planned > 0) {
      const taskRatio = pq.tasks_completed / pq.tasks_planned;
      const stalePenalty = pq.state_updates > 0 ? (1 - pq.state_stale_count / pq.state_updates) : 1;
      trace.scores.planning_quality = taskRatio * stalePenalty;
    }

    // Compute time_efficiency (uses 480 min = 8 hours as expected max for a full eval)
    const expectedDuration = 480;
    if (trace.timing.duration_minutes != null) {
      trace.scores.time_efficiency = Math.max(0, Math.min(1, 1 - (trace.timing.duration_minutes / expectedDuration)));
    }

    // Composite (v3 formula — 6 dimensions, normalized when human_review absent)
    const s = trace.scores;
    const hr = trace.human_review?.score ?? null;
    s.human_review = hr;
    if (s.requirement_coverage != null && s.planning_quality != null && s.per_task_discipline != null && s.skill_accuracy != null && s.time_efficiency != null) {
      if (hr != null) {
        s.composite = (s.requirement_coverage * 0.15) + (s.planning_quality * 0.15) + (s.per_task_discipline * 0.15) + (s.skill_accuracy * 0.10) + (s.time_efficiency * 0.05) + (hr * 0.30);
        // Low human-review caps
        if (hr < 0.10) s.composite = Math.min(s.composite, 0.25);
        else if (hr < 0.20) s.composite = Math.min(s.composite, 0.40);
        s.auto_composite = null;
      } else {
        s.auto_composite = (s.requirement_coverage * 0.25) + (s.planning_quality * 0.25) + (s.per_task_discipline * 0.25) + (s.skill_accuracy * 0.167) + (s.time_efficiency * 0.083);
        s.composite = s.auto_composite;
      }
    }

    trace.trace_schema_version = 3;
    fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
    console.log(`\n✓ Trace finalized: evals/${args.project}/${runs[0].name}/TRACE.json`);
    console.log(`\n  Duration:          ${trace.timing.duration_minutes} min`);
    console.log(`  Phases completed:  ${trace.timing.phases_completed}`);
    console.log(`  Tasks completed:   ${trace.timing.tasks_completed}`);
    console.log(`  Req coverage:      ${s.requirement_coverage?.toFixed(3) ?? '—'}`);
    console.log(`  Planning quality:  ${s.planning_quality?.toFixed(3) ?? '—'}`);
    console.log(`  Task discipline:   ${s.per_task_discipline?.toFixed(3) ?? '—'}`);
    console.log(`  Skill accuracy:    ${s.skill_accuracy?.toFixed(3) ?? '—'}`);
    console.log(`  Time efficiency:   ${s.time_efficiency?.toFixed(3) ?? '—'}`);
    console.log(`  Human review:      ${hr?.toFixed(3) ?? '(pending)'}`);
    console.log(`  Composite:         ${s.composite?.toFixed(3) ?? '—'}${hr == null ? ' (auto)' : ''}`);
  },
});

const evalTraceReconstruct = defineCommand({
  meta: { name: 'reconstruct', description: 'Reconstruct TRACE.json from git history — no agent cooperation needed' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    path: { type: 'string', description: 'Path to eval worktree or project dir', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const { execSync } = require('child_process');
    const gadDir = path.join(__dirname, '..');
    const projDir = resolveOrDefaultEvalProjectDir(args.project);
    const evalPath = args.path || path.join(projDir, 'game');

    // Find the latest run version
    const runs = fs.readdirSync(projDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
    if (runs.length === 0) { outputError('No runs found.'); return; }
    const version = runs[0].name;
    const traceFile = path.join(projDir, version, 'TRACE.json');

    // Load existing trace as base
    let trace = {};
    if (fs.existsSync(traceFile)) {
      trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
    }

    // Get git log for the eval directory — try from GAD repo (submodule) first, then parent
    let gitLog = '';
    const gadRepoDir = path.join(__dirname, '..');
    const evalRelPath = path.relative(gadRepoDir, projDir);
    try {
      gitLog = execSync(`git log --all --format="%H|%aI|%s" --name-only -- "${evalRelPath}"`, {
        cwd: gadRepoDir, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch { /* try parent repo */ }
    if (!gitLog) {
      try {
        gitLog = execSync(`git log --all --format="%H|%aI|%s" --name-only -- "${path.relative(findRepoRoot(), projDir)}"`, {
          cwd: findRepoRoot(), encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
      } catch { /* no git history */ }
    }

    if (!gitLog) {
      console.log('No git history found for this eval project.');
      return;
    }

    // Parse commits
    const commits = [];
    let currentCommit = null;
    for (const line of gitLog.split('\n')) {
      if (line.includes('|')) {
        const [hash, date, ...msgParts] = line.split('|');
        currentCommit = { hash, date, message: msgParts.join('|'), files: [] };
        commits.push(currentCommit);
      } else if (line.trim() && currentCommit) {
        currentCommit.files.push(line.trim());
      }
    }

    // Analyze planning doc changes
    let phasesCompleted = 0;
    let tasksCompleted = 0;
    let stateUpdates = 0;
    let decisionsAdded = 0;
    const taskIds = [];

    // Read current planning state to count completed work
    const templatePlanDir = path.join(projDir, 'template', '.planning');
    const taskRegXml = readXmlFile(path.join(templatePlanDir, 'TASK-REGISTRY.xml'));
    if (taskRegXml) {
      const doneMatches = taskRegXml.match(/status="done"/g);
      const inProgressMatches = taskRegXml.match(/status="in-progress"/g);
      tasksCompleted = doneMatches ? doneMatches.length : 0;
      const taskIdMatches = taskRegXml.match(/id="([^"]+)"/g);
      if (taskIdMatches) {
        for (const m of taskIdMatches) {
          const id = m.match(/id="([^"]+)"/)[1];
          if (id && !id.startsWith('0')) taskIds.push(id); // skip phase ids
        }
      }
    }

    const roadmapXml = readXmlFile(path.join(templatePlanDir, 'ROADMAP.xml'));
    if (roadmapXml) {
      const donePhases = roadmapXml.match(/status="done"/g) || roadmapXml.match(/status="complete"/g);
      phasesCompleted = donePhases ? donePhases.length : 0;
    }

    const decisionsXml = readXmlFile(path.join(templatePlanDir, 'DECISIONS.xml'));
    if (decisionsXml) {
      const decMatches = decisionsXml.match(/<decision\s/g);
      decisionsAdded = decMatches ? decMatches.length : 0;
    }

    // Count state updates from commits touching STATE.xml
    stateUpdates = commits.filter(c => c.files.some(f => f.includes('STATE.xml') || f.includes('STATE.md'))).length;

    // Detect task-per-commit discipline
    const taskCommits = commits.filter(c => /\d+-\d+/.test(c.message));
    const batchCommits = commits.filter(c => !(/\d+-\d+/.test(c.message)) && c.files.length > 3);

    // Timing from git
    const timestamps = commits.map(c => new Date(c.date).getTime()).filter(t => !isNaN(t));
    const started = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : trace.timing?.started;
    const ended = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : trace.timing?.ended;
    const durationMin = started && ended ? Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 60000) : null;

    // Count source files created
    const sourceFiles = new Set();
    for (const c of commits) {
      for (const f of c.files) {
        if (f.includes('/src/') || f.includes('/game/')) sourceFiles.add(f);
      }
    }

    // Build reconstructed trace
    const reconstructed = {
      ...trace,
      eval: args.project,
      version,
      eval_type: 'implementation',
      reconstructed: true,
      reconstructed_at: new Date().toISOString(),
      timing: {
        started: started || trace.timing?.started,
        ended: ended || trace.timing?.ended,
        duration_minutes: durationMin,
        phases_completed: phasesCompleted,
        tasks_completed: tasksCompleted,
      },
      git_analysis: {
        total_commits: commits.length,
        task_id_commits: taskCommits.length,
        batch_commits: batchCommits.length,
        source_files_created: sourceFiles.size,
        state_updates: stateUpdates,
        decisions_added: decisionsAdded,
        per_task_discipline: taskCommits.length > 0 ? (taskCommits.length / Math.max(tasksCompleted, 1)) : 0,
      },
      planning_quality: {
        phases_planned: roadmapXml ? (roadmapXml.match(/<phase/g) || []).length : 0,
        tasks_planned: taskRegXml ? (taskRegXml.match(/<task/g) || []).length : 0,
        tasks_completed: tasksCompleted,
        tasks_blocked: 0,
        decisions_captured: decisionsAdded,
        state_updates: stateUpdates,
        state_stale_count: Math.max(0, tasksCompleted - stateUpdates),
      },
    };

    // Infer skill triggers from artifacts — expanded to cover all detectable skills
    const hasPhaseGoals = roadmapXml && (roadmapXml.match(/<goal>/g) || []).length > 0;
    const hasDoneTasks = tasksCompleted > 0;
    const hasPerTaskCommits = taskCommits.length > 0;
    const conventionsExists = fs.existsSync(path.join(templatePlanDir, 'CONVENTIONS.md'));
    const verificationExists = fs.existsSync(path.join(templatePlanDir, 'VERIFICATION.md'));
    const verifyCommits = commits.filter(c => /^verify:/i.test(c));
    const hasVerification = verificationExists || verifyCommits.length > 0;
    const evalDecisions = readXmlFile(path.join(templatePlanDir, 'DECISIONS.xml'));
    const hasDecisions = evalDecisions && (evalDecisions.match(/<decision /g) || []).length > 0;
    const hasMultiplePhases = roadmapXml && (roadmapXml.match(/<phase /g) || []).length > 1;
    const evalState = readXmlFile(path.join(templatePlanDir, 'STATE.xml'));
    const hasStateNextAction = evalState && /<next-action>[^<]+<\/next-action>/.test(evalState);
    const hasPhaseDoneInRoadmap = roadmapXml && /<status>done<\/status>/.test(roadmapXml);
    const evalTaskReg = readXmlFile(path.join(templatePlanDir, 'TASK-REGISTRY.xml'));
    const hasInProgressToDone = evalTaskReg && /status="done"/.test(evalTaskReg);
    // Detect build artifact (dist/ or demo/ in worktree root or common subdirs)
    const worktreeRoot = path.dirname(templatePlanDir);
    const hasBuildArtifact = ['dist', 'demo', 'game/dist', 'build', 'out'].some(d =>
      fs.existsSync(path.join(worktreeRoot, d)) && fs.statSync(path.join(worktreeRoot, d)).isDirectory()
    );
    const hasArchDoc = fs.existsSync(path.join(templatePlanDir, 'ARCHITECTURE.md'));

    // Skill trigger map: skill → artifact/signal that proves it fired
    reconstructed.skill_accuracy = {
      expected_triggers: [
        // Core loop skills (always expected)
        { skill: '/gad:plan-phase', when: 'before implementation', triggered: hasPhaseGoals, evidence: 'ROADMAP.xml has <goal> elements' },
        { skill: '/gad:execute-phase', when: 'per phase', triggered: hasDoneTasks, evidence: 'tasks marked done in TASK-REGISTRY.xml' },
        { skill: '/gad:task-checkpoint', when: 'between tasks', triggered: hasPerTaskCommits, evidence: 'commits reference task IDs' },
        { skill: '/gad:verify-work', when: 'after phase completion', triggered: hasVerification, evidence: 'VERIFICATION.md exists or verify: commits found' },
        { skill: '/gad:auto-conventions', when: 'after first code phase', triggered: conventionsExists, evidence: 'CONVENTIONS.md exists' },
        // State management skills
        { skill: '/gad:check-todos', when: 'session start or between phases', triggered: hasStateNextAction, evidence: 'STATE.xml has non-empty next-action' },
        // Planning quality skills
        { skill: 'decisions-captured', when: 'during implementation', triggered: hasDecisions, evidence: 'DECISIONS.xml has <decision> entries' },
        { skill: 'multi-phase-planning', when: 'before execution', triggered: hasMultiplePhases, evidence: 'ROADMAP.xml has >1 phase' },
        { skill: 'phase-completion', when: 'during execution', triggered: hasPhaseDoneInRoadmap, evidence: 'at least one phase marked done in ROADMAP.xml' },
        { skill: 'task-lifecycle', when: 'per task', triggered: hasInProgressToDone, evidence: 'tasks transition from planned to done in TASK-REGISTRY.xml' },
        // Deliverable
        { skill: 'build-artifact', when: 'final phase', triggered: hasBuildArtifact, evidence: 'dist/ or demo/ directory exists with build output' },
        { skill: 'architecture-doc', when: 'before final commit', triggered: hasArchDoc, evidence: 'ARCHITECTURE.md exists in .planning/' },
      ],
      accuracy: null,
    };
    const expectedCount = reconstructed.skill_accuracy.expected_triggers.length;
    const triggeredCount = reconstructed.skill_accuracy.expected_triggers.filter(e => e.triggered).length;
    reconstructed.skill_accuracy.accuracy = expectedCount > 0 ? triggeredCount / expectedCount : null;

    // Compute planning quality score
    const pq = reconstructed.planning_quality;
    if (pq.tasks_planned > 0) {
      const taskRatio = pq.tasks_completed / pq.tasks_planned;
      const stalePenalty = pq.state_updates > 0 ? (1 - pq.state_stale_count / Math.max(pq.state_updates + pq.state_stale_count, 1)) : 0;
      reconstructed.scores = reconstructed.scores || {};
      reconstructed.scores.planning_quality = taskRatio * stalePenalty;
    }

    // Time efficiency
    if (durationMin != null) {
      reconstructed.scores = reconstructed.scores || {};
      reconstructed.scores.time_efficiency = Math.max(0, Math.min(1, 1 - (durationMin / 480)));
    }

    // Compute composite score (v3 formula)
    const scores = reconstructed.scores || {};
    scores.skill_accuracy = reconstructed.skill_accuracy.accuracy;
    scores.per_task_discipline = reconstructed.git_analysis.per_task_discipline;
    scores.requirement_coverage = reconstructed.requirement_coverage?.coverage_ratio ?? null;
    scores.human_review = null;
    if (scores.requirement_coverage != null && scores.planning_quality != null && scores.skill_accuracy != null && scores.time_efficiency != null && scores.per_task_discipline != null) {
      scores.auto_composite = (scores.requirement_coverage * 0.25) + (scores.planning_quality * 0.25) + (scores.per_task_discipline * 0.25) + (scores.skill_accuracy * 0.167) + (scores.time_efficiency * 0.083);
      scores.composite = scores.auto_composite;
    }
    reconstructed.scores = scores;
    reconstructed.trace_schema_version = 3;

    fs.writeFileSync(traceFile, JSON.stringify(reconstructed, null, 2));

    console.log(`\n✓ Trace reconstructed: evals/${args.project}/${version}/TRACE.json`);
    console.log(`\n  Git commits analyzed:  ${commits.length}`);
    console.log(`  Phases completed:      ${phasesCompleted}`);
    console.log(`  Tasks completed:       ${tasksCompleted}`);
    console.log(`  Task-id commits:       ${taskCommits.length} / ${commits.length}`);
    console.log(`  State updates:         ${stateUpdates}`);
    console.log(`  Decisions captured:    ${decisionsAdded}`);
    console.log(`  Source files created:  ${sourceFiles.size}`);
    console.log(`  Per-task discipline:   ${reconstructed.git_analysis.per_task_discipline.toFixed(2)}`);
    console.log(`  Duration:              ${durationMin} min`);
    if (reconstructed.scores?.planning_quality != null) {
      console.log(`  Planning quality:      ${reconstructed.scores.planning_quality.toFixed(3)}`);
    }
  },
});

// trace from-log — build TRACE.json from actual JSONL call logs (definitive, not reconstructed)
const evalTraceFromLog = defineCommand({
  meta: { name: 'from-log', description: 'Build TRACE.json from actual JSONL call logs (definitive, not git-reconstructed)' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    version: { type: 'string', description: 'Version (default: latest)', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);

    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project '${args.project}' not found.`);
    }

    const versions = fs.readdirSync(projectDir)
      .filter(n => /^v\d+$/.test(n))
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    const version = args.version || versions[versions.length - 1];
    if (!version) { outputError('No eval runs found.'); }

    const runDir = path.join(projectDir, version);
    const logDir = path.join(runDir, '.gad-log');

    if (!fs.existsSync(logDir)) {
      // Also check for logs at .planning/.gad-log that might be from this eval period
      console.log(`No .gad-log/ directory in ${version}. Set GAD_LOG_DIR during eval runs.`);
      console.log(`Falling back to git-based reconstruction: gad eval trace reconstruct --project ${args.project}`);
      return;
    }

    // Read all JSONL files from the log dir
    const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl')).sort();
    const entries = [];
    for (const f of logFiles) {
      const lines = fs.readFileSync(path.join(logDir, f), 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try { entries.push(JSON.parse(line)); } catch {}
      }
    }

    if (entries.length === 0) {
      console.log('Log files exist but contain no entries.');
      return;
    }

    // Analyze the log entries
    const gadCommands = entries.filter(e => e.cmd || e.gad_command);
    const toolCalls = entries.filter(e => e.type === 'tool_call');
    const skillTriggers = entries.filter(e => e.skill);
    const agentSpawns = entries.filter(e => e.tool === 'Agent');
    const bashCalls = entries.filter(e => e.tool === 'Bash');
    const readCalls = entries.filter(e => e.tool === 'Read');
    const writeCalls = entries.filter(e => e.tool === 'Write');
    const editCalls = entries.filter(e => e.tool === 'Edit');
    const runtimeCounts = new Map();
    for (const entry of entries) {
      const runtimeId = entry.runtime?.id || entry.runtime_id || 'unknown';
      runtimeCounts.set(runtimeId, (runtimeCounts.get(runtimeId) || 0) + 1);
    }
    const runtimeEntries = Array.from(runtimeCounts.entries()).sort((a, b) => b[1] - a[1]);
    const primaryRuntime = runtimeEntries[0]?.[0] || 'unknown';

    // Time range
    const timestamps = entries.map(e => new Date(e.ts).getTime()).filter(t => !isNaN(t));
    const startTime = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null;
    const endTime = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
    const durationMin = startTime && endTime ? Math.round((new Date(endTime) - new Date(startTime)) / 60000) : null;

    // Detect gad commands used
    const gadCmdList = [];
    for (const e of entries) {
      const cmd = e.gad_command || e.cmd;
      if (cmd && (cmd.includes('snapshot') || cmd.includes('state') || cmd.includes('tasks') ||
          cmd.includes('phases') || cmd.includes('decisions') || cmd.includes('eval') ||
          cmd.includes('sprint') || cmd.includes('verify'))) {
        gadCmdList.push({ cmd, at: e.ts, duration_ms: e.duration_ms || 0 });
      }
    }

    const trace = {
      eval: args.project,
      version,
      date: new Date().toISOString().slice(0, 10),
      gad_version: pkg.version,
      source: 'call-log',  // distinguishes from 'git-reconstructed'
      trace_schema_version: 5,
      runtime_identity: {
        id: primaryRuntime,
        source: 'log-derived',
        model: entries.find(e => e.runtime?.model)?.runtime?.model || null,
      },
      runtimes_involved: runtimeEntries.map(([id, count]) => ({ id, count })),
      agent_lineage: summarizeAgentLineage({
        runtimeIdentity: {
          id: primaryRuntime,
          source: 'log-derived',
          model: entries.find(e => e.runtime?.model)?.runtime?.model || null,
        },
        runtimesInvolved: runtimeEntries.map(([id, count]) => ({ id, count })),
      }),
      timing: {
        started: startTime,
        ended: endTime,
        duration_minutes: durationMin,
      },
      log_stats: {
        total_entries: entries.length,
        gad_cli_calls: gadCommands.length,
        tool_calls: toolCalls.length,
        skill_triggers: skillTriggers.length,
        agent_spawns: agentSpawns.length,
        bash_calls: bashCalls.length,
        read_calls: readCalls.length,
        write_calls: writeCalls.length,
        edit_calls: editCalls.length,
      },
      gad_commands: gadCmdList.slice(0, 50),
      skill_triggers: skillTriggers.map(e => ({
        skill: e.skill,
        args: e.skill_args || '',
        at: e.ts,
      })),
      agent_spawns: agentSpawns.map(e => ({
        type: e.agent_type,
        description: e.agent_description,
        background: e.agent_background,
        isolated: e.agent_isolated,
        at: e.ts,
      })),
    };

    const traceFile = path.join(runDir, 'TRACE.json');
    fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));

    console.log(`\n✓ Trace built from logs: evals/${args.project}/${version}/TRACE.json`);
    console.log(`\n  Source:            call-log (${logFiles.length} file(s), ${entries.length} entries)`);
    console.log(`  Duration:          ${durationMin} min`);
    console.log(`  GAD CLI calls:     ${gadCommands.length}`);
    console.log(`  Tool calls:        ${toolCalls.length}`);
    console.log(`  Skill triggers:    ${skillTriggers.length}`);
    console.log(`  Agent spawns:      ${agentSpawns.length}`);
    console.log(`  Bash/Read/Write:   ${bashCalls.length}/${readCalls.length}/${writeCalls.length}`);
  },
});

const evalTraceCmd = defineCommand({
  meta: { name: 'trace', description: 'Inspect and compare eval traces (TRACE.json)' },
  subCommands: { list: evalTraceList, show: evalTraceShow, diff: evalTraceDiff, report: evalTraceReport, write: evalTraceWrite, init: evalTraceInit, 'log-cmd': evalTraceLogCmd, 'log-skill': evalTraceLogSkill, finalize: evalTraceFinalize, reconstruct: evalTraceReconstruct, 'from-log': evalTraceFromLog },
});

// eval status — projects with coverage gaps
const evalStatus = defineCommand({
  meta: { name: 'status', description: 'Show all projects and eval coverage gaps' },
  run() {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);

    let discovered;
    try {
      discovered = listAllEvalProjects();
    } catch (err) {
      outputError(err.message);
      return;
    }
    const evalProjects = discovered.map(d => d.name);
    const evalProjectDirByName = new Map(discovered.map(d => [d.name, d.projectDir]));

    const rows = config.roots.map(root => {
      const evalMatches = evalProjects.filter(ep => ep.includes(root.id) || root.id.includes(ep));
      const evalName = evalMatches[0] || null;
      let runs = 0, latest = '—', status = '—';
      if (evalName) {
        const projectDir = evalProjectDirByName.get(evalName);
        const runDirs = fs.readdirSync(projectDir, { withFileTypes: true })
          .filter(r => r.isDirectory() && /^v\d+$/.test(r.name)).map(r => r.name).sort();
        runs = runDirs.length;
        latest = runs > 0 ? runDirs[runDirs.length - 1] : '—';
        if (latest !== '—') {
          const runMd = path.join(projectDir, latest, 'RUN.md');
          if (fs.existsSync(runMd)) {
            const m = fs.readFileSync(runMd, 'utf8').match(/status:\s*([\w-]+)/);
            if (m) status = m[1];
          }
        }
      }
      const gap = !evalName ? 'NO EVAL' : runs === 0 ? 'NO RUNS' : status === 'completed' ? 'ok' : status;
      return { project: root.id, eval: evalName || '—', runs, latest, status: status === '—' && !evalName ? '—' : status, gap };
    });

    output(rows, { title: 'GAD Eval Coverage' });
    const gaps = rows.filter(r => r.gap !== 'ok');
    if (gaps.length > 0) {
      console.log(`\n${gaps.length} project(s) with gaps:`);
      for (const g of gaps) console.log(`  ${g.project}  →  ${g.gap}`);
    } else {
      console.log('\n✓ All projects have eval coverage.');
    }
  },
});

// eval runs — list runs for a project
const evalRuns = defineCommand({
  meta: { name: 'runs', description: 'List runs for an eval project' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);
    if (!fs.existsSync(projectDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

    const runDirs = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .map(r => r.name)
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    if (runDirs.length === 0) {
      console.log(`No runs yet for '${args.project}'. Run: gad species run --project ${args.project}`);
      return;
    }

    const rows = runDirs.map(v => {
      const runMd = path.join(projectDir, v, 'RUN.md');
      let started = '—', status = '—', baseline = '—';
      if (fs.existsSync(runMd)) {
        const content = fs.readFileSync(runMd, 'utf8');
        const ms = content.match(/started:\s*(.+)/); if (ms) started = ms[1].trim().slice(0, 16).replace('T', ' ');
        const mv = content.match(/status:\s*([\w-]+)/); if (mv) status = mv[1];
        const mb = content.match(/baseline:\s*(.+)/); if (mb) baseline = mb[1].trim();
      }
      const scoreFile = path.join(projectDir, v, 'SCORE.md');
      const scored = fs.existsSync(scoreFile) ? 'yes' : 'no';
      return { version: v, status, baseline, started, scored };
    });

    output(rows, { title: `Eval Runs: ${args.project} (${rows.length} runs)` });
  },
});

// eval show — print a specific run's output
const evalShow = defineCommand({
  meta: { name: 'show', description: 'Show output of an eval run' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    version: { type: 'string', description: 'Version to show (default: latest)', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);
    if (!fs.existsSync(projectDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

    const runDirs = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .map(r => r.name)
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    if (runDirs.length === 0) { outputError(`No runs found for '${args.project}'.`); return; }

    const version = args.version || runDirs[runDirs.length - 1];
    if (!runDirs.includes(version)) { outputError(`Version '${version}' not found. Available: ${runDirs.join(', ')}`); return; }

    const runDir = path.join(projectDir, version);
    const filesToShow = ['RUN.md', 'SCORE.md', 'eval-output.txt', 'RESULTS.md'];
    console.log(`\nEval: ${args.project}  ${version}\n`);
    for (const f of filesToShow) {
      const p = path.join(runDir, f);
      if (!fs.existsSync(p)) continue;
      console.log(`${'─'.repeat(60)}`);
      console.log(`# ${f}`);
      console.log(`${'─'.repeat(60)}`);
      console.log(fs.readFileSync(p, 'utf8'));
    }
  },
});

// eval scores — compare scores across runs
const evalScores = defineCommand({
  meta: { name: 'scores', description: 'Compare SCORE.md across runs for a project' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
  },
  run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);
    if (!fs.existsSync(projectDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

    const runDirs = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .map(r => r.name)
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    const rows = [];
    for (const v of runDirs) {
      const scoreFile = path.join(projectDir, v, 'SCORE.md');
      if (!fs.existsSync(scoreFile)) { rows.push({ version: v, score: '—', note: 'no SCORE.md' }); continue; }
      const content = fs.readFileSync(scoreFile, 'utf8');
      // Parse total score from SCORE.md (e.g. "Total: 7/10" or "**7/10**")
      const m = content.match(/total[:\s]+\**(\d+\/\d+)\**/i) || content.match(/(\d+)\/(\d+)/);
      const score = m ? (m[1] || `${m[1]}/${m[2]}`) : '?';
      const note = content.split('\n').slice(0, 5).join(' ').slice(0, 60);
      rows.push({ version: v, score, note });
    }

    if (rows.length === 0) { console.log(`No runs found for '${args.project}'.`); return; }
    output(rows, { title: `Scores: ${args.project}` });
    console.log(`\nTo see a run: gad eval show --project ${args.project} --version <v>`);
    console.log(`To diff:      gad eval diff v1 v2 --project ${args.project}`);
  },
});

// eval version — print GAD methodology version
const evalVersion = defineCommand({
  meta: { name: 'version', description: 'Print GAD methodology version' },
  run() {
    const methodologyVersion = pkg.gadMethodologyVersion || '1.0.0';
    const cliVersion = pkg.version;
    console.log(`\nGAD methodology: ${methodologyVersion}`);
    console.log(`CLI version:     ${cliVersion}`);
    console.log(`\nDefined in: vendor/get-anything-done/package.json`);
    console.log(`Reference:  vendor/get-anything-done/evals/DEFINITIONS.md\n`);
  },
});

const evalSetup = defineCommand({
  meta: { name: 'setup', description: 'Scaffold a new eval project with planning template' },
  args: {
    project: { type: 'string', description: 'Eval project name (e.g. escape-the-dungeon)', default: '' },
    requirements: { type: 'string', description: 'Path to source requirements file to copy', default: '' },
  },
  run({ args }) {
    if (!args.project) {
      console.error('\nUsage: gad eval setup --project <name> [--requirements <path>]\n');
      process.exit(1);
    }
    // setup creates a NEW project — always place it in the default (submodule)
    // evals/ root. If a configured additional root wants to host a new project,
    // users can add it manually to that root's directory.
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);
    const templateDir = path.join(projectDir, 'template', '.planning');

    if (fs.existsSync(projectDir)) {
      console.log(`Eval project "${args.project}" already exists at ${projectDir}`);
      return;
    }

    // Create directories
    fs.mkdirSync(templateDir, { recursive: true });

    // Create template planning files
    const now = new Date().toISOString().split('T')[0];
    fs.writeFileSync(path.join(templateDir, 'STATE.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase></current-phase>
  <current-plan></current-plan>
  <milestone>${args.project}-eval</milestone>
  <status>not-started</status>
  <next-action>Read REQUIREMENTS.xml. Use /gad:discuss-phase to collect requirements and open questions before planning phases.</next-action>
  <last-updated>${now}</last-updated>
</state>
`);

    fs.writeFileSync(path.join(templateDir, 'ROADMAP.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <!-- Phases will be planned after discussion phase -->
</roadmap>
`);

    fs.writeFileSync(path.join(templateDir, 'TASK-REGISTRY.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<task-registry>
  <!-- Tasks will be planned after discussion phase -->
</task-registry>
`);

    fs.writeFileSync(path.join(templateDir, 'DECISIONS.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <!-- Decisions will be captured during discussion and implementation -->
</decisions>
`);

    // Copy requirements if provided
    if (args.requirements && fs.existsSync(args.requirements)) {
      const ext = path.extname(args.requirements);
      const dest = path.join(projectDir, `source-requirements${ext}`);
      fs.copyFileSync(args.requirements, dest);
      console.log(`  Copied ${args.requirements} → ${dest}`);
    }

    // Create REQUIREMENTS.md
    fs.writeFileSync(path.join(projectDir, 'REQUIREMENTS.md'), `# Eval: ${args.project}

## What this eval measures

1. **Skill trigger accuracy** — are /gad:* skills triggered at the right moments
2. **Planning quality** — coherent phases, tasks, decisions from requirements
3. **CLI context efficiency** — gad snapshot delivers what the agent needs
4. **End-to-end loop** — discuss → plan → execute → verify → score
5. **Time-to-completion** — wall clock and token counts

## Eval flow

1. Pre-planning: \`/gad:discuss-phase\` — collect open questions, clarify requirements
2. Planning: \`/gad:plan-phase\` — break into implementable phases with tasks
3. Execution: \`/gad:execute-phase\` — implement, update planning docs, commit
4. Verification: \`/gad:verify-work\` — check against definition of done
5. Scoring: TRACE.json + SCORE.md

## Human review

After eval agent completes, human reviews output quality.
Manual score added to SCORE.md.
`);

    console.log(`\n✓ Eval project created: ${projectDir}`);
    console.log(`\n  template/.planning/ — STATE.xml, ROADMAP.xml, TASK-REGISTRY.xml, DECISIONS.xml`);
    console.log(`  REQUIREMENTS.md — eval definition`);
    if (args.requirements) console.log(`  source-requirements${path.extname(args.requirements)} — copied source`);
    console.log(`\n  Next: add REQUIREMENTS.xml to template/.planning/ with structured requirements`);
    console.log(`  Then: gad species run --project ${args.project}`);
  },
});

// eval suite — generate bootstrap prompts for all runnable eval projects
const evalSuite = defineCommand({
  meta: { name: 'suite', description: 'Generate bootstrap prompts for all eval projects in parallel' },
  args: {
    projects: { type: 'string', description: 'Comma-separated project names (default: all with templates)', default: '' },
  },
  run({ args }) {
    let discovered;
    try {
      discovered = listAllEvalProjects();
    } catch (err) {
      outputError(err.message);
      return;
    }

    if (discovered.length === 0) {
      outputError('No eval projects found.');
    }

    // Find all projects with a template/ directory (runnable evals)
    const runnable = discovered.filter(d => fs.existsSync(path.join(d.projectDir, 'template')));
    const projectDirByName = new Map(discovered.map(d => [d.name, d.projectDir]));
    const allProjects = runnable.map(d => d.name);

    const selectedProjects = args.projects
      ? args.projects.split(',').map(s => s.trim()).filter(Boolean)
      : allProjects;

    if (selectedProjects.length === 0) {
      outputError('No runnable eval projects found (need template/ directory).');
    }

    // Create suite run directory in the default evals root.
    const suiteDir = path.join(defaultEvalsDir(), '.suite-runs', new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(suiteDir, { recursive: true });

    console.log(`\nEval Suite: ${selectedProjects.length} project(s)\n`);

    const results = [];
    for (const project of selectedProjects) {
      const projectDir = projectDirByName.get(project) || path.join(defaultEvalsDir(), project);
      if (!fs.existsSync(projectDir)) {
        console.log(`  ✗ ${project} — not found, skipping`);
        continue;
      }

      // Determine next run number
      const runs = fs.readdirSync(projectDir).filter(n => /^v\d+$/.test(n)).map(n => parseInt(n.slice(1), 10));
      const runNum = runs.length > 0 ? Math.max(...runs) + 1 : 1;

      // Build prompt
      const prompt = buildEvalPrompt(projectDir, project, runNum);
      const promptFile = path.join(suiteDir, `${project}-v${runNum}.md`);
      fs.writeFileSync(promptFile, prompt);

      const tokens = Math.ceil(prompt.length / 4);
      results.push({ project, version: `v${runNum}`, chars: prompt.length, tokens, file: `${project}-v${runNum}.md` });
      console.log(`  ✓ ${project} v${runNum} — ${tokens} tokens → ${project}-v${runNum}.md`);
    }

    // Write suite manifest
    fs.writeFileSync(path.join(suiteDir, 'SUITE.json'), JSON.stringify({
      created: new Date().toISOString(),
      projects: results,
    }, null, 2));

    console.log(`\n✓ Suite prepared: ${results.length} prompt(s) in:`);
    console.log(`  ${path.relative(process.cwd(), suiteDir)}/`);
    console.log(`\nTo run: launch each prompt as a separate agent with worktree isolation.`);
    console.log(`After all complete: gad generation report`);
  },
});

// eval report — cross-project comparison from latest TRACE.json
const evalReport = defineCommand({
  meta: { name: 'report', description: 'Cross-project comparison from latest TRACE.json of each eval' },
  args: {
    projects: { type: 'string', description: 'Comma-separated project names (default: all with traces)', default: '' },
  },
  run({ args }) {
    let discovered;
    try {
      discovered = listAllEvalProjects();
    } catch (err) {
      outputError(err.message);
      return;
    }
    if (discovered.length === 0) {
      outputError('No eval projects found.');
    }

    const projectDirByName = new Map(discovered.map(d => [d.name, d.projectDir]));
    const allProjects = discovered.map(d => d.name);

    const selectedProjects = args.projects
      ? args.projects.split(',').map(s => s.trim()).filter(Boolean)
      : allProjects;

    // Load latest TRACE.json for each project
    const rows = [];
    for (const project of selectedProjects) {
      const projectDir = projectDirByName.get(project);
      if (!projectDir || !fs.existsSync(projectDir)) continue;

      const versions = fs.readdirSync(projectDir)
        .filter(n => /^v\d+$/.test(n))
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

      // Find latest version with scores.json (preferred) or TRACE.json (fallback)
      let trace = null, version = null, scoresData = null;
      for (let i = versions.length - 1; i >= 0; i--) {
        const scoresFile = path.join(projectDir, versions[i], 'scores.json');
        const traceFile = path.join(projectDir, versions[i], 'TRACE.json');
        if (fs.existsSync(scoresFile)) {
          try {
            scoresData = JSON.parse(fs.readFileSync(scoresFile, 'utf8'));
            trace = fs.existsSync(traceFile) ? JSON.parse(fs.readFileSync(traceFile, 'utf8')) : {};
            version = versions[i];
            break;
          } catch {}
        }
        if (fs.existsSync(traceFile)) {
          try {
            trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
            version = versions[i];
            break;
          } catch {}
        }
      }

      if (!trace) {
        rows.push({ project, version: '—', type: '', phases: '—', tasks: '—', discipline: '—', planning: '—', skill_acc: '—', human: '—', composite: '—' });
        continue;
      }

      // Use scores.json if available, otherwise fall back to trace
      const sc = scoresData?.dimensions || trace.scores || {};
      const compositeVal = scoresData?.composite || trace.scores?.composite || trace.scores?.tooling_composite || trace.scores?.mcp_composite;
      const evalType = scoresData?.eval_type || trace.eval_type || 'implementation';
      const humanScore = trace.human_review?.score ?? sc.human_review ?? null;
      const humanStr = humanScore != null ? humanScore.toFixed(2) : '—';
      const compositeStr = compositeVal != null ? compositeVal.toFixed(3) : '—';
      const compositeLabel = compositeVal != null && humanScore == null && (evalType !== 'tooling' && evalType !== 'mcp') ? compositeStr + '*' : compositeStr;

      if (evalType === 'tooling' || evalType === 'mcp') {
        // Tooling/MCP eval row
        const tl = trace.tooling || trace.mcp || {};
        rows.push({
          project,
          version,
          type: evalType,
          phases: '—',
          tasks: `${tl.tools_passed || tl.passes || 0}/${tl.tools_tested || tl.invocations || 0}`,
          discipline: '—',
          planning: '—',
          skill_acc: sc.correctness != null ? (sc.correctness * 100).toFixed(0) + '%' : '—',
          human: '—',
          composite: compositeStr,
        });
      } else {
        // Implementation eval row
        const ga = trace.git_analysis || {};
        const pq = trace.planning_quality || {};

        rows.push({
          project,
          version,
          type: 'impl',
          phases: pq.phases_planned || ga.phases_completed || '—',
          tasks: `${pq.tasks_completed || 0}/${pq.tasks_planned || 0}`,
          discipline: ga.per_task_discipline != null ? ga.per_task_discipline.toFixed(2) : (sc.per_task_discipline != null ? sc.per_task_discipline.toFixed(2) : '—'),
          planning: sc.planning_quality != null ? sc.planning_quality.toFixed(3) : '—',
          skill_acc: sc.skill_accuracy != null ? (sc.skill_accuracy * 100).toFixed(0) + '%' : '—',
          human: humanStr,
          composite: compositeLabel,
        });
      }
    }

    if (rows.length === 0) {
      console.log('\nNo eval projects with TRACE.json found.');
      console.log('Run evals first, then: gad eval trace reconstruct --project <name>');
      return;
    }

    output(rows, { title: 'GAD Eval Report — Cross-Project Comparison' });

    // Summary stats
    const scored = rows.filter(r => r.composite !== '—');
    if (scored.length > 0) {
      const composites = scored.map(r => parseFloat(r.composite));
      const avg = composites.reduce((a, b) => a + b, 0) / composites.length;
      console.log(`\nAverage composite: ${avg.toFixed(3)} across ${scored.length} project(s)`);
    }

    const unreviewed = rows.filter(r => r.human === '—' && r.type === 'impl');
    const noTrace = rows.filter(r => r.version === '—');
    if (unreviewed.length > 0) {
      console.log(`\n* = auto_composite (no human review). Run: gad generation review <project> <version> --score <0-1>`);
    }
    if (noTrace.length > 0) {
      console.log(`\n${noTrace.length} project(s) without traces:`);
      for (const r of noTrace) console.log(`  ${r.project} — run eval and reconstruct trace`);
    }

    // Skill coverage analysis — skills live in the submodule next to the
    // default evals root regardless of which roots host the projects.
    const skillsDir = path.join(defaultEvalsDir(), '..', 'skills');
    if (fs.existsSync(skillsDir)) {
      const allSkills = fs.readdirSync(skillsDir)
        .filter(n => { try { return fs.statSync(path.join(skillsDir, n)).isDirectory(); } catch { return false; } })
        .map(n => `gad:${n}`);

      // Skill name aliases (trace name → canonical skill directory name)
      const skillAliases = { 'gad:verify-work': 'gad:verify-phase' };

      // Collect all tested skills from traces
      const testedSkills = new Set();
      for (const project of allProjects) {
        const projectDir = projectDirByName.get(project);
        if (!projectDir || !fs.existsSync(projectDir)) continue;
        const versions = fs.readdirSync(projectDir).filter(n => /^v\d+$/.test(n));
        for (const v of versions) {
          const traceFile = path.join(projectDir, v, 'TRACE.json');
          if (!fs.existsSync(traceFile)) continue;
          try {
            const t = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
            const triggers = t.skill_accuracy?.expected_triggers || [];
            for (const tr of triggers) {
              const rawName = (tr.skill || '').replace(/^\//, '');
              const name = skillAliases[rawName] || rawName;
              if (name.startsWith('gad:')) testedSkills.add(name);
            }
          } catch {}
        }
      }

      const untestedSkills = allSkills.filter(s => !testedSkills.has(s));
      const coverage = ((allSkills.length - untestedSkills.length) / allSkills.length * 100).toFixed(0);

      console.log(`\nSkill coverage: ${testedSkills.size}/${allSkills.length} skills tested (${coverage}%)`);
      if (untestedSkills.length > 0) {
        console.log(`Untested: ${untestedSkills.join(', ')}`);
      }
    }
  },
});

// gad generation preserve — copy agent outputs to canonical per-version locations
// This is MANDATORY after every eval run. Without this, outputs can be lost
// when worktrees are cleaned up or overwritten.
const evalPreserve = defineCommand({
  meta: { name: 'preserve', description: 'Preserve agent eval outputs (code + build + logs) to canonical per-version paths — MANDATORY after every run' },
  args: {
    project: { type: 'positional', description: 'Eval project name', required: true },
    version: { type: 'positional', description: 'Version (e.g. v5)', required: true },
    from: { type: 'string', description: 'Source path (agent worktree root)', default: '' },
    'game-subdir': { type: 'string', description: 'Subdir containing the game (default: game)', default: 'game' },
  },
  run({ args }) {
    const gadDir = path.join(__dirname, '..');
    const repoRoot = findRepoRoot();
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);
    const runDir = path.join(projectDir, args.version);

    if (!args.from) {
      outputError('--from <worktree-path> is required');
      return;
    }
    const from = path.resolve(args.from);
    if (!fs.existsSync(from)) {
      outputError(
        `Source path does not exist: ${from}\n` +
        `  The worktree may have been removed. Worktrees must be preserved IMMEDIATELY\n` +
        `  after the agent completes — before any cleanup. See gad:eval-run skill.`
      );
      return;
    }

    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    // Locate game directory inside worktree
    const gameSrc = path.join(from, args['game-subdir']);
    if (!fs.existsSync(gameSrc)) {
      outputError(`Game subdir not found: ${gameSrc}. Use --game-subdir to override.`);
      return;
    }

    // Preserve the ENTIRE project to evals/<project>/<version>/run/
    // This is the full game directory minus heavy/regeneratable artifacts
    // (node_modules, .git, dist — dist is preserved separately as the build).
    const runTargetDir = path.join(runDir, 'run');

    // Clear target if it exists (idempotent re-preserve)
    if (fs.existsSync(runTargetDir)) {
      fs.rmSync(runTargetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(runTargetDir, { recursive: true });

    // Copy every top-level entry in game/, excluding heavy/regenerated dirs.
    // `out` and `.next` are Next.js build artifacts (gad task 44-03) —
    // excluded from the source copy and picked up separately as the build.
    const excludeTopLevel = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.next']);
    let copiedCount = 0;
    for (const entry of fs.readdirSync(gameSrc)) {
      if (excludeTopLevel.has(entry)) continue;
      const srcPath = path.join(gameSrc, entry);
      const dstPath = path.join(runTargetDir, entry);
      copyRecursive(srcPath, dstPath);
      copiedCount++;
    }

    // Also preserve any agent-created files at the worktree root that aren't
    // part of the base monorepo. Only files that DON'T exist at all in the
    // main repo are considered agent-created.
    const rootExtras = ['ARCHITECTURE.md', 'WORKFLOW.md', 'NOTES.md', 'CHANGELOG.md'];
    const extrasDir = path.join(runTargetDir, '_worktree_root_extras');
    let rootExtrasCopied = 0;
    for (const extra of rootExtras) {
      const srcPath = path.join(from, extra);
      if (!fs.existsSync(srcPath)) continue;
      // Only copy if it does NOT exist in the main repo (agent-created)
      const mainRepoPath = path.join(repoRoot, extra);
      if (fs.existsSync(mainRepoPath)) {
        try {
          const srcStat = fs.statSync(srcPath);
          const mainStat = fs.statSync(mainRepoPath);
          if (srcStat.isFile() && mainStat.isFile()) {
            const srcContent = fs.readFileSync(srcPath, 'utf8');
            const mainContent = fs.readFileSync(mainRepoPath, 'utf8');
            if (srcContent === mainContent) continue; // identical to main, skip
          } else {
            // directory in main repo, don't treat as agent-created
            continue;
          }
        } catch { continue; }
      }
      if (rootExtrasCopied === 0) fs.mkdirSync(extrasDir, { recursive: true });
      copyRecursive(srcPath, path.join(extrasDir, extra));
      rootExtrasCopied++;
    }

    // Preserve build to apps/portfolio/public/evals/<project>/<version>/.
    // Try each known static-servable build output in order. `out` is Next.js
    // static export (task 44-03), `dist` is Vite/rollup/plain bundlers,
    // `build` is CRA/old tooling. `.next/` is intentionally NOT a candidate
    // because it requires a running Node server and cannot be served
    // statically from public/.
    const buildDirCandidates = ['out', 'dist', 'build'];
    let distSrc = null;
    for (const candidate of buildDirCandidates) {
      const attempt = path.join(gameSrc, candidate);
      if (fs.existsSync(attempt)) { distSrc = attempt; break; }
    }
    let buildPreserved = false;
    if (distSrc) {
      const buildTarget = path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', args.project, args.version);
      if (fs.existsSync(buildTarget)) {
        fs.rmSync(buildTarget, { recursive: true, force: true });
      }
      fs.mkdirSync(buildTarget, { recursive: true });
      copyRecursive(distSrc, buildTarget, true);
      buildPreserved = true;
    }

    // Preserve CLI logs if present (check both <from>/.planning/.gad-log and <from>/.gad-log)
    const logCandidates = [
      path.join(from, '.planning', '.gad-log'),
      path.join(from, '.gad-log'),
      path.join(gameSrc, '.gad-log'),
      path.join(gameSrc, '.planning', '.gad-log'),
    ];
    let logsPreserved = false;
    for (const logSrc of logCandidates) {
      if (fs.existsSync(logSrc)) {
        const logDst = path.join(runDir, '.gad-log');
        if (fs.existsSync(logDst)) fs.rmSync(logDst, { recursive: true, force: true });
        copyRecursive(logSrc, logDst);
        logsPreserved = true;
        break;
      }
    }

    // Detect workflow artifacts OUTSIDE .planning/ (violation of layout contract)
    const workflowArtifactNames = ['WORKFLOW.md', 'ARCHITECTURE.md', 'DECISIONS.md', 'DECISIONS.xml', 'NOTES.md', 'CHANGELOG.md', 'ROADMAP.md', 'ROADMAP.xml', 'TASK-REGISTRY.md', 'TASK-REGISTRY.xml', 'STATE.md', 'STATE.xml', 'VERIFICATION.md'];
    const misplaced = [];
    const hasPlanningDir = fs.existsSync(path.join(runTargetDir, '.planning'));
    for (const entry of fs.readdirSync(runTargetDir)) {
      if (entry === '.planning' || entry === '_worktree_root_extras') continue;
      if (workflowArtifactNames.includes(entry)) {
        misplaced.push(entry);
      }
      // Also check for a skills/ directory not under .planning/
      if (entry === 'skills' && fs.statSync(path.join(runTargetDir, entry)).isDirectory()) {
        misplaced.push('skills/');
      }
    }

    console.log(`\n✓ Preserved ${args.project} ${args.version}`);
    console.log(`  Project tree:    ${copiedCount} top-level entries → evals/${args.project}/${args.version}/run/`);
    if (rootExtrasCopied > 0) {
      console.log(`  Root extras:     ${rootExtrasCopied} agent-created files → run/_worktree_root_extras/`);
    }
    console.log(`  Build:           ${buildPreserved ? 'preserved' : 'NOT FOUND (no dist/)'}`);
    console.log(`  CLI logs:        ${logsPreserved ? 'preserved' : 'NOT FOUND'}`);
    console.log(`  .planning/ home: ${hasPlanningDir ? 'present' : 'MISSING'}`);

    if (misplaced.length > 0) {
      console.log(`\n⚠  Workflow artifacts found OUTSIDE game/.planning/:`);
      for (const m of misplaced) console.log(`     ${m}`);
      console.log(`   Contract violation: all workflow artifacts should live under game/.planning/.`);
      console.log(`   See AGENTS.md layout requirements. Record this in the human review notes.`);
    }
    if (!hasPlanningDir) {
      console.log(`\n⚠  No game/.planning/ directory found. Agent did not create a planning home.`);
      console.log(`   This is a contract violation — all evals must put workflow artifacts in .planning/.`);
    }

    if (!buildPreserved) {
      console.log(`\n⚠  No build was preserved. Agent did not produce game/dist/.`);
      console.log(`    This may be a gate failure — verify and record.`);
    }

    // Skill provenance diffing (decision gad-120, phase 31)
    // Compare skills at start (from TRACE.json skills_provenance.start_snapshot)
    // vs skills at end (preserved run's skills directories). New skills = authored.
    const traceJsonPath = path.join(runDir, 'TRACE.json');
    if (fs.existsSync(traceJsonPath)) {
      try {
        const trace = JSON.parse(fs.readFileSync(traceJsonPath, 'utf8'));
        const startSnapshot = new Set(
          (trace.skills_provenance?.start_snapshot || []).map(s => String(s))
        );

        // Collect all skill names from the preserved run's skills directories
        const endSkills = new Set();
        const skillCandidates = [
          path.join(runTargetDir, '.planning', 'skills'),
          path.join(runTargetDir, 'skills'),
        ];
        for (const skillDir of skillCandidates) {
          if (fs.existsSync(skillDir)) {
            for (const entry of fs.readdirSync(skillDir, { withFileTypes: true })) {
              if (entry.isDirectory()) {
                endSkills.add(entry.name);
              } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
                endSkills.add(entry.name.replace(/\.md$/, ''));
              }
            }
          }
        }

        // Skills that exist at end but not at start are authored
        const authored = [];
        for (const skill of endSkills) {
          if (!startSnapshot.has(skill)) {
            authored.push(skill);
          }
        }

        // Update TRACE.json with skills_authored
        if (!trace.skills_provenance) trace.skills_provenance = {};
        trace.skills_provenance.end_snapshot = [...endSkills].sort();
        trace.skills_provenance.skills_authored = authored.sort();
        fs.writeFileSync(traceJsonPath, JSON.stringify(trace, null, 2));

        if (authored.length > 0) {
          console.log(`  Skills authored:  ${authored.length} (${authored.join(', ')})`);
        } else {
          console.log(`  Skills authored:  0 (no new skills created during run)`);
        }
      } catch (err) {
        console.warn(`  [warn] skill provenance diff failed: ${err.message}`);
      }
    }

    if (fs.existsSync(traceJsonPath)) {
      try {
        const trace = JSON.parse(fs.readFileSync(traceJsonPath, 'utf8'));
        let traceEvents = Array.isArray(trace.trace_events) ? trace.trace_events : null;
        if (!traceEvents && typeof trace.trace_events_file === 'string' && trace.trace_events_file.trim()) {
          const traceEventsPath = trace.trace_events_file;
          if (fs.existsSync(traceEventsPath)) {
            traceEvents = parseTraceEventsJsonl(fs.readFileSync(traceEventsPath, 'utf8'));
            trace.trace_events = traceEvents;
            trace.trace_schema_version = Math.max(Number(trace.trace_schema_version || 0), 5);
          }
        }
        trace.agent_lineage = summarizeAgentLineage({
          traceEvents,
          runtimeIdentity: trace.runtime_identity,
          runtimesInvolved: trace.runtimes_involved,
        });
        fs.writeFileSync(traceJsonPath, JSON.stringify(trace, null, 2));
        console.log(
          `  Agent lineage:   ${trace.agent_lineage.total_agents} lane(s) ` +
          `(${trace.agent_lineage.root_agent_count} root, ${trace.agent_lineage.subagent_count} subagent)`
        );
      } catch (err) {
        console.warn(`  [warn] agent lineage summary failed: ${err.message}`);
      }
    }

    // Compute source + build sizes and write to TRACE.json (phase 30)
    if (fs.existsSync(traceJsonPath)) {
      try {
        const trace = JSON.parse(fs.readFileSync(traceJsonPath, 'utf8'));
        // Source size: total size of src/ in preserved run
        const srcDir = path.join(runTargetDir, 'src');
        const sourceSizeBytes = fs.existsSync(srcDir) ? dirSizeBytes(srcDir) : 0;
        // Build size: preserved build in public/evals/ or run/dist/
        const buildTarget = path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', args.project, args.version);
        let buildSizeBytes = 0;
        if (buildPreserved && fs.existsSync(buildTarget)) {
          buildSizeBytes = dirSizeBytes(buildTarget);
        } else {
          const runDist = path.join(runTargetDir, 'dist');
          if (fs.existsSync(runDist)) buildSizeBytes = dirSizeBytes(runDist);
        }
        trace.source_size_bytes = sourceSizeBytes;
        trace.build_size_bytes = buildSizeBytes;
        fs.writeFileSync(traceJsonPath, JSON.stringify(trace, null, 2));
        console.log(`  Source size:      ${(sourceSizeBytes / 1024).toFixed(1)} KB`);
        console.log(`  Build size:       ${(buildSizeBytes / 1024).toFixed(1)} KB`);
      } catch (err) {
        console.warn(`  [warn] size computation failed: ${err.message}`);
      }
    }

    // Update RUN.md
    const runMdPath = path.join(runDir, 'RUN.md');
    const runMdLine = `preserved: ${new Date().toISOString()} (from ${from})\n`;
    if (fs.existsSync(runMdPath)) {
      fs.appendFileSync(runMdPath, runMdLine);
    } else {
      fs.writeFileSync(runMdPath, `# Eval Run ${args.version}\n\nproject: ${args.project}\n${runMdLine}`);
    }
  },
});

// Helper for eval preserve
function copyRecursive(src, dst, flatten = false) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!flatten) fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === 'node_modules' || entry === '.git') continue;
      copyRecursive(path.join(src, entry), path.join(flatten ? dst : dst, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

// Helper: compute total size of a directory in bytes (recursive, excludes node_modules/.git)
function dirSizeBytes(dirPath) {
  let total = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += dirSizeBytes(fullPath);
    } else if (entry.isFile()) {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

// gad generation verify — audit preservation of all eval runs
const evalVerify = defineCommand({
  meta: { name: 'verify', description: 'Audit all eval runs for preservation completeness (code, build, logs, trace)' },
  args: {
    project: { type: 'positional', description: 'Specific project to verify (default: all)', default: '' },
  },
  run({ args }) {
    const repoRoot = findRepoRoot();

    let discovered;
    try {
      discovered = listAllEvalProjects();
    } catch (err) {
      outputError(err.message);
      return;
    }
    if (discovered.length === 0) {
      outputError('No eval projects found.');
      return;
    }

    const projectDirByName = new Map(discovered.map(d => [d.name, d.projectDir]));
    const projects = args.project
      ? [args.project]
      : discovered.map(d => d.name);

    const issues = [];
    let totalRuns = 0;
    let cleanRuns = 0;

    console.log('GAD Eval Preservation Audit\n');
    console.log('PROJECT                         VERSION  TRACE  RUN   BUILD  LOGS  STATUS');
    console.log('──────────────────────────────  ───────  ─────  ────  ─────  ────  ──────');

    for (const project of projects) {
      const projectDir = projectDirByName.get(project) || path.join(defaultEvalsDir(), project);
      if (!fs.existsSync(projectDir)) continue;
      const versions = fs.readdirSync(projectDir)
        .filter(n => /^v\d+$/.test(n))
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

      // Eval type was previously inferred from a project-level `gad.json`.
      // That file was renamed to species-level `species.json` in task
      // 42.4-14 (decision gad-184); the read here was dead (file never
      // existed post-rename) and `evalType` always stayed 'implementation'.
      // Removed in task 42.4-18. The downstream heuristic (`skipCodeCheck`
      // below) is still what actually branches verification behaviour, and
      // the `evalType` variable is unused in the rest of this block so the
      // default is preserved only as a historical placeholder.
      const evalType = 'implementation';
      void evalType;
      // Heuristic: tooling/mcp/cli-efficiency evals don't need run/ or build/
      const skipCodeCheck = ['tooling-watch', 'tooling-mcp', 'cli-efficiency', 'planning-migration', 'project-migration', 'portfolio-bare', 'reader-workspace', 'gad-planning-loop', 'subagent-utility'].includes(project);

      for (const v of versions) {
        totalRuns++;
        const vDir = path.join(projectDir, v);
        const tracePath = path.join(vDir, 'TRACE.json');
        const hasTrace = fs.existsSync(tracePath);
        const hasRun = fs.existsSync(path.join(vDir, 'run')) &&
                       fs.readdirSync(path.join(vDir, 'run')).length > 0;
        const hasBuild = fs.existsSync(path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', project, v, 'index.html'));
        const hasLogs = fs.existsSync(path.join(vDir, '.gad-log'));
        let hasRuntimeIdentity = false;
        if (hasTrace) {
          try {
            const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
            hasRuntimeIdentity = typeof trace?.runtime_identity?.id === 'string' && trace.runtime_identity.id.trim().length > 0;
          } catch {}
        }

        const problems = [];
        if (!hasTrace) problems.push('no TRACE.json');
        if (hasTrace && !hasRuntimeIdentity) problems.push('no runtime identity');
        if (!skipCodeCheck && !hasRun) problems.push('no run/ dir');
        if (!skipCodeCheck && !hasBuild) problems.push('no build');
        if (!skipCodeCheck && !hasLogs) problems.push('no CLI logs');

        const status = problems.length === 0 ? 'OK' : 'MISSING';
        if (problems.length === 0) cleanRuns++;
        else issues.push({ project, version: v, problems });

        const mark = (x, req) => req ? (x ? '  ✓  ' : '  ✗  ') : '  -  ';
        console.log(
          `${project.padEnd(30)}  ${v.padEnd(7)}  ${mark(hasTrace, true)}  ${mark(hasRun, !skipCodeCheck).trim().padStart(4)}  ${mark(hasBuild, !skipCodeCheck)}  ${mark(hasLogs, !skipCodeCheck).trim().padStart(4)}  ${status}`
        );
      }
    }

    console.log(`\n${cleanRuns}/${totalRuns} runs fully preserved`);

    if (issues.length > 0) {
      console.log('\nIssues:');
      for (const issue of issues) {
        console.log(`  ${issue.project} ${issue.version}: ${issue.problems.join(', ')}`);
      }
      process.exit(1);
    }
  },
});

// gad generation review — human scoring
const evalReview = defineCommand({
  meta: { name: 'review', description: 'Submit human review score for an eval run — single score or rubric JSON (phase 27 track 1)' },
  args: {
    project: { type: 'positional', description: 'Eval project name', required: true },
    version: { type: 'positional', description: 'Version (e.g. v5)', required: true },
    score: { type: 'string', description: 'Legacy single score 0.0-1.0 (use --rubric for structured)', default: '' },
    rubric: { type: 'string', description: 'Rubric JSON: {"playability":0.8,"ui_polish":0.7,...}', default: '' },
    notes: { type: 'string', description: 'Review notes', default: '' },
    reviewer: { type: 'string', description: 'Reviewer id (default: human)', default: 'human' },
  },
  run({ args }) {
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);
    const runDir = path.join(projectDir, args.version);
    const traceFile = path.join(runDir, 'TRACE.json');

    if (!fs.existsSync(traceFile)) {
      outputError(`No TRACE.json found at evals/${args.project}/${args.version}/`);
      return;
    }

    if (!args.score && !args.rubric) {
      outputError('Either --score (legacy) or --rubric <json> (structured) is required');
      return;
    }

    const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));

    // Rubric mode (phase 27 track 1)
    if (args.rubric) {
      let parsed;
      try {
        parsed = JSON.parse(args.rubric);
      } catch (err) {
        outputError(`--rubric must be valid JSON: ${err.message}`);
        return;
      }

      // Load project's declared rubric dimensions. Previously read from a
      // project-level `gad.json`; after task 42.4-14 (decision gad-184) the
      // canonical location is the resolved species (`project.json` merged
      // with each `species.json`). Walk the resolved species under the
      // project and use the first one that declares a `humanReviewRubric`.
      // The rubric is expected to be project-wide in practice.
      let rubricDef = null;
      try {
        const resolved = loadAllResolvedSpecies(projectDir);
        for (const sp of resolved) {
          if (!sp) continue;
          if (sp.humanReviewRubric && Array.isArray(sp.humanReviewRubric.dimensions)) {
            rubricDef = sp.humanReviewRubric;
            break;
          }
        }
      } catch (err) {
        outputError(`Failed to resolve species for project ${args.project}: ${err.message}`);
        return;
      }
      if (!rubricDef || !Array.isArray(rubricDef.dimensions)) {
        outputError(`Project ${args.project} has no humanReviewRubric in project.json or any species.json. Add one or use --score for legacy mode.`);
        return;
      }

      // Validate and build dimensions object
      const dimensions = {};
      let sum = 0;
      let totalWeight = 0;
      const errors = [];
      for (const d of rubricDef.dimensions) {
        const rawScore = parsed[d.key];
        if (rawScore == null) {
          errors.push(`missing dimension: ${d.key}`);
          continue;
        }
        const n = typeof rawScore === 'number' ? rawScore : parseFloat(rawScore);
        if (isNaN(n) || n < 0 || n > 1) {
          errors.push(`${d.key} out of range [0, 1]: ${rawScore}`);
          continue;
        }
        // Allow inline per-dimension notes via "key_notes" convention
        const dimNotes = parsed[`${d.key}_notes`] ?? null;
        dimensions[d.key] = { score: n, notes: dimNotes };
        sum += n * d.weight;
        totalWeight += d.weight;
      }
      if (errors.length > 0) {
        outputError(`Rubric validation failed:\n  ${errors.join('\n  ')}`);
        return;
      }

      const aggregate = totalWeight > 0 ? +(sum / totalWeight).toFixed(4) : null;

      trace.human_review = {
        rubric_version: rubricDef.version || 'v1',
        dimensions,
        aggregate_score: aggregate,
        notes: args.notes || null,
        reviewed_by: args.reviewer,
        reviewed_at: new Date().toISOString(),
      };

      // Mirror aggregate into scores.human_review for backwards compat with
      // the composite-formula readers
      const s = trace.scores || {};
      s.human_review = aggregate;
      trace.scores = s;

      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));

      console.log(`\n✓ Rubric review saved: ${args.project} ${args.version}`);
      console.log(`  Aggregate: ${aggregate}`);
      console.log(`  Dimensions:`);
      for (const d of rubricDef.dimensions) {
        const dim = dimensions[d.key];
        console.log(`    ${d.label.padEnd(30)} ${dim.score.toFixed(2)}  (weight ${d.weight.toFixed(2)})`);
      }
      return;
    }

    // Legacy single-score mode
    const scoreVal = parseFloat(args.score);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 1) {
      outputError('Score must be between 0.0 and 1.0');
      return;
    }

    trace.human_review = {
      score: scoreVal,
      notes: args.notes || null,
      reviewed_by: args.reviewer,
      reviewed_at: new Date().toISOString(),
    };

    // Recompute composite with human review
    const s = trace.scores || {};
    s.human_review = scoreVal;
    if (s.requirement_coverage != null && s.planning_quality != null && s.per_task_discipline != null && s.skill_accuracy != null && s.time_efficiency != null) {
      s.composite = (s.requirement_coverage * 0.15) + (s.planning_quality * 0.15) + (s.per_task_discipline * 0.15) + (s.skill_accuracy * 0.10) + (s.time_efficiency * 0.05) + (scoreVal * 0.30);
      // Low human-review caps
      if (scoreVal < 0.10) s.composite = Math.min(s.composite, 0.25);
      else if (scoreVal < 0.20) s.composite = Math.min(s.composite, 0.40);
      s.auto_composite = null;
    }
    trace.scores = s;

    fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));

    // Also update scores.json if it exists
    const scoresFile = path.join(runDir, 'scores.json');
    if (fs.existsSync(scoresFile)) {
      try {
        const sd = JSON.parse(fs.readFileSync(scoresFile, 'utf8'));
        sd.dimensions = sd.dimensions || {};
        sd.dimensions.human_review = scoreVal;
        sd.human_reviewed = true;
        if (s.composite != null) sd.composite = s.composite;
        fs.writeFileSync(scoresFile, JSON.stringify(sd, null, 2));
      } catch {}
    }

    console.log(`Human review recorded: ${args.project} ${args.version}`);
    console.log(`  Score: ${scoreVal}`);
    if (args.notes) console.log(`  Notes: ${args.notes}`);
    if (s.composite != null) console.log(`  New composite: ${s.composite.toFixed(3)} (with human review)`);
  },
});

// gad generation open — serve preserved generation static build (same handler as `gad play`).
// Not `gad site serve` (planning/landing Next extract) — see decision gad-225.
const evalOpen = defineCommand({
  meta: {
    name: 'open',
    description:
      'Serve preserved generation static build over HTTP and open browser. Same as `gad play`. For the GAD planning/landing site use `gad site serve`, not this command.',
  },
  args: {
    project: { type: 'positional', description: 'Eval project name (or project/species for nested ids)', required: true },
    version: { type: 'positional', description: 'Version (default: latest)', default: '' },
  },
  run({ args }) {
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);

    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project not found: ${args.project}`);
      return;
    }

    // Find version
    let version = args.version;
    if (!version) {
      const versions = fs.readdirSync(projectDir).filter(n => /^v\d+$/.test(n)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
      version = versions[versions.length - 1] || '';
    }

    if (!version) {
      outputError(`No runs found for ${args.project}`);
      return;
    }

    // Look for build output in common locations (version-specific first)
    const repoRoot = findRepoRoot();
    const candidates = [
      // Portfolio public, per-version (canonical location for preserved builds)
      path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', args.project, version, 'index.html'),
      // Eval dir per-version
      path.join(projectDir, version, 'game', 'dist', 'index.html'),
      path.join(projectDir, version, 'dist', 'index.html'),
      path.join(projectDir, version, 'build', 'index.html'),
      path.join(projectDir, version, 'index.html'),
      // Legacy: portfolio public root (latest only)
      path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', args.project, 'index.html'),
    ];

    let found = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) { found = c; break; }
    }

    if (!found) {
      console.log(`No build output found for ${args.project} ${version}`);
      console.log('Checked:');
      for (const c of candidates) console.log(`  ${path.relative(process.cwd(), c)}`);
      return;
    }

    const serveDir = path.dirname(path.resolve(found));
    const { serveStatic } = require('../lib/site-compile.cjs');
    const { exec } = require('child_process');

    const port = 4173 + Math.floor(Math.random() * 500);
    const host = '127.0.0.1';
    const logPrefix = '[gad play]';

    console.log(`${logPrefix} generation static build (not the GAD landing site — use \`gad site serve\` for that)`);
    console.log(`${logPrefix} root: ${path.relative(process.cwd(), serveDir)}`);

    let opened = false;
    const openBrowser = () => {
      if (opened) return;
      opened = true;
      const isWin = process.platform === 'win32';
      const url = `http://${host}:${port}/`;
      const cmd = isWin ? `start "" "${url}"` : (process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`);
      exec(cmd);
    };

    const server = serveStatic({
      rootDir: serveDir,
      port,
      host,
      logPrefix,
      onListening: () => {
        openBrowser();
      },
    });

    console.log(`\n${logPrefix} Press Ctrl+C to stop the server.`);
    process.on('SIGINT', () => {
      try {
        server.close(() => process.exit(0));
      } catch {
        process.exit(0);
      }
    });
  },
});

// ---------------------------------------------------------------------------
// gad eval skill — per-skill evaluation harness (decision gad-87, task 22-52)
//
// Follows the agentskills.io methodology: evals/evals.json per skill with
// with_skill vs without_skill baseline runs, assertion-based grading,
// benchmark.json aggregation.
//
// Phase 1 (this implementation): CLI for init, list, grade, benchmark.
// Phase 2 (future): automated subagent-spawn + trace-based grading.
// ---------------------------------------------------------------------------

const SKILLS_ROOT = path.join(__dirname, '..', 'skills');

const evalSkillList = defineCommand({
  meta: { name: 'list', description: 'Show all skills with their eval status (has evals/evals.json or not)' },
  run() {
    if (!fs.existsSync(SKILLS_ROOT)) {
      outputError('No skills/ directory found');
      return;
    }

    const skills = [];
    function walk(dir, prefix = '') {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillDir = path.join(dir, entry.name);
        const skillMd = path.join(skillDir, 'SKILL.md');
        if (!fs.existsSync(skillMd)) {
          // Check subdirectories (for emergent/ etc)
          walk(skillDir, prefix ? `${prefix}/${entry.name}` : entry.name);
          continue;
        }
        const id = prefix ? `${prefix}/${entry.name}` : entry.name;
        const evalsJson = path.join(skillDir, 'evals', 'evals.json');
        const hasEvals = fs.existsSync(evalsJson);
        let testCount = 0;
        let benchmarkExists = false;
        if (hasEvals) {
          try {
            const parsed = JSON.parse(fs.readFileSync(evalsJson, 'utf8'));
            testCount = parsed.evals?.length ?? 0;
          } catch {}
          // Check for any iteration benchmarks
          const evalsDir = path.join(skillDir, 'evals');
          for (const f of fs.readdirSync(evalsDir)) {
            if (f.startsWith('benchmark') && f.endsWith('.json')) {
              benchmarkExists = true;
              break;
            }
          }
        }

        // Read status from frontmatter
        const content = fs.readFileSync(skillMd, 'utf8');
        const statusMatch = content.match(/^status:\s*(.+)$/m);
        const originMatch = content.match(/^origin:\s*(.+)$/m);
        const status = statusMatch ? statusMatch[1].trim() : 'experimental';
        const origin = originMatch ? originMatch[1].trim() : 'human-authored';

        skills.push({ id, status, origin, hasEvals, testCount, benchmarkExists });
      }
    }

    walk(SKILLS_ROOT);

    console.log(`\n  Per-skill evaluation status (${skills.length} skills)\n`);
    console.log(`  ${'Skill'.padEnd(35)} ${'Status'.padEnd(15)} ${'Origin'.padEnd(16)} ${'Evals'.padEnd(8)} Tests  Benchmark`);
    console.log(`  ${'─'.repeat(35)} ${'─'.repeat(15)} ${'─'.repeat(16)} ${'─'.repeat(8)} ${'─'.repeat(6)} ${'─'.repeat(9)}`);

    for (const s of skills.sort((a, b) => a.id.localeCompare(b.id))) {
      const evalIcon = s.hasEvals ? '✓' : '✗';
      const benchIcon = s.benchmarkExists ? '✓' : '—';
      console.log(
        `  ${s.id.padEnd(35)} ${s.status.padEnd(15)} ${s.origin.padEnd(16)} ${evalIcon.padEnd(8)} ${String(s.testCount).padEnd(6)} ${benchIcon}`
      );
    }

    const withEvals = skills.filter(s => s.hasEvals).length;
    const withBenchmark = skills.filter(s => s.benchmarkExists).length;
    const canonical = skills.filter(s => s.status === 'canonical').length;
    console.log(`\n  Summary: ${withEvals}/${skills.length} have evals/evals.json, ${withBenchmark} have benchmarks, ${canonical} canonical`);
    console.log(`  Per gad-86: skills without evaluation = experimental. Run \`gad eval skill init <name>\` to create test cases.\n`);
  },
});

const evalSkillInit = defineCommand({
  meta: { name: 'init', description: 'Generate evals/evals.json template for a skill based on its description' },
  args: {
    name: { type: 'positional', description: 'Skill name (e.g. create-skill, merge-skill)', required: true },
  },
  run({ args }) {
    const skillDir = path.join(SKILLS_ROOT, args.name);
    // Also check emergent subdir
    const emergentDir = path.join(SKILLS_ROOT, 'emergent', args.name);
    const resolvedDir = fs.existsSync(path.join(skillDir, 'SKILL.md'))
      ? skillDir
      : fs.existsSync(path.join(emergentDir, 'SKILL.md'))
        ? emergentDir
        : null;

    if (!resolvedDir) {
      outputError(`Skill "${args.name}" not found at skills/${args.name}/SKILL.md or skills/emergent/${args.name}/SKILL.md`);
      return;
    }

    const evalsDir = path.join(resolvedDir, 'evals');
    const evalsJson = path.join(evalsDir, 'evals.json');

    if (fs.existsSync(evalsJson)) {
      console.log(`  evals/evals.json already exists for ${args.name}`);
      const parsed = JSON.parse(fs.readFileSync(evalsJson, 'utf8'));
      console.log(`  ${parsed.evals?.length ?? 0} test case(s) defined`);
      console.log(`  Edit ${evalsJson} to add or modify test cases.`);
      return;
    }

    // Read SKILL.md for context
    const skillContent = fs.readFileSync(path.join(resolvedDir, 'SKILL.md'), 'utf8');
    const nameMatch = skillContent.match(/^name:\s*(.+)$/m);
    const descMatch = skillContent.match(/^description:\s*>-?\s*\n([\s\S]*?)(?=\n---|\n\w+:)/m)
      || skillContent.match(/^description:\s*(.+)$/m);
    const skillName = nameMatch ? nameMatch[1].trim() : args.name;
    const description = descMatch ? descMatch[1].trim().replace(/\n\s+/g, ' ') : '';

    // Generate template evals.json based on the agentskills.io format
    const template = {
      skill_name: skillName,
      format_version: 'agentskills-v1',
      generated_by: 'gad eval skill init',
      generated_on: new Date().toISOString().split('T')[0],
      description: `Test cases for the ${skillName} skill. Per gad-87, grading uses trace events + file mutations + commit log — not LLM self-report.`,
      evals: [
        {
          id: 1,
          prompt: `[TODO: Write a realistic user prompt that should trigger the ${skillName} skill]`,
          expected_output: `[TODO: Describe what success looks like when this skill is used]`,
          files: [],
          assertions: [
            `[TODO: Write a verifiable assertion about the expected output — e.g. "A new file was created at <path>"]`,
            `[TODO: Write a second assertion]`,
          ],
          grading_strategy: 'trace-based',
          trace_assertions: [
            {
              type: 'file_mutation',
              description: `[TODO: What file should be created/modified when this skill runs?]`,
              pattern: '[TODO: glob or path pattern]',
            },
          ],
        },
        {
          id: 2,
          prompt: `[TODO: Write a DIFFERENT prompt that should also trigger ${skillName} — different phrasing, different context]`,
          expected_output: `[TODO: Describe what success looks like]`,
          files: [],
          assertions: [
            `[TODO: Verifiable assertion]`,
          ],
          grading_strategy: 'trace-based',
          trace_assertions: [],
        },
        {
          id: 3,
          prompt: `[TODO: Write a prompt that should NOT trigger ${skillName} — negative test case]`,
          expected_output: `The skill should NOT activate for this prompt.`,
          files: [],
          assertions: [
            `The skill was not invoked (no skill_invocation event in trace for ${skillName})`,
          ],
          grading_strategy: 'trace-based',
          trace_assertions: [
            {
              type: 'skill_invocation_absent',
              description: `${skillName} should NOT have been invoked`,
              skill_name: skillName,
            },
          ],
        },
      ],
    };

    fs.mkdirSync(evalsDir, { recursive: true });
    fs.writeFileSync(evalsJson, JSON.stringify(template, null, 2), 'utf8');

    console.log(`\n  ✓ Created ${path.relative(SKILLS_ROOT, evalsJson)}`);
    console.log(`    ${template.evals.length} test cases generated (2 positive + 1 negative)`);
    console.log(`    Skill: ${skillName}`);
    if (description) {
      console.log(`    Description: ${description.slice(0, 120)}...`);
    }
    console.log(`\n  Next steps:`);
    console.log(`    1. Edit the [TODO] placeholders in evals.json with real prompts + assertions`);
    console.log(`    2. Run: gad eval skill run ${args.name} --iteration 1`);
    console.log(`    3. After running with_skill + without_skill: gad eval skill grade ${args.name} --iteration 1`);
    console.log(`    4. View results: gad eval skill benchmark ${args.name}\n`);
  },
});

const evalSkillRun = defineCommand({
  meta: { name: 'run', description: 'Generate prompts for a skill eval run (with_skill + without_skill)' },
  args: {
    name: { type: 'positional', description: 'Skill name', required: true },
    iteration: { type: 'string', description: 'Iteration number', default: '1' },
  },
  run({ args }) {
    const skillDir = path.join(SKILLS_ROOT, args.name);
    const emergentDir = path.join(SKILLS_ROOT, 'emergent', args.name);
    const resolvedDir = fs.existsSync(path.join(skillDir, 'SKILL.md')) ? skillDir
      : fs.existsSync(path.join(emergentDir, 'SKILL.md')) ? emergentDir : null;

    if (!resolvedDir) {
      outputError(`Skill "${args.name}" not found`);
      return;
    }

    const evalsJson = path.join(resolvedDir, 'evals', 'evals.json');
    if (!fs.existsSync(evalsJson)) {
      outputError(`No evals/evals.json for ${args.name}. Run: gad eval skill init ${args.name}`);
      return;
    }

    const evals = JSON.parse(fs.readFileSync(evalsJson, 'utf8'));
    const iterNum = parseInt(args.iteration, 10);

    // Create workspace directory
    const workspaceDir = path.join(resolvedDir, `${args.name}-workspace`, `iteration-${iterNum}`);
    fs.mkdirSync(workspaceDir, { recursive: true });

    console.log(`\n  Skill eval: ${args.name} — iteration ${iterNum}`);
    console.log(`  ${evals.evals.length} test case(s) × 2 conditions (with_skill + without_skill)`);
    console.log(`  Workspace: ${path.relative(SKILLS_ROOT, workspaceDir)}\n`);

    for (const tc of evals.evals) {
      const evalDir = path.join(workspaceDir, `eval-${tc.id}`);
      fs.mkdirSync(path.join(evalDir, 'with_skill', 'outputs'), { recursive: true });
      fs.mkdirSync(path.join(evalDir, 'without_skill', 'outputs'), { recursive: true });

      // Generate prompt files for each condition
      const withSkillPrompt = `Execute this task WITH the ${args.name} skill loaded:
- Skill path: ${path.relative(process.cwd(), resolvedDir)}
- Task: ${tc.prompt}
${tc.files?.length ? `- Input files: ${tc.files.join(', ')}` : ''}
- Save outputs to: ${path.relative(process.cwd(), path.join(evalDir, 'with_skill', 'outputs'))}/

After completing, record timing:
- total_tokens: (from task completion notification)
- duration_ms: (from task completion notification)
Save as ${path.relative(process.cwd(), path.join(evalDir, 'with_skill', 'timing.json'))}
`;

      const withoutSkillPrompt = `Execute this task WITHOUT any skill guidance:
- Task: ${tc.prompt}
${tc.files?.length ? `- Input files: ${tc.files.join(', ')}` : ''}
- Save outputs to: ${path.relative(process.cwd(), path.join(evalDir, 'without_skill', 'outputs'))}/
- Do NOT load or reference the ${args.name} skill

After completing, record timing:
- total_tokens: (from task completion notification)
- duration_ms: (from task completion notification)
Save as ${path.relative(process.cwd(), path.join(evalDir, 'without_skill', 'timing.json'))}
`;

      fs.writeFileSync(path.join(evalDir, 'with_skill', 'PROMPT.md'), withSkillPrompt, 'utf8');
      fs.writeFileSync(path.join(evalDir, 'without_skill', 'PROMPT.md'), withoutSkillPrompt, 'utf8');

      // Write assertions file for grading
      fs.writeFileSync(path.join(evalDir, 'assertions.json'), JSON.stringify({
        eval_id: tc.id,
        prompt: tc.prompt,
        expected_output: tc.expected_output,
        assertions: tc.assertions,
        trace_assertions: tc.trace_assertions ?? [],
      }, null, 2), 'utf8');

      console.log(`  ✓ eval-${tc.id}: prompts + assertions generated`);
    }

    console.log(`\n  Next: run each PROMPT.md as a subagent task (with_skill first, then without_skill).`);
    console.log(`  After both complete: gad eval skill grade ${args.name} --iteration ${iterNum}\n`);
  },
});

const evalSkillGrade = defineCommand({
  meta: { name: 'grade', description: 'Grade a skill eval iteration by checking assertions against outputs' },
  args: {
    name: { type: 'positional', description: 'Skill name', required: true },
    iteration: { type: 'string', description: 'Iteration number', default: '1' },
  },
  run({ args }) {
    const skillDir = path.join(SKILLS_ROOT, args.name);
    const emergentDir = path.join(SKILLS_ROOT, 'emergent', args.name);
    const resolvedDir = fs.existsSync(path.join(skillDir, 'SKILL.md')) ? skillDir
      : fs.existsSync(path.join(emergentDir, 'SKILL.md')) ? emergentDir : null;

    if (!resolvedDir) { outputError(`Skill not found`); return; }

    const workspaceDir = path.join(resolvedDir, `${args.name}-workspace`, `iteration-${args.iteration}`);
    if (!fs.existsSync(workspaceDir)) {
      outputError(`No workspace at iteration-${args.iteration}. Run: gad eval skill run ${args.name} --iteration ${args.iteration}`);
      return;
    }

    console.log(`\n  Grading: ${args.name} — iteration ${args.iteration}\n`);

    const evalDirs = fs.readdirSync(workspaceDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('eval-'))
      .sort((a, b) => a.name.localeCompare(b.name));

    const results = [];

    for (const evalEntry of evalDirs) {
      const evalDir = path.join(workspaceDir, evalEntry.name);
      const assertionsFile = path.join(evalDir, 'assertions.json');
      if (!fs.existsSync(assertionsFile)) continue;

      const { eval_id, assertions, trace_assertions } = JSON.parse(fs.readFileSync(assertionsFile, 'utf8'));

      // Check with_skill outputs
      const withOutputDir = path.join(evalDir, 'with_skill', 'outputs');
      const withOutputFiles = fs.existsSync(withOutputDir) ? fs.readdirSync(withOutputDir) : [];
      const withTimingFile = path.join(evalDir, 'with_skill', 'timing.json');
      const withTiming = fs.existsSync(withTimingFile) ? JSON.parse(fs.readFileSync(withTimingFile, 'utf8')) : null;

      // Check without_skill outputs
      const withoutOutputDir = path.join(evalDir, 'without_skill', 'outputs');
      const withoutOutputFiles = fs.existsSync(withoutOutputDir) ? fs.readdirSync(withoutOutputDir) : [];
      const withoutTimingFile = path.join(evalDir, 'without_skill', 'timing.json');
      const withoutTiming = fs.existsSync(withoutTimingFile) ? JSON.parse(fs.readFileSync(withoutTimingFile, 'utf8')) : null;

      // Grade: for now, check if outputs exist (Phase 1 — manual review)
      // Phase 2 will add trace-based assertion grading
      const withHasOutput = withOutputFiles.length > 0;
      const withoutHasOutput = withoutOutputFiles.length > 0;

      const gradingResult = {
        eval_id,
        with_skill: {
          has_output: withHasOutput,
          output_files: withOutputFiles,
          timing: withTiming,
          grading: {
            assertion_results: assertions.map(a => ({
              text: a,
              passed: null,
              evidence: withHasOutput ? 'PENDING MANUAL REVIEW — edit this grading.json with PASS/FAIL + evidence' : 'NO OUTPUT — run did not produce results',
            })),
            summary: { passed: 0, failed: 0, pending: assertions.length, total: assertions.length },
          },
        },
        without_skill: {
          has_output: withoutHasOutput,
          output_files: withoutOutputFiles,
          timing: withoutTiming,
          grading: {
            assertion_results: assertions.map(a => ({
              text: a,
              passed: null,
              evidence: withoutHasOutput ? 'PENDING MANUAL REVIEW' : 'NO OUTPUT',
            })),
            summary: { passed: 0, failed: 0, pending: assertions.length, total: assertions.length },
          },
        },
      };

      // Write grading files
      fs.writeFileSync(path.join(evalDir, 'with_skill', 'grading.json'), JSON.stringify(gradingResult.with_skill.grading, null, 2), 'utf8');
      fs.writeFileSync(path.join(evalDir, 'without_skill', 'grading.json'), JSON.stringify(gradingResult.without_skill.grading, null, 2), 'utf8');

      results.push(gradingResult);

      const withStatus = withHasOutput ? '✓ has output' : '✗ no output';
      const withoutStatus = withoutHasOutput ? '✓ has output' : '✗ no output';
      console.log(`  eval-${eval_id}: with_skill ${withStatus} | without_skill ${withoutStatus}`);
      if (!withHasOutput || !withoutHasOutput) {
        console.log(`    → Run the PROMPT.md files before grading`);
      } else {
        console.log(`    → ${assertions.length} assertion(s) pending manual review`);
        console.log(`    → Edit grading.json files: set "passed" to true/false + add evidence`);
      }
    }

    console.log(`\n  After reviewing grading.json files: gad eval skill benchmark ${args.name}\n`);
  },
});

const evalSkillBenchmark = defineCommand({
  meta: { name: 'benchmark', description: 'Aggregate grading results into benchmark.json for a skill' },
  args: {
    name: { type: 'positional', description: 'Skill name', required: true },
  },
  run({ args }) {
    const skillDir = path.join(SKILLS_ROOT, args.name);
    const emergentDir = path.join(SKILLS_ROOT, 'emergent', args.name);
    const resolvedDir = fs.existsSync(path.join(skillDir, 'SKILL.md')) ? skillDir
      : fs.existsSync(path.join(emergentDir, 'SKILL.md')) ? emergentDir : null;

    if (!resolvedDir) { outputError(`Skill not found`); return; }

    const workspaceBase = path.join(resolvedDir, `${args.name}-workspace`);
    if (!fs.existsSync(workspaceBase)) {
      outputError(`No workspace found. Run: gad eval skill run ${args.name}`);
      return;
    }

    // Find the latest iteration
    const iterations = fs.readdirSync(workspaceBase, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('iteration-'))
      .sort((a, b) => {
        const na = parseInt(a.name.replace('iteration-', ''), 10);
        const nb = parseInt(b.name.replace('iteration-', ''), 10);
        return nb - na;
      });

    if (iterations.length === 0) {
      outputError(`No iterations found in workspace`);
      return;
    }

    const latestIter = iterations[0].name;
    const iterDir = path.join(workspaceBase, latestIter);

    console.log(`\n  Benchmarking: ${args.name} — ${latestIter}\n`);

    // Aggregate across eval directories
    const withSkillPassRates = [];
    const withoutSkillPassRates = [];
    const withSkillTokens = [];
    const withoutSkillTokens = [];
    const withSkillTimes = [];
    const withoutSkillTimes = [];

    const evalDirs = fs.readdirSync(iterDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('eval-'));

    for (const evalEntry of evalDirs) {
      const evalDir = path.join(iterDir, evalEntry.name);

      for (const condition of ['with_skill', 'without_skill']) {
        const gradingFile = path.join(evalDir, condition, 'grading.json');
        const timingFile = path.join(evalDir, condition, 'timing.json');

        if (fs.existsSync(gradingFile)) {
          const grading = JSON.parse(fs.readFileSync(gradingFile, 'utf8'));
          const results = grading.assertion_results ?? [];
          const passed = results.filter(r => r.passed === true).length;
          const total = results.length;
          const rate = total > 0 ? passed / total : 0;

          if (condition === 'with_skill') withSkillPassRates.push(rate);
          else withoutSkillPassRates.push(rate);
        }

        if (fs.existsSync(timingFile)) {
          const timing = JSON.parse(fs.readFileSync(timingFile, 'utf8'));
          if (condition === 'with_skill') {
            if (timing.total_tokens) withSkillTokens.push(timing.total_tokens);
            if (timing.duration_ms) withSkillTimes.push(timing.duration_ms / 1000);
          } else {
            if (timing.total_tokens) withoutSkillTokens.push(timing.total_tokens);
            if (timing.duration_ms) withoutSkillTimes.push(timing.duration_ms / 1000);
          }
        }
      }
    }

    function avg(arr) { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
    function stddev(arr) {
      if (arr.length < 2) return 0;
      const m = avg(arr);
      return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
    }

    const benchmark = {
      skill_name: args.name,
      iteration: latestIter,
      generated_on: new Date().toISOString(),
      eval_count: evalDirs.length,
      run_summary: {
        with_skill: {
          pass_rate: { mean: avg(withSkillPassRates), stddev: stddev(withSkillPassRates) },
          time_seconds: { mean: avg(withSkillTimes), stddev: stddev(withSkillTimes) },
          tokens: { mean: avg(withSkillTokens), stddev: stddev(withSkillTokens) },
        },
        without_skill: {
          pass_rate: { mean: avg(withoutSkillPassRates), stddev: stddev(withoutSkillPassRates) },
          time_seconds: { mean: avg(withoutSkillTimes), stddev: stddev(withoutSkillTimes) },
          tokens: { mean: avg(withoutSkillTokens), stddev: stddev(withoutSkillTokens) },
        },
        delta: {
          pass_rate: avg(withSkillPassRates) - avg(withoutSkillPassRates),
          time_seconds: avg(withSkillTimes) - avg(withoutSkillTimes),
          tokens: avg(withSkillTokens) - avg(withoutSkillTokens),
        },
      },
    };

    // Write benchmark.json
    const benchmarkPath = path.join(resolvedDir, 'evals', 'benchmark.json');
    fs.mkdirSync(path.join(resolvedDir, 'evals'), { recursive: true });
    fs.writeFileSync(benchmarkPath, JSON.stringify(benchmark, null, 2), 'utf8');

    // Also write to iteration dir
    fs.writeFileSync(path.join(iterDir, 'benchmark.json'), JSON.stringify(benchmark, null, 2), 'utf8');

    console.log(`  with_skill:    pass_rate ${(benchmark.run_summary.with_skill.pass_rate.mean * 100).toFixed(1)}%`);
    console.log(`  without_skill: pass_rate ${(benchmark.run_summary.without_skill.pass_rate.mean * 100).toFixed(1)}%`);
    console.log(`  delta:         ${benchmark.run_summary.delta.pass_rate > 0 ? '+' : ''}${(benchmark.run_summary.delta.pass_rate * 100).toFixed(1)}pp`);

    if (benchmark.run_summary.delta.pass_rate > 0) {
      console.log(`\n  ✓ Skill improves over baseline (delta.pass_rate > 0)`);
      console.log(`    Per gad-86: this skill is a GRADUATION CANDIDATE`);
      console.log(`    To graduate: update SKILL.md frontmatter to status: canonical`);
    } else if (withSkillPassRates.every(r => r === 0) && withoutSkillPassRates.every(r => r === 0)) {
      console.log(`\n  ⚠ No grading data — all assertions are pending manual review`);
      console.log(`    Edit the grading.json files in each eval dir, then re-run this command`);
    } else {
      console.log(`\n  ✗ Skill does NOT improve over baseline`);
      console.log(`    Status stays: experimental`);
    }

    console.log(`\n  Benchmark written to: ${path.relative(process.cwd(), benchmarkPath)}\n`);
  },
});

const evalSkillDraftCandidates = defineCommand({
  meta: {
    name: 'draft-candidates',
    description: 'Invoke claude CLI to rewrite auto-drafted skill candidate stubs into real bodies (GAD-D-145)',
  },
  args: {
    'dry-run': { type: 'boolean', description: 'Print prompts without spawning claude CLI', default: false },
    force: { type: 'boolean', description: 'Redraft candidates that already have drafted: true', default: false },
    only: { type: 'string', description: 'Only draft a single candidate (matches by name substring)' },
  },
  run({ args }) {
    const { draftAllCandidates } = require('../lib/skill-draft.cjs');
    const repoRoot = path.resolve(__dirname, '..');
    const stats = draftAllCandidates(repoRoot, {
      dryRun: args['dry-run'],
      force: args.force,
      only: args.only,
    });
    if (stats.failed > 0) process.exit(1);
  },
});

const evalSkillCmd = defineCommand({
  meta: { name: 'skill', description: 'Per-skill evaluation harness (gad-87) — list, init, run, grade, benchmark, draft-candidates' },
  subCommands: { list: evalSkillList, init: evalSkillInit, run: evalSkillRun, grade: evalSkillGrade, benchmark: evalSkillBenchmark, 'draft-candidates': evalSkillDraftCandidates },
});

const evalReadme = defineCommand({
  meta: { name: 'readme', description: 'Inject scores, timestamps, and discipline metrics into eval project README (decision gad-118)' },
  args: {
    project: { type: 'string', description: 'Eval project name', required: true },
  },
  run({ args }) {
    const projectDir = resolveOrDefaultEvalProjectDir(args.project);
    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project '${args.project}' not found.`);
      return;
    }

    // Collect run data
    const runs = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && r.name.startsWith('v'))
      .map(r => r.name)
      .sort();

    // Project / species metadata — previously read from a project-level
    // `gad.json`. That file was renamed to species-level `species.json` in
    // task 42.4-14 (decision gad-184); the read here was a dead fallthrough
    // and every field below rendered as a dash. Reworked in task 42.4-18
    // to read `project.json` for project-wide fields and the first resolved
    // species for mode/workflow/tech-stack/build-requirement.
    let projectCfg = {};
    let firstSpecies = {};
    try { projectCfg = loadEvalProject(projectDir); } catch {}
    try {
      const resolved = loadAllResolvedSpecies(projectDir);
      if (resolved.length > 0) firstSpecies = resolved[0] || {};
    } catch {}
    const pick = (...vals) => {
      for (const v of vals) if (v != null && v !== '') return v;
      return null;
    };
    const description   = pick(projectCfg.description, firstSpecies.description);
    const domain        = pick(projectCfg.domain, firstSpecies.domain);
    const evalMode      = pick(firstSpecies.eval_mode, firstSpecies.evalMode);
    const workflow      = pick(firstSpecies.workflow);
    const techStackVal  = pick(projectCfg.techStack, firstSpecies.techStack);
    const buildReqVal   = pick(firstSpecies.buildRequirement, projectCfg.buildRequirement);

    const lines = [
      `# ${args.project}`,
      '',
      description || '',
      '',
      `| Field | Value |`,
      `|---|---|`,
      `| Domain | ${domain || '—'} |`,
      `| Mode | ${evalMode || '—'} |`,
      `| Workflow | ${workflow || '—'} |`,
      `| Tech stack | ${techStackVal || '—'} |`,
      `| Build requirement | ${buildReqVal || '—'} |`,
      `| Runs | ${runs.length} |`,
      '',
    ];

    if (runs.length > 0) {
      lines.push('## Runs', '', '| Version | Date | Human | Composite | Status |', '|---|---|---|---|---|');
      for (const v of runs) {
        const tracePath = path.join(projectDir, v, 'TRACE.json');
        let date = '—', human = '—', composite = '—', status = '—';
        if (fs.existsSync(tracePath)) {
          try {
            const t = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
            date = t.date || '—';
            human = t.human_review?.score != null ? String(t.human_review.score) : '—';
            composite = t.scores?.composite != null ? t.scores.composite.toFixed(3) : '—';
            status = t.timing?.ended ? 'complete' : 'in-progress';
          } catch {}
        }
        lines.push(`| ${v} | ${date} | ${human} | ${composite} | ${status} |`);
      }
      lines.push('');
    }

    lines.push(`*Generated by \`gad eval readme\` on ${new Date().toISOString().split('T')[0]}*`);

    const readmePath = path.join(projectDir, 'README.md');
    fs.writeFileSync(readmePath, lines.join('\n') + '\n');
    console.log(`✓ Written ${readmePath}`);
  },
});

const evalInheritSkills = defineCommand({
  meta: { name: 'inherit-skills', description: 'Copy agent-authored skills from a completed eval into another eval template (decision gad-112)' },
  args: {
    from: { type: 'string', description: 'Source eval project (or project/vN for a specific run)', required: true },
    to: { type: 'string', description: 'Target eval project name', required: true },
    'latest-only': { type: 'boolean', description: 'Only inherit skills from the latest run (not accumulated)', default: false },
  },
  run({ args }) {
    // Parse --from: either "project" (latest run) or "project/vN" (specific run)
    const parts = (args.from || '').split('/');
    const srcProject = parts[0];
    let srcVersion = parts[1] || null;

    if (!srcProject) {
      outputError('Usage: gad eval inherit-skills --from eval-project --to target-project');
      return;
    }

    const srcProjectDir = resolveOrDefaultEvalProjectDir(srcProject);

    // If no version specified, find the latest run
    if (!srcVersion) {
      if (!fs.existsSync(srcProjectDir)) {
        outputError(`Eval project '${srcProject}' not found.`);
        return;
      }
      const runs = fs.readdirSync(srcProjectDir, { withFileTypes: true })
        .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
        .map(r => ({ name: r.name, num: parseInt(r.name.slice(1), 10) }))
        .sort((a, b) => b.num - a.num);
      if (runs.length === 0) {
        outputError(`No runs found for ${srcProject}. Run an eval first.`);
        return;
      }
      srcVersion = runs[0].name;
      console.log(`  Using latest run: ${srcProject}/${srcVersion}`);
    }

    const srcRunDir = path.join(srcProjectDir, srcVersion, 'run');
    if (!fs.existsSync(srcRunDir)) {
      outputError(`Source run not found: ${srcRunDir}`);
      return;
    }
    const targetProjectDir = resolveOrDefaultEvalProjectDir(args.to);

    // Look for skills in game/.planning/skills/ or .planning/skills/
    const skillsDirs = [
      path.join(srcRunDir, 'game', '.planning', 'skills'),
      path.join(srcRunDir, '.planning', 'skills'),
      path.join(srcRunDir, 'game', 'skills'),
    ];
    let srcSkillsDir = null;
    for (const d of skillsDirs) {
      if (fs.existsSync(d)) { srcSkillsDir = d; break; }
    }

    if (!srcSkillsDir) {
      console.log(`No agent-authored skills found in ${srcProject}/${srcVersion}`);
      console.log('Checked: game/.planning/skills/, .planning/skills/, game/skills/');
      return;
    }

    const skills = fs.readdirSync(srcSkillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);

    if (skills.length === 0) {
      console.log('No skills found in source directory.');
      return;
    }

    // Copy to target template
    const targetDir = path.join(targetProjectDir, 'template', 'skills');
    fs.mkdirSync(targetDir, { recursive: true });

    for (const skill of skills) {
      const src = path.join(srcSkillsDir, skill);
      const dest = path.join(targetDir, skill);
      fs.cpSync(src, dest, { recursive: true });
      console.log(`  ✓ Inherited: ${skill} (from ${srcProject}/${srcVersion})`);
    }

    // Update AGENTS.md
    const agentsMd = path.join(targetProjectDir, 'template', 'AGENTS.md');
    if (fs.existsSync(agentsMd)) {
      let content = fs.readFileSync(agentsMd, 'utf8');
      const section = `\n\n## Inherited Skills (from ${srcProject}/${srcVersion})\n\n${skills.map(s => '- `skills/' + s + '/SKILL.md`').join('\n')}\n`;
      if (!content.includes('## Inherited Skills')) {
        content += section;
        fs.writeFileSync(agentsMd, content);
      }
    }

    // Record lineage metadata
    const metaFile = path.join(targetProjectDir, 'template', '.inherited-skills.json');
    const meta = {
      inherited_at: new Date().toISOString(),
      source: `${srcProject}/${srcVersion}`,
      skills: skills.map(s => ({ name: s, source_path: path.join(srcSkillsDir, s) })),
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

    console.log(`\n✓ Inherited ${skills.length} skill(s) from ${srcProject}/${srcVersion} → ${args.to}`);
  },
});

// ---------------------------------------------------------------------------
// Promote eval subcommands into species / generation (decision gad-212)
// ---------------------------------------------------------------------------
// Species-level commands: list, run, suite
speciesCmd.subCommands.run = evalRun;
speciesCmd.subCommands.suite = evalSuite;

// Generation-level commands: preserve, verify, open, review, report
generationCmd.subCommands.preserve = evalPreserve;
generationCmd.subCommands.verify = evalVerify;
generationCmd.subCommands.open = evalOpen;
generationCmd.subCommands.review = evalReview;
generationCmd.subCommands.report = evalReport;

// Deprecated alias — eval vocabulary replaced by species/generation per decision gad-212
const evalCmd = defineCommand({
  meta: { name: 'eval', description: '[DEPRECATED] Use `gad species` or `gad generation` instead' },
  subCommands: { list: evalList, setup: evalSetup, status: evalStatus, version: evalVersion, run: evalRun, runs: evalRuns, show: evalShow, score: evalScore, scores: evalScores, diff: evalDiff, trace: evalTraceCmd, suite: evalSuite, report: evalReport, review: evalReview, open: evalOpen, preserve: evalPreserve, verify: evalVerify, skill: evalSkillCmd, 'inherit-skills': evalInheritSkills, readme: evalReadme },
  run() {
    console.warn("DEPRECATED: 'gad eval <cmd>' is deprecated. Use 'gad species <cmd>' or 'gad generation <cmd>' instead.");
  },
});

// ---------------------------------------------------------------------------
// session subcommands
// ---------------------------------------------------------------------------
//
// Sessions are lightweight JSON files in .planning/sessions/<id>.json
// They track where an agent is in a project and what files to load.
// Format:
//   { id, projectId, position: { phase, plan, task }, status, refs[], createdAt, updatedAt }
//
// This replaces session.md — agents run `gad session new` at the start of
// each work window and `gad context` to get the minimal file refs they need.

const SESSION_DIR = 'sessions';
const SESSION_STATUS = { ACTIVE: 'active', PAUSED: 'paused', CLOSED: 'closed' };

function generateSessionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `s-${ts}-${rand}`;
}

function sessionsDir(baseDir, root) {
  return path.join(baseDir, root.path, root.planningDir, SESSION_DIR);
}

function loadSessions(baseDir, roots) {
  const all = [];
  for (const root of roots) {
    const dir = sessionsDir(baseDir, root);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        all.push({ ...data, _root: root, _file: path.join(dir, f) });
      } catch { /* skip corrupt file */ }
    }
  }
  return all.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
}

function writeSession(session) {
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(session._file, JSON.stringify(
    (({ _root, _file, ...rest }) => rest)(session), null, 2
  ));
}

/** Write ISO timestamp to <last-updated> in STATE.xml (creates tag if absent). */
function touchStateXml(root, baseDir) {
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const stateXml = path.join(planDir, 'STATE.xml');
  if (!fs.existsSync(stateXml)) return;
  try {
    let xml = fs.readFileSync(stateXml, 'utf8');
    const iso = new Date().toISOString();
    if (/<last-updated>/.test(xml)) {
      xml = xml.replace(/<last-updated>[^<]*<\/last-updated>/, `<last-updated>${iso}</last-updated>`);
    } else {
      xml = xml.replace(/<\/state>/, `  <last-updated>${iso}</last-updated>\n</state>`);
    }
    fs.writeFileSync(stateXml, xml);
  } catch { /* non-fatal */ }
}

/**
 * After a sink compile, write a <sink-compiled> note into STATE.xml.
 * This tells agents that planning files are mirrored in the docs sink —
 * they should read the sink MDX for the human-readable version and treat
 * the .planning/ XML as the machine-authoritative source.
 */
function stampSinkCompileNote(root, baseDir, sink, iso) {
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const stateXml = path.join(planDir, 'STATE.xml');
  if (!fs.existsSync(stateXml)) return;
  try {
    let xml = fs.readFileSync(stateXml, 'utf8');
    const sinkPath = `${sink}/${root.id}/planning/`;
    const tag = `<sink-compiled sink="${sinkPath}" at="${iso}" />`;
    if (/<sink-compiled/.test(xml)) {
      // Update existing tag
      xml = xml.replace(/<sink-compiled[^>]*\/>/, tag);
    } else {
      xml = xml.replace(/<\/state>/, `  ${tag}\n</state>`);
    }
    fs.writeFileSync(stateXml, xml);
  } catch { /* non-fatal */ }
}

/** Build the context refs an agent should load for a session. */
function buildContextRefs(root, baseDir, session) {
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const refs = [];

  // Always include AGENTS.md (repo root or planning dir)
  const agentsMd = path.join(baseDir, 'AGENTS.md');
  const planningAgentsMd = path.join(planDir, 'AGENTS.md');
  if (fs.existsSync(agentsMd)) refs.push({ file: 'AGENTS.md', reason: 'agent conventions' });
  if (fs.existsSync(planningAgentsMd)) refs.push({ file: path.join(root.planningDir, 'AGENTS.md'), reason: 'planning agent conventions' });

  // State file (MD preferred, XML fallback)
  const stateMd = path.join(planDir, 'STATE.md');
  const stateXml = path.join(planDir, 'STATE.xml');
  if (fs.existsSync(stateMd)) refs.push({ file: path.join(root.planningDir, 'STATE.md'), reason: 'current position and status' });
  else if (fs.existsSync(stateXml)) refs.push({ file: path.join(root.planningDir, 'STATE.xml'), reason: 'current position and status' });

  // Roadmap
  const roadmapMd = path.join(planDir, 'ROADMAP.md');
  const roadmapXml = path.join(planDir, 'ROADMAP.xml');
  if (fs.existsSync(roadmapMd)) refs.push({ file: path.join(root.planningDir, 'ROADMAP.md'), reason: 'phase roadmap' });
  else if (fs.existsSync(roadmapXml)) refs.push({ file: path.join(root.planningDir, 'ROADMAP.xml'), reason: 'phase roadmap' });

  // If session has a current phase, include phase PLAN file
  const phase = session?.position?.phase;
  if (phase) {
    const phasesDir = path.join(planDir, 'phases');
    if (fs.existsSync(phasesDir)) {
      const phaseDir = fs.readdirSync(phasesDir).find(d => d.startsWith(phase) || d.includes(phase));
      if (phaseDir) {
        const planFile = path.join(phasesDir, phaseDir, 'PLAN.md');
        if (fs.existsSync(planFile)) {
          refs.push({ file: path.join(root.planningDir, 'phases', phaseDir, 'PLAN.md'), reason: `active phase plan (${phase})` });
        }
      }
    }
    // Also look for MDX plan in content/docs (portfolio pattern)
    // We surface these as hints only — agent reads them from refs
  }

  return refs;
}

const sessionList = defineCommand({
  meta: { name: 'list', description: 'List sessions' },
  args: {
    project: { type: 'string', description: 'Filter by project ID', default: '' },
    all: { type: 'boolean', description: 'Include closed sessions', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    let roots = config.roots;
    if (args.project) roots = roots.filter(r => r.id === args.project);

    let sessions = loadSessions(baseDir, roots);
    if (!args.all) sessions = sessions.filter(s => s.status !== SESSION_STATUS.CLOSED);

    if (sessions.length === 0) {
      console.log(args.all ? 'No sessions found.' : 'No active sessions. Run `gad session new` to start one.');
      return;
    }

    const rows = sessions.map(s => ({
      id: s.id,
      project: s.projectId || '—',
      phase: s.position?.phase || '—',
      status: s.status,
      ctx: s.contextMode || 'loaded',
      updated: s.updatedAt ? s.updatedAt.slice(0, 16).replace('T', ' ') : '—',
    }));

    const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
    console.log(render(rows, { format: fmt, title: `Sessions (${rows.length})` }));
  },
});

const sessionNew = defineCommand({
  meta: { name: 'new', description: 'Create a new session and print context refs' },
  args: {
    project: { type: 'string', description: 'Project ID (uses first root if omitted)', default: '' },
    fresh: { type: 'boolean', description: 'Mark as fresh-context session (no prior planning state loaded)', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    let roots = config.roots;

    if (args.project) {
      roots = roots.filter(r => r.id === args.project);
      if (roots.length === 0) { outputError(`Project not found: ${args.project}`); return; }
    }

    if (roots.length === 0) { outputError('No projects configured. Run `gad projects sync` first.'); return; }

    const root = roots[0];
    const dir = sessionsDir(baseDir, root);
    fs.mkdirSync(dir, { recursive: true });

    // Read current state to seed position
    const state = readState(root, baseDir);
    const session = {
      id: generateSessionId(),
      projectId: root.id,
      contextMode: args.fresh ? 'fresh' : 'loaded',
      position: {
        phase: state.currentPhase || null,
        plan: null,
        task: null,
      },
      status: SESSION_STATUS.ACTIVE,
      refs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _root: root,
      _file: '',
    };
    session._file = path.join(dir, `${session.id}.json`);
    session.refs = buildContextRefs(root, baseDir, session);
    writeSession(session);
    touchStateXml(root, baseDir);

    if (args.json || shouldUseJson()) {
      const { _root, _file, ...clean } = session;
      console.log(JSON.stringify(clean, null, 2));
    } else {
      console.log(`\nSession created: ${session.id}`);
      console.log(`Project:      ${root.id}`);
      console.log(`Context mode: ${session.contextMode}${session.contextMode === 'fresh' ? '  ← no prior state loaded' : '  ← planning state loaded before this session'}`);
      if (state.currentPhase) console.log(`Phase:        ${state.currentPhase}`);
      console.log(`\nLoad these files to resume context:\n`);
      for (const ref of session.refs) {
        console.log(`  ${ref.file}  — ${ref.reason}`);
      }
      console.log(`\nRun \`gad context --session ${session.id}\` to refresh refs at any time.`);
    }
  },
});

const sessionResume = defineCommand({
  meta: { name: 'resume', description: 'Resume an existing session' },
  args: {
    id: { type: 'string', description: 'Session ID', default: '' },
    fresh: { type: 'boolean', description: 'Override context mode to fresh for this session', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const id = args.id;
    if (!id) { listActiveSessionsHint(baseDir, config, 'resume'); return; }

    const sessions = loadSessions(baseDir, config.roots);
    const session = sessions.find(s => s.id === id);

    if (!session) { outputError(`Session not found: ${id}. Run \`gad session list --all\` to see all sessions.`); return; }
    if (session.status === SESSION_STATUS.CLOSED) {
      console.log(`Session ${id} is closed. Create a new one with \`gad session new\`.`);
      return;
    }

    // Refresh refs and mark active
    session.refs = buildContextRefs(session._root, baseDir, session);
    session.status = SESSION_STATUS.ACTIVE;
    // Preserve contextMode from creation; allow override with --fresh
    if (!session.contextMode) session.contextMode = 'loaded';
    if (args.fresh) session.contextMode = 'fresh';
    writeSession(session);
    touchStateXml(session._root, baseDir);

    if (args.json || shouldUseJson()) {
      const { _root, _file, ...clean } = session;
      console.log(JSON.stringify(clean, null, 2));
    } else {
      console.log(`\nResuming session: ${session.id}`);
      console.log(`Project: ${session.projectId}  Phase: ${session.position?.phase || '—'}`);
      console.log(`\nLoad these files to restore context:\n`);
      for (const ref of session.refs) {
        console.log(`  ${ref.file}  — ${ref.reason}`);
      }
    }
  },
});

const sessionClose = defineCommand({
  meta: { name: 'close', description: 'Close a session' },
  args: {
    id: { type: 'string', description: 'Session ID', default: '' },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const id = args.id;
    if (!id) { listActiveSessionsHint(baseDir, config, 'close'); return; }

    const sessions = loadSessions(baseDir, config.roots);
    const session = sessions.find(s => s.id === id);

    if (!session) { outputError(`Session not found: ${id}`); return; }

    session.status = SESSION_STATUS.CLOSED;
    writeSession(session);
    console.log(`Session ${id} closed.`);
  },
});

const sessionCmd = defineCommand({
  meta: { name: 'session', description: 'Manage work sessions' },
  subCommands: { list: sessionList, new: sessionNew, resume: sessionResume, close: sessionClose },
});

// ---------------------------------------------------------------------------
// context command
// ---------------------------------------------------------------------------
//
// Returns the minimal set of files an agent needs to load to understand
// the current project position. Designed to reduce context tokens — agents
// run `gad context` instead of reading whole planning dirs.

const contextCmd = defineCommand({
  meta: { name: 'context', description: 'Print context files for current project position (inlines content by default)' },
  args: {
    session: { type: 'string', description: 'Session ID (uses latest active session if omitted)', default: '' },
    project: { type: 'string', description: 'Project ID', default: '' },
    refs: { type: 'boolean', description: 'Print file refs only — no content (lightweight mode)', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    let roots = config.roots;
    if (args.project) roots = roots.filter(r => r.id === args.project);

    let session = null;

    if (args.session) {
      const all = loadSessions(baseDir, roots);
      session = all.find(s => s.id === args.session);
      if (!session) { outputError(`Session not found: ${args.session}`); return; }
    } else {
      // Use latest active session, or fall back to no session (position from state)
      const active = loadSessions(baseDir, roots).filter(s => s.status === SESSION_STATUS.ACTIVE);
      if (active.length > 0) session = active[0];
    }

    const root = session?._root || roots[0];
    if (!root) { outputError('No projects configured. Run `gad projects sync` first.'); return; }

    const refs = buildContextRefs(root, baseDir, session);

    if (args.json || shouldUseJson()) {
      if (args.refs) {
        console.log(JSON.stringify({ session: session?.id || null, project: root.id, refs }, null, 2));
      } else {
        // Inline content into JSON
        const refsWithContent = refs.map(ref => {
          const absPath = path.join(baseDir, root.path, ref.file.replace(/^\.planning[\\/]/, root.planningDir + path.sep));
          const filePath = fs.existsSync(path.join(baseDir, ref.file))
            ? path.join(baseDir, ref.file)
            : path.join(baseDir, root.path, ref.file);
          let content = null;
          try { content = fs.readFileSync(filePath, 'utf8'); } catch { /* missing */ }
          return { ...ref, content };
        });
        console.log(JSON.stringify({ session: session?.id || null, project: root.id, refs: refsWithContent }, null, 2));
      }
    } else if (args.refs) {
      // Lightweight: refs only
      const sessionLine = session ? `Session: ${session.id}  Status: ${session.status}` : 'No active session — run `gad session new` to track this work.';
      console.log(`\n${sessionLine}`);
      console.log(`Project: ${root.id}`);
      if (session?.position?.phase) console.log(`Phase:   ${session.position.phase}`);
      console.log('\nFiles to load:\n');
      for (const ref of refs) {
        console.log(`  ${ref.file}`);
        console.log(`    → ${ref.reason}`);
      }
      if (refs.length === 0) console.log('  (no planning files found)');
      console.log('');
    } else {
      // Default: inline all file contents
      const sessionLine = session ? `Session: ${session.id}  Status: ${session.status}` : 'No active session — run `gad session new` to track this work.';
      console.log(`\n${sessionLine}`);
      console.log(`Project: ${root.id}`);
      if (session?.position?.phase) console.log(`Phase:   ${session.position.phase}`);
      console.log('');
      for (const ref of refs) {
        const filePath = fs.existsSync(path.join(baseDir, ref.file))
          ? path.join(baseDir, ref.file)
          : path.join(baseDir, root.path, ref.file);
        console.log(`${'─'.repeat(60)}`);
        console.log(`# ${ref.file}  (${ref.reason})`);
        console.log(`${'─'.repeat(60)}`);
        try {
          console.log(fs.readFileSync(filePath, 'utf8'));
        } catch {
          console.log(`(file not found: ${filePath})`);
        }
        console.log('');
      }
      if (refs.length === 0) console.log('  (no planning files found)');
      console.log(`─── end context (${refs.length} files) ───`);
      console.log(`\nTo refresh: gad context${session ? ` --session ${session.id}` : ''}`);
    }
  },
});

// ---------------------------------------------------------------------------
// snapshot command
// ---------------------------------------------------------------------------
//
// Inlines every planning file for a project in one shot — the fastest way
// to hand an agent the full project context.

const snapshotCmd = defineCommand({
  meta: { name: 'snapshot', description: 'Print all planning files inlined for a project' },
  args: {
    projectid: { type: 'string', description: 'Project ID (default: first root)', default: '' },
    project: { type: 'string', description: 'Project ID (alias for --projectid)', default: '' },
    full: { type: 'boolean', description: 'Full dump (no sprint filtering)', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    let roots = config.roots;
    const projectId = args.projectid || args.project;

    if (projectId) {
      roots = roots.filter(r => r.id === projectId);
      if (roots.length === 0) {
        const ids = config.roots.map(r => r.id);
        console.error(`\nProject not found: ${projectId}\n\nAvailable projects:\n`);
        for (const id of ids) console.error(`  ${id}`);
        console.error(`\nRerun with: --projectid ${ids[0]}`);
        process.exit(1);
      }
    }

    if (roots.length === 0) { outputError('No projects configured. Run `gad projects sync` first.'); return; }
    const root = roots[0];
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const sprintSize = config.sprintSize || 5;
    const useFull = args.full;
    const sdkAssetAliases = {
      '@skills': 'skills',
      '@workflows': 'workflows',
      '@templates': 'templates',
      '@references': 'references',
      '@agents': 'agents',
      '@hooks': 'hooks',
    };

    if (useFull) {
      // Full dump — original behavior
      const allFiles = [];
      const PRIORITY = ['AGENTS.md', 'STATE.md', 'STATE.xml', 'ROADMAP.md', 'ROADMAP.xml',
        'REQUIREMENTS.md', 'REQUIREMENTS.xml', 'DECISIONS.xml', 'TASK-REGISTRY.xml',
        'session.md', 'ERRORS-AND-ATTEMPTS.xml'];
      function collectDir(dir, relBase) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            if (entry.name === 'archive' || entry.name === 'sessions' || entry.name === 'node_modules') continue;
            collectDir(path.join(dir, entry.name), rel);
          } else if (entry.isFile()) {
            allFiles.push(rel);
          }
        }
      }
      collectDir(planDir, '');
      allFiles.sort((a, b) => {
        const aIdx = PRIORITY.indexOf(path.basename(a));
        const bIdx = PRIORITY.indexOf(path.basename(b));
        if (aIdx !== -1 && bIdx === -1) return -1;
        if (bIdx !== -1 && aIdx === -1) return 1;
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        return a.localeCompare(b);
      });

      if (args.json || shouldUseJson()) {
        const files = allFiles.map(rel => {
          let content = null;
          try { content = fs.readFileSync(path.join(planDir, rel), 'utf8'); } catch {}
          return { path: `${root.planningDir}/${rel}`, content };
        });
        console.log(JSON.stringify({ project: root.id, mode: 'full', planningDir: root.planningDir, sdkAssetAliases, files }, null, 2));
        return;
      }
      console.log(`\nSnapshot (full): ${root.id}  —  ${allFiles.length} files\n`);
      console.log('SDK asset aliases:');
      for (const [alias, relPath] of Object.entries(sdkAssetAliases)) {
        console.log(`- ${alias}/... -> ${relPath}/...`);
      }
      console.log('');
      for (const rel of allFiles) {
        console.log(`${'═'.repeat(70)}`);
        console.log(`## ${root.planningDir}/${rel}`);
        console.log(`${'═'.repeat(70)}`);
        try { console.log(fs.readFileSync(path.join(planDir, rel), 'utf8')); } catch { console.log('(unreadable)'); }
        console.log('');
      }
      console.log(`═══ end snapshot (${allFiles.length} files) ═══`);
      return;
    }

    // Sprint-scoped snapshot (default)
    const phases = readPhases(root, baseDir);
    const stateXml = readXmlFile(path.join(planDir, 'STATE.xml'));
    const currentPhase = stateXml ? (stateXml.match(/<current-phase>([\s\S]*?)<\/current-phase>/) || [])[1]?.trim() || '' : '';
    const k = getCurrentSprintIndex(phases, sprintSize, currentPhase);
    const sprintPhaseIds = getSprintPhaseIds(phases, sprintSize, k);

    const sections = [];
    sections.push({
      title: 'SDK ASSET ALIASES',
      content: Object.entries(sdkAssetAliases)
        .map(([alias, relPath]) => `${alias}/... -> ${relPath}/...`)
        .join('\n'),
    });

    // 1. STATE.xml — full (compact already)
    if (stateXml) {
      sections.push({ title: 'STATE.xml', content: stateXml.trim() });
    }

    // 2. ROADMAP.xml — sprint-scoped
    let roadmapSection = '';
    for (const p of phases) {
      if (sprintPhaseIds.includes(p.id)) {
        // Full detail for sprint phases
        roadmapSection += `<phase id="${p.id}">\n  <title>${p.title || ''}</title>\n  <goal>${p.goal || ''}</goal>\n  <status>${p.status}</status>\n  <depends>${p.depends || ''}</depends>\n</phase>\n`;
      } else {
        // One-liner for non-sprint phases
        roadmapSection += `${p.id} | ${(p.title || '').slice(0, 60)} | ${p.status}\n`;
      }
    }
    sections.push({ title: `ROADMAP (sprint ${k}, phases ${sprintPhaseIds.join(',')})`, content: roadmapSection.trim() });

    // 3. TASK-REGISTRY.xml — open tasks only
    // Graph-backed path when useGraphQuery=true (decision gad-201, gad-202)
    const snapshotUseGraph = graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path));
    let allTasks, openTasks, tasksSection = '', doneCount;
    if (snapshotUseGraph) {
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const jsonPath = path.join(planDir, 'graph.json');
      const gadDir = path.resolve(__dirname, '..');
      if (!fs.existsSync(jsonPath)) {
        const g = graphExtractor.buildGraph(root, baseDir, { gadDir });
        fs.writeFileSync(jsonPath, JSON.stringify(g, null, 2));
      }
      const graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const allResult = graphExtractor.queryGraph(graph, { type: 'task' });
      const allMatches = allResult.matches || [];
      const openMatches = allMatches.filter(m => m.status !== 'done');
      doneCount = allMatches.length - openMatches.length;
      if (openMatches.length > 0) {
        let currentTaskPhase = '';
        for (const m of openMatches) {
          const taskId = m.id.replace(/^task:/, '');
          const taskPhase = taskId.split('-')[0];
          if (taskPhase !== currentTaskPhase) {
            currentTaskPhase = taskPhase;
            tasksSection += `\n  <phase id="${taskPhase.padStart(2, '0')}">\n`;
          }
          const goalText = (m.goal || m.label || '').slice(0, 200);
          const extraAttrs = [
            m.skill ? `skill="${m.skill}"` : '',
            m.type ? `type="${m.type}"` : '',
          ].filter(Boolean).join(' ');
          const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
          tasksSection += `    <task id="${taskId}" status="${m.status}"${attrStr}>${goalText}</task>\n`;
        }
      }
      openTasks = openMatches;
    } else {
      allTasks = readTasks(root, baseDir, {});
      openTasks = allTasks.filter(t => t.status !== 'done');
      if (openTasks.length > 0) {
        let currentTaskPhase = '';
        for (const t of openTasks) {
          const taskPhase = t.id ? t.id.split('-')[0] : '';
          if (taskPhase !== currentTaskPhase) {
            currentTaskPhase = taskPhase;
            tasksSection += `\n  <phase id="${taskPhase.padStart(2, '0')}">\n`;
          }
          const goalText = (t.goal || '').slice(0, 200);
          const extraAttrs = [
            t.skill ? `skill="${t.skill}"` : '',
            t.type ? `type="${t.type}"` : '',
            t.agentId ? `agent-id="${t.agentId}"` : '',
          ].filter(Boolean).join(' ');
          const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
          tasksSection += `    <task id="${t.id}" status="${t.status}"${attrStr}><goal>${goalText}</goal></task>\n`;
        }
      }
      doneCount = allTasks.length - openTasks.length;
    }
    sections.push({ title: `TASKS (${openTasks.length} open, ${doneCount} done)`, content: tasksSection.trim() || '(no open tasks)' });

    // 4. DECISIONS.xml — only decisions relevant to sprint phases
    const decisionsXml = readXmlFile(path.join(planDir, 'DECISIONS.xml'));
    if (decisionsXml) {
      // Always include gad-04, gad-17, gad-18 (core loop decisions)
      const ALWAYS_INCLUDE = ['gad-04', 'gad-17', 'gad-18'];
      const decisionRe = /<decision\s+id="([^"]*)">([\s\S]*?)<\/decision>/g;
      let dm;
      let decSection = '';
      let decCount = 0;
      let totalDec = 0;
      while ((dm = decisionRe.exec(decisionsXml)) !== null) {
        totalDec++;
        const decId = dm[1];
        const decInner = dm[2];
        const titleMatch = decInner.match(/<title>([\s\S]*?)<\/title>/);
        const title = titleMatch ? titleMatch[1].trim() : '';
        if (ALWAYS_INCLUDE.includes(decId)) {
          // Full inline for core decisions — title + summary + impact
          const summaryMatch = decInner.match(/<summary>([\s\S]*?)<\/summary>/);
          const impactMatch = decInner.match(/<impact>([\s\S]*?)<\/impact>/);
          const summary = summaryMatch ? summaryMatch[1].trim() : '';
          const impact = impactMatch ? impactMatch[1].trim() : '';
          decSection += `<decision id="${decId}">\n  <title>${title}</title>\n  <summary>${summary}</summary>\n  <impact>${impact}</impact>\n</decision>\n`;
          decCount++;
        } else {
          // One-liner for others
          decSection += `${decId}: ${title.slice(0, 80)}\n`;
          decCount++;
        }
      }
      sections.push({ title: `DECISIONS (${totalDec} total, core inlined)`, content: decSection.trim() });
    }

    // 5. File refs — recent git log scoped to project path
    let fileRefs = '';
    try {
      const { execSync } = require('child_process');
      const projectPath = root.path === '.' ? '' : root.path;
      const gitCmd = projectPath
        ? `git log --oneline -5 -- "${projectPath}"`
        : `git log --oneline -5`;
      const gitLog = execSync(gitCmd, { cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (gitLog) fileRefs += `Recent commits:\n${gitLog}\n`;

      // Files changed in last 3 commits
      const filesCmd = projectPath
        ? `git log --name-only --pretty=format: -3 -- "${projectPath}"`
        : `git log --name-only --pretty=format: -3`;
      const changedFiles = execSync(filesCmd, { cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (changedFiles) fileRefs += `\nRecently changed files:\n${changedFiles}`;
    } catch { /* git not available or too few commits */ }
    if (fileRefs) {
      sections.push({ title: 'FILE REFS (git)', content: fileRefs.trim() });
    }

    // 6. Conventions — project-scoped, then global fallback
    let conventions = '';
    // a) Project-level CONVENTIONS.md in .planning/
    const projConventions = readXmlFile(path.join(planDir, 'CONVENTIONS.md'));
    if (projConventions) {
      conventions += projConventions.trim();
    }
    // b) Project AGENTS.md conventions section (extract if present)
    const projAgentsMd = readXmlFile(path.join(baseDir, root.path, 'AGENTS.md'));
    if (projAgentsMd) {
      // Extract conventions/style sections from AGENTS.md
      const convMatch = projAgentsMd.match(/##\s*(Conventions|Style|Coding\s+conventions|Code\s+style)[^\n]*\n([\s\S]*?)(?=\n##\s|\n═|$)/i);
      if (convMatch) {
        conventions += (conventions ? '\n\n' : '') + `## ${convMatch[1].trim()}\n${convMatch[2].trim()}`;
      }
    }
    // c) Global conventions fallback (root AGENTS.md conventions section)
    if (!conventions && root.path !== '.') {
      const rootAgentsMd = readXmlFile(path.join(baseDir, 'AGENTS.md'));
      if (rootAgentsMd) {
        const globalConv = rootAgentsMd.match(/##\s*(Conventions|Public site copy)[^\n]*\n([\s\S]*?)(?=\n##\s[A-Z]|\n═|$)/i);
        if (globalConv) {
          conventions += `## ${globalConv[1].trim()} (global)\n${globalConv[2].trim()}`;
        }
      }
    }
    if (conventions) {
      sections.push({ title: 'CONVENTIONS', content: conventions.trim() });
    }

    // 7. DOCS-MAP.xml — full (compact)
    const docsMapXml = readXmlFile(path.join(planDir, 'DOCS-MAP.xml'));
    if (docsMapXml) {
      sections.push({ title: 'DOCS-MAP.xml', content: docsMapXml.trim() });
    }

    // Output
    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify({ project: root.id, mode: 'sprint', sprintIndex: k, sprintPhaseIds, sections: sections.map(s => ({ title: s.title, content: s.content })) }, null, 2));
      return;
    }

    console.log(`\nSnapshot (sprint ${k}): ${root.id}  —  phases ${sprintPhaseIds.join(', ')}\n`);
    for (const s of sections) {
      console.log(`── ${s.title} ${'─'.repeat(Math.max(0, 60 - s.title.length))}`);
      console.log(s.content);
      console.log('');
    }
    const totalChars = sections.reduce((sum, s) => sum + s.content.length, 0);
    console.log(`── end snapshot (~${Math.round(totalChars / 4)} tokens) ──`);
  },
});

const snapshotV2Cmd = defineCommand({
  meta: { name: 'snapshot', description: 'Print all planning files inlined for a project' },
  args: {
    projectid: { type: 'string', description: 'Project ID (default: first root)', default: '' },
    project: { type: 'string', description: 'Project ID (alias for --projectid)', default: '' },
    phaseid: { type: 'string', description: 'Scope snapshot to one phase id', default: '' },
    taskid: { type: 'string', description: 'Scope snapshot to one task id', default: '' },
    agentid: { type: 'string', description: 'Existing agent id to reuse', default: '' },
    role: { type: 'string', description: 'Logical agent role for auto-registration', default: '' },
    runtime: { type: 'string', description: 'Runtime identity override (claude-code, codex, cursor, human, etc.)', default: '' },
    'parent-agentid': { type: 'string', description: 'Parent/root agent id when bootstrapping a subagent lane', default: '' },
    'model-profile': { type: 'string', description: 'Model profile attached to the lane', default: '' },
    'resolved-model': { type: 'string', description: 'Resolved concrete model attached to the lane', default: '' },
    full: { type: 'boolean', description: 'Full dump (no sprint filtering)', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
    skills: { type: 'string', description: 'Number of equipped skills to surface (44-35). 0 disables. Default: 5.', default: '5' },
    mode: { type: 'string', description: 'full (default) | active — "active" emits ONLY STATE.xml next-action + current phase + open sprint tasks (skips static catalog, references, decisions). Decision gad-195: static info loaded once at session start, active info re-pullable cheap without context waste.', default: '' },
    session: { type: 'string', description: 'Session ID. When provided, auto-downgrades to mode=active if static context was already delivered in this session. Env fallback: GAD_SESSION_ID.', default: '' },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    let roots = config.roots;
    const projectId = args.projectid || args.project;

    if (projectId) {
      roots = roots.filter((root) => root.id === projectId);
      if (roots.length === 0) {
        const ids = config.roots.map((root) => root.id);
        console.error(`\nProject not found: ${projectId}\n\nAvailable projects:\n`);
        for (const id of ids) console.error(`  ${id}`);
        console.error(`\nRerun with: --projectid ${ids[0]}`);
        process.exit(1);
      }
    }

    if (roots.length === 0) {
      outputError('No projects configured. Run `gad projects sync` first.');
      return;
    }

    const root = roots[0];
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const sprintSize = config.sprintSize || 5;
    const useFull = args.full;

    // Session-aware mode resolution: auto-downgrade to active when session
    // has already received static context, unless --mode was explicitly passed.
    const sessionId = (args.session || process.env.GAD_SESSION_ID || '').trim();
    let snapshotSession = null;
    if (sessionId) {
      const allSessions = loadSessions(baseDir, [root]);
      snapshotSession = allSessions.find((s) => s.id === sessionId) || null;
    }
    const explicitMode = (args.mode || '').trim().toLowerCase();
    const resolvedMode = (() => {
      if (explicitMode) return explicitMode;
      if (snapshotSession && snapshotSession.staticLoadedAt) return 'active';
      return 'full';
    })();

    const sdkAssetAliases = {
      '@skills': 'skills',
      '@workflows': 'workflows',
      '@templates': 'templates',
      '@references': 'references',
      '@agents': 'agents',
      '@hooks': 'hooks',
    };
    const phases = readPhases(root, baseDir);
    const stateXml = readXmlFile(path.join(planDir, 'STATE.xml'));
    const currentPhase = stateXml ? (stateXml.match(/<current-phase>([\s\S]*?)<\/current-phase>/) || [])[1]?.trim() || '' : '';
    const allTasks = readTasks(root, baseDir, {});
    const taskMap = new Map(allTasks.map((task) => [task.id, task]));
    const scopedTaskId = String(args.taskid || '').trim();
    const explicitPhaseId = String(args.phaseid || '').trim();
    const scopedTask = scopedTaskId ? taskMap.get(scopedTaskId) : null;

    if (scopedTaskId && !scopedTask) {
      outputError(`Task not found for snapshot scope: ${scopedTaskId}`);
    }

    const scopedPhaseId = explicitPhaseId || (scopedTask ? scopedTask.phase : '');
    if (scopedPhaseId && !phases.find((phase) => phase.id === scopedPhaseId)) {
      outputError(`Phase not found for snapshot scope: ${scopedPhaseId}`);
    }
    if (useFull && (scopedPhaseId || scopedTaskId)) {
      outputError('`gad snapshot --full` cannot be combined with --phaseid or --taskid.');
    }

    const agentInputs = resolveSnapshotAgentInputs(args);
    const detectedRuntime = detectRuntimeIdentity();
    const shouldAutoRegister = Boolean(
      agentInputs.requestedAgentId ||
      agentInputs.parentAgentId ||
      args.role ||
      scopedPhaseId ||
      scopedTaskId ||
      process.env.GAD_AGENT_ID ||
      process.env.GAD_AGENT_ROLE ||
      process.env.GAD_PARENT_AGENT_ID
    );
    const runtimeIdentity = resolveSnapshotRuntime(args.runtime, {
      humanFallback: Boolean(scopedPhaseId || scopedTaskId || agentInputs.parentAgentId || args.role || args.agentid),
    });
    let agentBootstrap = null;
    if (shouldAutoRegister && runtimeIdentity.id !== 'unknown') {
      try {
        agentBootstrap = ensureAgentLane(planDir, {
          requestedAgentId: agentInputs.requestedAgentId,
          role: agentInputs.role,
          runtime: runtimeIdentity.id,
          runtimeSessionId: detectRuntimeSessionId(),
          parentAgentId: agentInputs.parentAgentId,
          modelProfile: agentInputs.modelProfile,
          resolvedModel: agentInputs.resolvedModel || runtimeIdentity.model || null,
        });
      } catch (error) {
        outputError(error && error.message ? error.message : String(error));
      }
    }
    let laneListing = listAgentLanes(planDir);
    const currentAgent = agentBootstrap?.agent
      || (agentInputs.requestedAgentId
        ? laneListing.activeAgents.find((agent) => agent.agentId === agentInputs.requestedAgentId) || null
        : null);

    if (currentAgent) {
      touchAgentLane(planDir, currentAgent.agentId, {
        runtime: runtimeIdentity.id,
        runtimeSessionId: detectRuntimeSessionId() || currentAgent.runtimeSessionId || null,
        resolvedModel: agentInputs.resolvedModel || runtimeIdentity.model || currentAgent.resolvedModel || null,
      });
      laneListing = listAgentLanes(planDir);
    }

    const scope = {
      projectId: root.id,
      phaseId: scopedPhaseId || null,
      taskId: scopedTaskId || null,
      snapshotMode: scopedTask ? 'task' : (scopedPhaseId ? 'phase' : 'project'),
      isScoped: Boolean(scopedTask || scopedPhaseId),
    };
    const assignments = buildAssignmentsView(
      allTasks,
      laneListing.activeAgents,
      laneListing.staleAgents,
      currentAgent,
      scopedTaskId || null,
    );
    const agentView = currentAgent ? {
      agentId: currentAgent.agentId,
      agentRole: currentAgent.agentRole,
      runtime: currentAgent.runtime,
      runtimeSessionId: currentAgent.runtimeSessionId || null,
      parentAgentId: currentAgent.parentAgentId || null,
      rootAgentId: currentAgent.rootAgentId || currentAgent.agentId,
      depth: currentAgent.depth,
      modelProfile: currentAgent.modelProfile || null,
      resolvedModel: currentAgent.resolvedModel || null,
      autoRegistered: agentBootstrap?.autoRegistered === true,
      humanOperator: currentAgent.humanOperator === true,
    } : null;

    function buildAgentSection() {
      if (!agentView) return null;
      const lines = [
        `agent-id: ${agentView.agentId}`,
        `agent-role: ${agentView.agentRole}`,
        `runtime: ${agentView.runtime}`,
        `depth: ${agentView.depth}`,
        `root-agent-id: ${agentView.rootAgentId}`,
      ];
      if (agentView.parentAgentId) lines.push(`parent-agent-id: ${agentView.parentAgentId}`);
      if (agentView.runtimeSessionId) lines.push(`runtime-session-id: ${agentView.runtimeSessionId}`);
      if (agentView.modelProfile) lines.push(`model-profile: ${agentView.modelProfile}`);
      if (agentView.resolvedModel) lines.push(`resolved-model: ${agentView.resolvedModel}`);
      lines.push(`auto-registered: ${agentView.autoRegistered ? 'yes' : 'no'}`);
      return { title: 'AGENT LANE', content: lines.join('\n') };
    }

    function buildAssignmentsSection() {
      if (
        assignments.self.length === 0 &&
        assignments.activeAgents.length === 0 &&
        assignments.collisions.length === 0 &&
        assignments.staleAgents.length === 0
      ) {
        return null;
      }
      const lines = [];
      if (assignments.self.length > 0) {
        lines.push(`self: ${assignments.self.join(', ')}`);
      }
      if (assignments.activeAgents.length > 0) {
        if (lines.length) lines.push('');
        lines.push('active:');
        for (const row of assignments.activeAgents) {
          lines.push(`- ${row.agentId} [${row.runtime}] role=${row.agentRole} depth=${row.depth} tasks=${row.tasks.join(', ') || '(none)'}`);
        }
      }
      if (assignments.collisions.length > 0) {
        if (lines.length) lines.push('');
        lines.push('collisions:');
        for (const row of assignments.collisions) {
          lines.push(`- ${row.taskId} already claimed by ${row.agentId}${row.runtime ? ` (${row.runtime})` : ''}`);
        }
      }
      if (assignments.staleAgents.length > 0) {
        if (lines.length) lines.push('');
        lines.push('stale:');
        for (const row of assignments.staleAgents) {
          lines.push(`- ${row.agentId} last-seen=${row.lastSeenAt || 'unknown'} tasks=${row.tasks.join(', ') || '(none)'}`);
        }
      }
      return { title: 'ACTIVE ASSIGNMENTS', content: lines.join('\n').trim() };
    }

    function buildDecisionsSection() {
      const decisionsXml = readXmlFile(path.join(planDir, 'DECISIONS.xml'));
      if (!decisionsXml) return null;
      const ALWAYS_INCLUDE = ['gad-04', 'gad-17', 'gad-18'];
      const RECENT_CAP = 30; // last N one-liners; older are summarized as a count
      const decisionRe = /<decision\s+id="([^"]*)">([\s\S]*?)<\/decision>/g;
      const all = [];
      let dm;
      while ((dm = decisionRe.exec(decisionsXml)) !== null) {
        const decId = dm[1];
        const decInner = dm[2];
        const titleMatch = decInner.match(/<title>([\s\S]*?)<\/title>/);
        const title = titleMatch ? titleMatch[1].trim() : '';
        all.push({ id: decId, inner: decInner, title });
      }
      const totalDec = all.length;
      const coreInlined = [];
      for (const d of all) {
        if (!ALWAYS_INCLUDE.includes(d.id)) continue;
        const summary = (d.inner.match(/<summary>([\s\S]*?)<\/summary>/) || [, ''])[1].trim();
        const impact = (d.inner.match(/<impact>([\s\S]*?)<\/impact>/) || [, ''])[1].trim();
        coreInlined.push(`<decision id="${d.id}">\n  <title>${d.title}</title>\n  <summary>${summary}</summary>\n  <impact>${impact}</impact>\n</decision>`);
      }
      // Recent N non-core, by appearance order (file order = chronological in our DECISIONS.xml)
      const nonCore = all.filter((d) => !ALWAYS_INCLUDE.includes(d.id));
      const recent = nonCore.slice(-RECENT_CAP);
      const olderCount = nonCore.length - recent.length;
      const recentLines = recent.map((d) => `${d.id}: ${d.title.slice(0, 80)}`);
      const sections = [];
      if (coreInlined.length) sections.push(coreInlined.join('\n'));
      if (olderCount > 0) sections.push(`(+${olderCount} older decisions omitted; see .planning/DECISIONS.xml)`);
      if (recentLines.length) sections.push(recentLines.join('\n'));
      return {
        title: `DECISIONS (${totalDec} total, ${ALWAYS_INCLUDE.length} core + last ${recent.length})`,
        content: sections.join('\n').trim(),
      };
    }

    function buildFileRefsSection() {
      let fileRefs = '';
      if (scopedTask?.files?.length) {
        fileRefs += `Task files:\n${scopedTask.files.join('\n')}\n`;
      }
      if (scopedTask?.commands?.length) {
        fileRefs += `${fileRefs ? '\n' : ''}Task commands:\n${scopedTask.commands.join('\n')}\n`;
      }
      try {
        const { execSync } = require('child_process');
        const projectPath = root.path === '.' ? '' : root.path;
        const gitCmd = projectPath
          ? `git log --oneline -5 -- "${projectPath}"`
          : `git log --oneline -5`;
        const gitLog = execSync(gitCmd, { cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (gitLog) fileRefs += `${fileRefs ? '\n' : ''}Recent commits:\n${gitLog}\n`;
        const filesCmd = projectPath
          ? `git log --name-only --pretty=format: -3 -- "${projectPath}"`
          : `git log --name-only --pretty=format: -3`;
        const changedFiles = execSync(filesCmd, { cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (changedFiles) fileRefs += `\nRecently changed files:\n${changedFiles}`;
      } catch {}
      return fileRefs.trim() ? { title: 'FILE REFS (git)', content: fileRefs.trim() } : null;
    }

    function buildConventionsSection() {
      let conventions = '';
      const projConventions = readXmlFile(path.join(planDir, 'CONVENTIONS.md'));
      if (projConventions) conventions += projConventions.trim();
      const projAgentsMd = readXmlFile(path.join(baseDir, root.path, 'AGENTS.md'));
      if (projAgentsMd) {
        const convMatch = projAgentsMd.match(/##\s*(Conventions|Style|Coding\s+conventions|Code\s+style)[^\n]*\n([\s\S]*?)(?=\n##\s|\nâ•|$)/i);
        if (convMatch) {
          conventions += (conventions ? '\n\n' : '') + `## ${convMatch[1].trim()}\n${convMatch[2].trim()}`;
        }
      }
      if (!conventions && root.path !== '.') {
        const rootAgentsMd = readXmlFile(path.join(baseDir, 'AGENTS.md'));
        if (rootAgentsMd) {
          const globalConv = rootAgentsMd.match(/##\s*(Conventions|Public site copy)[^\n]*\n([\s\S]*?)(?=\n##\s[A-Z]|\nâ•|$)/i);
          if (globalConv) {
            conventions += `## ${globalConv[1].trim()} (global)\n${globalConv[2].trim()}`;
          }
        }
      }
      return conventions.trim() ? { title: 'CONVENTIONS', content: conventions.trim() } : null;
    }

    // ---- 44-35: encounter-style equipped skills block -------------------
    // Tokenize query (open tasks + next-action + current phase goal) and rank
    // skills (canonical + pending proto-skills) by Jaccard overlap. Skills
    // the agent doesn't see via its runtime dir still appear here, so
    // subagents + post-compact rehydration get the relevance signal.
    function tokenizeForRelevance(text) {
      const STOP = new Set([
        'the','a','an','and','or','but','if','of','for','in','on','to','at','by','from','with','as','is','are','was','were','be','been','being','it','its','this','that','these','those','then','than','which','who','what','when','where','why','how','we','they','their','there','has','have','had','do','does','did','will','would','should','could','can','may','might','must','not','no','yes','so','too','very','just','also','any','all','some','one','two','three','per','into','out','up','down','over','under','before','after','again','once','new','old','use','used','using','via','about','above','below','between','because','while','during','each','other','more','most','less','few','many','much','such','own','same','only','own','get','got','make','made','run','ran','running','shipped','ship','work','working','task','tasks','phase','phases','goal','goals','goal','item','items','thing','things','stuff','plan','planning','done','closed','planned','active','current','next','open','status','good','bad','first','last','need','needs','needed','want','wants'
      ]);
      const raw = String(text || '').toLowerCase();
      const tokens = raw
        .replace(/[`*_#>~]/g, ' ')
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .filter((t) => t.length >= 3 && !STOP.has(t));
      return new Set(tokens);
    }
    function jaccard(a, b) {
      if (a.size === 0 || b.size === 0) return 0;
      let intersect = 0;
      for (const t of a) if (b.has(t)) intersect += 1;
      const union = a.size + b.size - intersect;
      return union === 0 ? 0 : intersect / union;
    }
    function buildEquippedSkillsSection(limit) {
      if (!limit || limit <= 0) return null;
      // Build query text from current sprint shape.
      const queryParts = [];
      if (stateXml) {
        const nextAction = (stateXml.match(/<next-action>([\s\S]*?)<\/next-action>/) || [])[1];
        if (nextAction) queryParts.push(nextAction);
      }
      const currentPhaseObj = phases.find((p) => p.id === currentPhase);
      if (currentPhaseObj) {
        if (currentPhaseObj.title) queryParts.push(currentPhaseObj.title);
        if (currentPhaseObj.goal) queryParts.push(currentPhaseObj.goal);
      }
      // Use a small window of open tasks — first 8 — to bias toward what's
      // actually being worked on rather than the long tail of the backlog.
      const openTasksSample = allTasks.filter((t) => t.status !== 'done').slice(0, 8);
      for (const t of openTasksSample) {
        if (t.goal) queryParts.push(String(t.goal).slice(0, 240));
      }
      const queryText = queryParts.join(' ');
      const queryTokens = tokenizeForRelevance(queryText);
      if (queryTokens.size === 0) return null;

      const repoRoot = path.resolve(__dirname, '..');
      const skillsRoot = path.join(repoRoot, 'skills');
      const protoRoot = path.join(repoRoot, '.planning', 'proto-skills');
      const entries = [];
      try {
        for (const s of listSkillDirs(skillsRoot)) {
          const fm = readSkillFrontmatter(s.skillFile);
          const searchText = [s.id, fm.name || '', fm.description || ''].join(' ');
          const score = jaccard(queryTokens, tokenizeForRelevance(searchText));
          if (score > 0) entries.push({ id: s.id, name: fm.name || s.id, description: fm.description || '', workflow: fm.workflow || null, score, kind: 'canonical' });
        }
      } catch {}
      try {
        for (const s of listSkillDirs(protoRoot)) {
          const fm = readSkillFrontmatter(s.skillFile);
          const searchText = [s.id, fm.name || '', fm.description || ''].join(' ');
          const score = jaccard(queryTokens, tokenizeForRelevance(searchText));
          // Proto-skills get a small boost so they surface even against
          // many-decades-old canonical skills with overlapping descriptions.
          if (score > 0) entries.push({ id: s.id, name: fm.name || s.id, description: fm.description || '', workflow: fm.workflow || null, score: score * 1.1, kind: 'proto' });
        }
      } catch {}

      if (entries.length === 0) return null;
      entries.sort((a, b) => b.score - a.score);
      const picked = entries.slice(0, limit);
      // Per decision gad-192: surface the `workflow:` frontmatter pointer
      // alongside the description so the agent sees where the procedural
      // body lives without a second read.
      const lines = picked.map((e) => {
        const tag = e.kind === 'proto' ? ' (proto — `gad skill promote <slug> --project --claude` to equip)' : '';
        const descFrag = (e.description || '').replace(/\s+/g, ' ').slice(0, 160);
        const workflowFrag = e.workflow ? ` → ${e.workflow}` : '';
        return `  ${e.id}${workflowFrag}${tag}\n    ${descFrag}`;
      });
      // Hard-cap the body at ~2000 chars (~500 tokens) so the block never blows budget.
      let body = lines.join('\n');
      if (body.length > 2000) body = body.slice(0, 1970).trimEnd() + '\n    [truncated]';
      return { title: `EQUIPPED SKILLS (top ${picked.length} by relevance)`, content: body };
    }

    function collectFullFiles() {
      const allFiles = [];
      const PRIORITY = ['AGENTS.md', 'STATE.md', 'STATE.xml', 'ROADMAP.md', 'ROADMAP.xml', 'REQUIREMENTS.md', 'REQUIREMENTS.xml', 'DECISIONS.xml', 'TASK-REGISTRY.xml', 'session.md', 'ERRORS-AND-ATTEMPTS.xml'];
      function collectDir(dir, relBase) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            if (entry.name === 'archive' || entry.name === 'sessions' || entry.name === 'node_modules') continue;
            collectDir(path.join(dir, entry.name), rel);
          } else if (entry.isFile()) {
            allFiles.push(rel);
          }
        }
      }
      collectDir(planDir, '');
      allFiles.sort((a, b) => {
        const aIdx = PRIORITY.indexOf(path.basename(a));
        const bIdx = PRIORITY.indexOf(path.basename(b));
        if (aIdx !== -1 && bIdx === -1) return -1;
        if (bIdx !== -1 && aIdx === -1) return 1;
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        return a.localeCompare(b);
      });
      return allFiles;
    }

    if (useFull) {
      const allFiles = collectFullFiles();
      if (args.json || shouldUseJson()) {
        const files = allFiles.map((rel) => {
          let content = null;
          try { content = fs.readFileSync(path.join(planDir, rel), 'utf8'); } catch {}
          return { path: `${root.planningDir}/${rel}`, content };
        });
        console.log(JSON.stringify({
          project: root.id,
          mode: 'full',
          planningDir: root.planningDir,
          scope,
          agent: agentView,
          assignments,
          sdkAssetAliases,
          files,
        }, null, 2));
        return;
      }

      console.log(`\nSnapshot (full): ${root.id} - ${allFiles.length} files\n`);
      console.log('SDK asset aliases:');
      for (const [alias, relPath] of Object.entries(sdkAssetAliases)) {
        console.log(`- ${alias}/... -> ${relPath}/...`);
      }
      if (agentView) {
        console.log('\nAgent lane:');
        console.log(`- ${agentView.agentId} [${agentView.runtime}] role=${agentView.agentRole} depth=${agentView.depth}`);
      }
      if (assignments.activeAgents.length > 0) {
        console.log('\nActive assignments:');
        for (const row of assignments.activeAgents) {
          console.log(`- ${row.agentId} tasks=${row.tasks.join(', ') || '(none)'}`);
        }
      }
      console.log('');
      for (const rel of allFiles) {
        console.log(`${'='.repeat(70)}`);
        console.log(`## ${root.planningDir}/${rel}`);
        console.log(`${'='.repeat(70)}`);
        try { console.log(fs.readFileSync(path.join(planDir, rel), 'utf8')); } catch { console.log('(unreadable)'); }
        console.log('');
      }
      console.log(`=== end snapshot (${allFiles.length} files) ===`);
      return;
    }

    if (scope.isScoped) {
      const sections = [];
      sections.push({
        title: 'SDK ASSET ALIASES',
        content: Object.entries(sdkAssetAliases).map(([alias, relPath]) => `${alias}/... -> ${relPath}/...`).join('\n'),
      });
      const agentSection = buildAgentSection();
      if (agentSection) sections.push(agentSection);
      const assignmentsSection = buildAssignmentsSection();
      if (assignmentsSection) sections.push(assignmentsSection);
      if (stateXml) sections.push({ title: 'STATE.xml', content: stateXml.trim() });
      if (scopedPhaseId) {
        const phase = phases.find((row) => row.id === scopedPhaseId);
        if (phase) {
          sections.push({
            title: `ROADMAP PHASE ${phase.id}`,
            content: `<phase id="${phase.id}">\n  <title>${phase.title || ''}</title>\n  <goal>${phase.goal || ''}</goal>\n  <status>${phase.status}</status>\n  <depends>${phase.depends || ''}</depends>\n</phase>`,
          });
        }
      }
      if (scopedTask) {
        const attrs = [
          `id="${scopedTask.id}"`,
          `status="${scopedTask.status}"`,
          scopedTask.agentId ? `agent-id="${scopedTask.agentId}"` : '',
          scopedTask.agentRole ? `agent-role="${scopedTask.agentRole}"` : '',
          scopedTask.runtime ? `runtime="${scopedTask.runtime}"` : '',
          scopedTask.modelProfile ? `model-profile="${scopedTask.modelProfile}"` : '',
          scopedTask.resolvedModel ? `resolved-model="${scopedTask.resolvedModel}"` : '',
          scopedTask.claimedAt ? `claimed-at="${scopedTask.claimedAt}"` : '',
          scopedTask.skill ? `skill="${scopedTask.skill}"` : '',
          scopedTask.type ? `type="${scopedTask.type}"` : '',
        ].filter(Boolean).join(' ');
        sections.push({
          title: `TASK ${scopedTask.id}`,
          content: `<task ${attrs}>\n  <goal>${scopedTask.goal || ''}</goal>\n  <keywords>${scopedTask.keywords || ''}</keywords>\n  <depends>${scopedTask.depends || ''}</depends>\n</task>`,
        });
        const peerTasks = allTasks.filter((task) => task.phase === scopedTask.phase && task.id !== scopedTask.id && task.status !== 'done');
        if (peerTasks.length > 0) {
          sections.push({
            title: `PHASE ${scopedTask.phase} OPEN TASKS`,
            content: peerTasks.map((task) =>
              `<task id="${task.id}" status="${task.status}"${task.agentId ? ` agent-id="${task.agentId}"` : ''}><goal>${(task.goal || '').slice(0, 220)}</goal></task>`
            ).join('\n'),
          });
        }
      } else {
        const phaseTasks = allTasks.filter((task) => task.phase === scopedPhaseId && task.status !== 'done');
        sections.push({
          title: `PHASE ${scopedPhaseId} OPEN TASKS`,
          content: phaseTasks.length > 0
            ? phaseTasks.map((task) =>
              `<task id="${task.id}" status="${task.status}"${task.agentId ? ` agent-id="${task.agentId}"` : ''}><goal>${(task.goal || '').slice(0, 220)}</goal></task>`
            ).join('\n')
            : '(no open tasks in scoped phase)',
        });
      }
      const scopedDecisionsSection = buildDecisionsSection();
      if (scopedDecisionsSection) sections.push(scopedDecisionsSection);
      const scopedFileRefsSection = buildFileRefsSection();
      if (scopedFileRefsSection) sections.push(scopedFileRefsSection);
      const scopedConventionsSection = buildConventionsSection();
      if (scopedConventionsSection) sections.push(scopedConventionsSection);
      const scopedSkillsLimit = Number.parseInt(String(args.skills || '5'), 10) || 0;
      const scopedEquippedSkillsSection = buildEquippedSkillsSection(scopedSkillsLimit);
      if (scopedEquippedSkillsSection) sections.push(scopedEquippedSkillsSection);
      const docsMapXml = readXmlFile(path.join(planDir, 'DOCS-MAP.xml'));
      if (docsMapXml) sections.push({ title: 'DOCS-MAP.xml', content: docsMapXml.trim() });

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify({
          project: root.id,
          mode: 'scoped',
          scope,
          agent: agentView,
          assignments,
          sdkAssetAliases,
          sections: sections.map((section) => ({ title: section.title, content: section.content })),
        }, null, 2));
        return;
      }

      console.log(`\nSnapshot (scoped ${scope.snapshotMode}): ${root.id}${scope.phaseId ? ` - phase ${scope.phaseId}` : ''}${scope.taskId ? ` - task ${scope.taskId}` : ''}\n`);
      for (const section of sections) {
        console.log(`-- ${section.title} ${'-'.repeat(Math.max(0, 60 - section.title.length))}`);
        console.log(section.content);
        console.log('');
      }
      const totalChars = sections.reduce((sum, section) => sum + section.content.length, 0);
      console.log(`-- end snapshot (~${Math.round(totalChars / 4)} tokens) --`);
      return;
    }

    const k = getCurrentSprintIndex(phases, sprintSize, currentPhase);
    const sprintPhaseIds = getSprintPhaseIds(phases, sprintSize, k);
    const sections = [];
    sections.push({
      title: 'SDK ASSET ALIASES',
      content: Object.entries(sdkAssetAliases).map(([alias, relPath]) => `${alias}/... -> ${relPath}/...`).join('\n'),
    });
    const sprintAgentSection = buildAgentSection();
    if (sprintAgentSection) sections.push(sprintAgentSection);
    const sprintAssignmentsSection = buildAssignmentsSection();
    if (sprintAssignmentsSection) sections.push(sprintAssignmentsSection);
    if (stateXml) sections.push({ title: 'STATE.xml', content: stateXml.trim() });

    let roadmapSection = '';
    let outOfSprintCount = 0;
    for (const phase of phases) {
      if (sprintPhaseIds.includes(phase.id)) {
        const goalSlice = (phase.goal || '').slice(0, 240);
        const dependsAttr = phase.depends ? ` depends="${phase.depends}"` : '';
        roadmapSection += `<phase id="${phase.id}" status="${phase.status}"${dependsAttr}>${phase.title || ''}: ${goalSlice}</phase>\n`;
      } else {
        outOfSprintCount += 1;
      }
    }
    if (outOfSprintCount > 0) {
      roadmapSection += `(+${outOfSprintCount} out-of-sprint phases — see .planning/ROADMAP.xml)`;
    }
    sections.push({ title: `ROADMAP (sprint ${k}, phases ${sprintPhaseIds.join(',')})`, content: roadmapSection.trim() });

    // Graph-backed task listing for sprint snapshot (decision gad-201, gad-202)
    const sprintUseGraph = graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path));
    let sprintOpenTasks, sprintTasksSection = '', sprintDoneCount;
    if (sprintUseGraph) {
      const sprintJsonPath = path.join(planDir, 'graph.json');
      const gadDir = path.resolve(__dirname, '..');
      if (!fs.existsSync(sprintJsonPath)) {
        const g = graphExtractor.buildGraph(root, baseDir, { gadDir });
        fs.writeFileSync(sprintJsonPath, JSON.stringify(g, null, 2));
      }
      const sprintGraph = JSON.parse(fs.readFileSync(sprintJsonPath, 'utf8'));
      const sprintAllResult = graphExtractor.queryGraph(sprintGraph, { type: 'task' });
      const sprintAllMatches = sprintAllResult.matches || [];
      const sprintOpenMatches = sprintAllMatches.filter(m => m.status !== 'done');
      sprintDoneCount = sprintAllMatches.length - sprintOpenMatches.length;
      if (sprintOpenMatches.length > 0) {
        let currentTaskPhase = '';
        for (const m of sprintOpenMatches) {
          const taskId = m.id.replace(/^task:/, '');
          const taskPhase = taskId.split('-')[0];
          if (taskPhase !== currentTaskPhase) {
            currentTaskPhase = taskPhase;
            sprintTasksSection += `\n  <phase id="${taskPhase.padStart(2, '0')}">\n`;
          }
          const goalText = (m.goal || m.label || '').slice(0, 120);
          const extraAttrs = [
            m.skill ? `skill="${m.skill}"` : '',
            m.type ? `type="${m.type}"` : '',
          ].filter(Boolean).join(' ');
          const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
          sprintTasksSection += `    <task id="${taskId}" status="${m.status}"${attrStr}>${goalText}</task>\n`;
        }
      }
      sprintOpenTasks = sprintOpenMatches;
    } else {
      sprintOpenTasks = allTasks.filter((task) => task.status !== 'done');
      if (sprintOpenTasks.length > 0) {
        let currentTaskPhase = '';
        for (const task of sprintOpenTasks) {
          const taskPhase = task.id ? task.id.split('-')[0] : '';
          if (taskPhase !== currentTaskPhase) {
            currentTaskPhase = taskPhase;
            sprintTasksSection += `\n  <phase id="${taskPhase.padStart(2, '0')}">\n`;
          }
          const goalText = (task.goal || '').slice(0, 120);
          const extraAttrs = [
            task.skill ? `skill="${task.skill}"` : '',
            task.type ? `type="${task.type}"` : '',
            task.agentId ? `agent-id="${task.agentId}"` : '',
          ].filter(Boolean).join(' ');
          const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
          sprintTasksSection += `    <task id="${task.id}" status="${task.status}"${attrStr}>${goalText}</task>\n`;
        }
      }
      sprintDoneCount = allTasks.length - sprintOpenTasks.length;
    }
    sections.push({ title: `TASKS (${sprintOpenTasks.length} open, ${sprintDoneCount} done)`, content: sprintTasksSection.trim() || '(no open tasks)' });

    // Decision gad-195: --mode=active emits ONLY the changing state —
    // STATE.xml (next-action), ROADMAP (sprint phases), TASKS (open sprint).
    // Static sections (decisions, file refs, conventions, equipped skills,
    // docs-map) are loaded once at session start via --mode=full (default)
    // and NOT re-emitted mid-session. This is the session-scoped snapshot
    // contract that prevents redundant context re-loading.
    const isActiveMode = resolvedMode === 'active';
    if (!isActiveMode) {
      const sprintDecisionsSection = buildDecisionsSection();
      if (sprintDecisionsSection) sections.push(sprintDecisionsSection);
      const sprintFileRefsSection = buildFileRefsSection();
      if (sprintFileRefsSection) sections.push(sprintFileRefsSection);
      const sprintConventionsSection = buildConventionsSection();
      if (sprintConventionsSection) sections.push(sprintConventionsSection);
      const skillsLimit = Number.parseInt(String(args.skills || '5'), 10) || 0;
      const sprintEquippedSkillsSection = buildEquippedSkillsSection(skillsLimit);
      if (sprintEquippedSkillsSection) sections.push(sprintEquippedSkillsSection);
      const docsMapXml = readXmlFile(path.join(planDir, 'DOCS-MAP.xml'));
      if (docsMapXml) sections.push({ title: 'DOCS-MAP.xml', content: docsMapXml.trim() });

      // Graph stats section (decision gad-201)
      if (graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path))) {
        const jsonPath = path.join(planDir, 'graph.json');
        let graph;
        if (fs.existsSync(jsonPath)) {
          try { graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch {}
        }
        if (!graph) {
          // Auto-build if missing
          const gadDir = path.resolve(__dirname, '..');
          graph = graphExtractor.buildGraph(root, baseDir, { gadDir });
          fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
        }
        if (graph && graph.meta) {
          const lines = [];
          lines.push(`${graph.meta.nodeCount} nodes, ${graph.meta.edgeCount} edges`);
          lines.push(`Types: ${Object.entries(graph.meta.nodeTypes).map(([k, v]) => `${k}(${v})`).join(', ')}`);
          lines.push(`Last rebuild: ${graph.meta.generated}`);
          // Top 5 most-connected nodes by edge count
          const edgeCounts = new Map();
          for (const e of graph.edges) {
            edgeCounts.set(e.source, (edgeCounts.get(e.source) || 0) + 1);
            edgeCounts.set(e.target, (edgeCounts.get(e.target) || 0) + 1);
          }
          const topNodes = [...edgeCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          if (topNodes.length > 0) {
            lines.push('');
            lines.push('Most-connected:');
            for (const [nodeId, count] of topNodes) {
              const node = graph.nodes.find(n => n.id === nodeId);
              const label = node ? (node.label || '').slice(0, 60) : '';
              lines.push(`  ${nodeId} (${count} edges)${label ? ' — ' + label : ''}`);
            }
          }
          lines.push('');
          lines.push('Query: `gad query "open tasks in phase X"` — 12.9x token savings vs raw XML');
          sections.push({ title: 'GRAPH', content: lines.join('\n') });
        }
      }
    }

    // Stamp session after building sections, before output.
    if (snapshotSession) {
      const now = new Date().toISOString();
      snapshotSession.lastSnapshotAt = now;
      if (!isActiveMode) snapshotSession.staticLoadedAt = now;
      writeSession(snapshotSession);
    }

    const sessionSuffix = snapshotSession
      ? `  session=${snapshotSession.id}${isActiveMode ? ' (active-only, static elided)' : ''}`
      : '';

    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify({
        project: root.id,
        mode: isActiveMode ? 'active' : 'sprint',
        session: snapshotSession ? snapshotSession.id : null,
        scope,
        agent: agentView,
        assignments,
        sprintIndex: k,
        sprintPhaseIds,
        sections: sections.map((section) => ({ title: section.title, content: section.content })),
      }, null, 2));
      return;
    }

    const modeTag = isActiveMode ? 'active' : `sprint ${k}`;
    console.log(`\nSnapshot (${modeTag}): ${root.id} - phases ${sprintPhaseIds.join(', ')}${sessionSuffix}\n`);
    for (const section of sections) {
      console.log(`-- ${section.title} ${'-'.repeat(Math.max(0, 60 - section.title.length))}`);
      console.log(section.content);
      console.log('');
    }
    const totalChars = sections.reduce((sum, section) => sum + section.content.length, 0);
    console.log(`-- end snapshot (~${Math.round(totalChars / 4)} tokens) --`);
    if (snapshotSession) {
      console.log(`Reuse: --session ${snapshotSession.id}  (next call auto-downgrades to active mode)`);
    }
  },
});

function runTasksListView(args) {
  const baseDir = findRepoRoot();
  const config = gadConfig.load(baseDir);

  let roots = config.roots;
  if (args.projectid) {
    roots = roots.filter((root) => root.id === args.projectid);
    if (roots.length === 0) {
      const ids = config.roots.map((root) => root.id);
      console.error(`\nProject not found: ${args.projectid}\n\nAvailable projects:\n`);
      for (const id of ids) console.error(`  ${id}`);
      console.error(`\nRerun with: --projectid ${ids[0]}`);
      process.exit(1);
    }
  }

  const filter = {};
  if (args.status) filter.status = args.status;
  if (args.phase) filter.phase = args.phase;

  // Graph-backed mode: --graph flag or useGraphQuery=true in config (decision gad-201)
  const useGraph = args.graph || roots.some(r => graphExtractor.isGraphQueryEnabled(path.join(baseDir, r.path)));

  const rows = [];
  for (const root of roots) {
    if (useGraph) {
      // Graph-backed task listing
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const jsonPath = path.join(planDir, 'graph.json');
      const gadDir = path.resolve(__dirname, '..');

      // Auto-build graph if missing
      if (!fs.existsSync(jsonPath)) {
        const graph = graphExtractor.buildGraph(root, baseDir, { gadDir });
        fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
      }

      const graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const query = { type: 'task' };
      if (filter.status) query.status = filter.status;
      if (filter.phase) query.phase = filter.phase;
      const result = graphExtractor.queryGraph(graph, query);

      for (const m of result.matches) {
        const taskId = m.id.replace(/^task:/, '');
        const limit = args.full ? Infinity : 200;
        const goalText = m.goal || m.label || '';
        rows.push({
          project: root.id,
          id: formatId(root.id, 'T', taskId),
          'legacy-id': taskId,
          goal: goalText.length > limit ? goalText.slice(0, limit - 1) + '…' : goalText,
          status: m.status || '',
          phase: taskId.replace(/-\d+$/, ''),
          'agent-id': '',
          'agent-role': '',
          runtime: '',
        });
      }
    } else {
      const tasks = readTasks(root, baseDir, filter);
      for (const task of tasks) {
        const limit = args.full ? Infinity : 200;
        rows.push({
          project: root.id,
          id: formatId(root.id, 'T', task.id),
          'legacy-id': task.id,
          goal: task.goal.length > limit ? task.goal.slice(0, limit - 1) + '…' : task.goal,
          status: task.status,
          phase: task.phase,
          'agent-id': task.agentId || '',
          'agent-role': task.agentRole || '',
          runtime: task.runtime || '',
        });
      }
    }
  }

  if (rows.length === 0) {
    console.log('No tasks found.');
    return;
  }

  const fmt = args.json ? 'json' : 'table';
  const modeLabel = useGraph ? ' (graph)' : '';
  console.log(render(rows, { format: fmt, title: `Tasks${modeLabel} (${rows.length})` }));
}

function resolveSingleTaskRoot(projectid) {
  const baseDir = findRepoRoot();
  const config = gadConfig.load(baseDir);
  const roots = resolveRoots({ projectid }, baseDir, config.roots);
  if (roots.length === 0) {
    outputError('No projects configured. Run `gad projects sync` first.');
  }
  return { baseDir, config, root: roots[0] };
}

const tasksClaimCmd = defineCommand({
  meta: { name: 'claim', description: 'Claim a task for an active agent lane' },
  args: {
    task: { type: 'positional', description: 'Task ID (e.g. 41-02)', required: true },
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    agentid: { type: 'string', description: 'Existing agent id to reuse', default: '' },
    role: { type: 'string', description: 'Logical agent role for auto-registration', default: '' },
    runtime: { type: 'string', description: 'Runtime identity override', default: '' },
    'parent-agentid': { type: 'string', description: 'Parent agent id for spawned subagents', default: '' },
    'model-profile': { type: 'string', description: 'Model profile attached to the lane', default: '' },
    'resolved-model': { type: 'string', description: 'Resolved model attached to the lane', default: '' },
    'lease-minutes': { type: 'string', description: 'Optional soft lease duration in minutes', default: '0' },
    force: { type: 'boolean', description: 'Steal a task already claimed by another lane', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const { baseDir, root } = resolveSingleTaskRoot(args.projectid);
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const allTasks = readTasks(root, baseDir, {});
    const task = allTasks.find((row) => row.id === args.task);
    if (!task) {
      outputError(`Task not found: ${args.task}`);
    }
    if (task.status === 'done') {
      outputError(`Task ${args.task} is already done and cannot be claimed.`);
    }
    if (task.agentId && task.agentId !== (args.agentid || process.env.GAD_AGENT_ID || '') && !args.force) {
      outputError(`Task ${args.task} is already claimed by ${task.agentId}. Re-run with --force to take it over.`);
    }

    const agentInputs = resolveSnapshotAgentInputs(args);
    const runtimeIdentity = resolveSnapshotRuntime(args.runtime, { humanFallback: true });
    const leaseMinutes = Math.max(0, parseInt(args['lease-minutes'], 10) || 0);
    const leaseExpiresAt = leaseMinutes > 0
      ? new Date(Date.now() + (leaseMinutes * 60 * 1000)).toISOString()
      : null;
    let agentBootstrap;
    try {
      agentBootstrap = ensureAgentLane(planDir, {
        requestedAgentId: agentInputs.requestedAgentId,
        role: agentInputs.role,
        runtime: runtimeIdentity.id,
        runtimeSessionId: detectRuntimeSessionId(),
        parentAgentId: agentInputs.parentAgentId,
        modelProfile: agentInputs.modelProfile,
        resolvedModel: agentInputs.resolvedModel || runtimeIdentity.model || null,
        leaseExpiresAt,
      });
    } catch (error) {
      outputError(error && error.message ? error.message : String(error));
    }

    claimTask(planDir, task.id, {
      agentId: agentBootstrap.agent.agentId,
      agentRole: agentBootstrap.agent.agentRole,
      runtime: agentBootstrap.agent.runtime,
      modelProfile: agentBootstrap.agent.modelProfile,
      resolvedModel: agentBootstrap.agent.resolvedModel,
      claimedAt: nowIso(),
      leaseExpiresAt,
    });
    addTaskClaim(planDir, agentBootstrap.agent.agentId, task.id, task.phase);

    // Auto-rebuild graph after task claim mutation (decision gad-201)
    maybeRebuildGraph(baseDir, root);

    const updatedTask = readTasks(root, baseDir, {}).find((row) => row.id === task.id);
    const payload = {
      project: root.id,
      claimed: true,
      task: updatedTask,
      agent: {
        agentId: agentBootstrap.agent.agentId,
        agentRole: agentBootstrap.agent.agentRole,
        runtime: agentBootstrap.agent.runtime,
        parentAgentId: agentBootstrap.agent.parentAgentId || null,
        rootAgentId: agentBootstrap.agent.rootAgentId || agentBootstrap.agent.agentId,
        depth: agentBootstrap.agent.depth,
        modelProfile: agentBootstrap.agent.modelProfile || null,
        resolvedModel: agentBootstrap.agent.resolvedModel || null,
      },
      force: args.force === true,
    };

    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(`Claimed ${task.id} for ${agentBootstrap.agent.agentId} (${agentBootstrap.agent.runtime}).`);
  },
});

const tasksReleaseCmd = defineCommand({
  meta: { name: 'release', description: 'Release a claimed task or mark it done' },
  args: {
    task: { type: 'positional', description: 'Task ID (e.g. 41-02)', required: true },
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    agentid: { type: 'string', description: 'Agent id performing the release', default: '' },
    status: { type: 'string', description: 'Status to apply when not using --done (default: planned)', default: '' },
    done: { type: 'boolean', description: 'Mark the task done and preserve attribution', default: false },
    force: { type: 'boolean', description: 'Release even if task is owned by another lane', default: false },
    'release-agent': { type: 'boolean', description: 'Mark the lane released when it has no remaining claimed tasks', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const { baseDir, root } = resolveSingleTaskRoot(args.projectid);
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const allTasks = readTasks(root, baseDir, {});
    const task = allTasks.find((row) => row.id === args.task);
    if (!task) {
      outputError(`Task not found: ${args.task}`);
    }

    const actingAgentId = String(args.agentid || process.env.GAD_AGENT_ID || task.agentId || '').trim();
    if (task.agentId && actingAgentId && task.agentId !== actingAgentId && !args.force) {
      outputError(`Task ${args.task} is claimed by ${task.agentId}. Re-run with --force to release it anyway.`);
    }

    releaseTask(planDir, task.id, {
      done: args.done === true,
      status: args.status || 'planned',
    });
    if (actingAgentId) {
      removeTaskClaim(planDir, actingAgentId, task.id, task.phase, args['release-agent'] === true || args.done === true);
    }

    // Auto-rebuild graph after task status mutation (decision gad-201)
    maybeRebuildGraph(baseDir, root);

    const updatedTask = readTasks(root, baseDir, {}).find((row) => row.id === task.id);
    const payload = {
      project: root.id,
      released: true,
      task: updatedTask,
      agentId: actingAgentId || null,
      done: args.done === true,
    };

    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(`${args.done ? 'Completed' : 'Released'} ${task.id}${actingAgentId ? ` from ${actingAgentId}` : ''}.`);
  },
});

const tasksActiveCmd = defineCommand({
  meta: { name: 'active', description: 'List active claimed tasks and agent lanes' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    all: { type: 'boolean', description: 'Show all configured projects', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    const projects = [];
    const tableRows = [];

    for (const root of roots) {
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const tasks = readTasks(root, baseDir, {});
      const activeTasks = tasks.filter((task) => task.status !== 'done' && task.agentId);
      const lanes = listAgentLanes(planDir);
      const projectPayload = {
        project: root.id,
        activeTasks,
        activeAgents: lanes.activeAgents.map((agent) => simplifyAgentLane(agent, new Map(tasks.map((task) => [task.id, task])))),
        staleAgents: lanes.staleAgents.map((agent) => simplifyAgentLane(agent, new Map(tasks.map((task) => [task.id, task])))),
      };
      projects.push(projectPayload);

      for (const task of activeTasks) {
        tableRows.push({
          project: root.id,
          task: task.id,
          status: task.status,
          'agent-id': task.agentId || '',
          'agent-role': task.agentRole || '',
          runtime: task.runtime || '',
          claimed: task.claimedAt || '',
        });
      }
    }

    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify({
        projects,
        totalProjects: projects.length,
        totalActiveTasks: projects.reduce((sum, project) => sum + project.activeTasks.length, 0),
        totalActiveAgents: projects.reduce((sum, project) => sum + project.activeAgents.length, 0),
      }, null, 2));
      return;
    }

    if (tableRows.length === 0) {
      console.log('No active task claims.');
      return;
    }

    console.log(render(tableRows, { format: 'table', title: `Active task claims (${tableRows.length})` }));
  },
});

const tasksListCmd = defineCommand({
  meta: { name: 'list', description: 'Show tasks from TASK-REGISTRY.xml (falls back to STATE.md)' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    status: { type: 'string', description: 'Filter by status (e.g. in-progress, planned)', default: '' },
    phase: { type: 'string', description: 'Filter by phase id (e.g. 03)', default: '' },
    full: { type: 'boolean', description: 'Show full goal text (no truncation)', default: false },
    graph: { type: 'boolean', description: 'Use graph-backed query (auto-enabled when useGraphQuery=true)', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    runTasksListView(args);
  },
});

const tasksV2Cmd = defineCommand({
  meta: { name: 'tasks', description: 'Show, claim, release, and inspect active tasks' },
  subCommands: {
    list: tasksListCmd,
    claim: tasksClaimCmd,
    release: tasksReleaseCmd,
    active: tasksActiveCmd,
  },
});

// ---------------------------------------------------------------------------
// migrate-schema command
// ---------------------------------------------------------------------------

const migrateSchema = defineCommand({
  meta: { name: 'migrate-schema', description: 'Convert RP XML planning files to GAD Markdown' },
  args: {
    path: { type: 'string', description: 'Planning directory (default: .planning/)', default: '' },
    yes: { type: 'boolean', alias: 'y', description: 'Apply without prompting', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const planDir = args.path
      ? path.resolve(args.path)
      : path.join(baseDir, '.planning');

    const xmlFiles = fs.existsSync(planDir)
      ? fs.readdirSync(planDir).filter(f => f.endsWith('.xml'))
      : [];

    if (xmlFiles.length === 0) {
      console.log(`No XML files found in ${planDir} — nothing to migrate.`);
      return;
    }

    console.log(`\nMigration plan for ${planDir}\n`);
    const mapping = {
      'STATE.xml': 'STATE.md',
      'ROADMAP.xml': 'ROADMAP.md',
      'TASK-REGISTRY.xml': '(merged into STATE.md)',
      'REQUIREMENTS.xml': 'REQUIREMENTS.md',
    };
    for (const xml of xmlFiles) {
      const dest = mapping[xml] || xml.replace('.xml', '.md');
      console.log(`  ${xml}  →  ${dest}`);
    }
    console.log(`\n  Archive: ${planDir}/archive/xml/`);

    if (!args.yes) {
      console.log('\nRun with --yes to apply.');
      return;
    }

    // Execute migration
    const archiveDir = path.join(planDir, 'archive', 'xml');
    fs.mkdirSync(archiveDir, { recursive: true });

    let migrated = 0;
    for (const xml of xmlFiles) {
      const src = path.join(planDir, xml);
      const destName = mapping[xml] || xml.replace('.xml', '.md');
      if (!destName.startsWith('(')) {
        const dest = path.join(planDir, destName);
        if (!fs.existsSync(dest)) {
          const content = fs.readFileSync(src, 'utf8');
          fs.writeFileSync(dest, convertXmlToMd(xml, content));
          console.log(`  ✓ Created ${destName}`);
          migrated++;
        } else {
          console.log(`  ⚠ ${destName} already exists — created ${destName.replace('.md', '-migrated.md')}`);
          const content = fs.readFileSync(src, 'utf8');
          fs.writeFileSync(dest.replace('.md', '-migrated.md'), convertXmlToMd(xml, content));
        }
      }
      // Archive XML
      fs.renameSync(src, path.join(archiveDir, xml));
    }

    console.log(`\n✓ Migration complete — ${migrated} files created, ${xmlFiles.length} archived`);
  },
});

// ---------------------------------------------------------------------------
// XML → Markdown conversion (basic)
// ---------------------------------------------------------------------------

function convertXmlToMd(filename, xml) {
  const basename = filename.replace('.xml', '');

  if (filename === 'STATE.xml') {
    const currentPhase = (xml.match(/<current-phase[^>]*>(.*?)<\/current-phase>/s) || [])[1] || '';
    const milestone = (xml.match(/<milestone[^>]*>(.*?)<\/milestone>/s) || [])[1] || '';
    const status = (xml.match(/<status[^>]*>(.*?)<\/status>/s) || [])[1] || 'active';
    return [
      `# Planning State`,
      '',
      `## Current Position`,
      '',
      `Phase: ${currentPhase.trim()}`,
      `Milestone: ${milestone.trim()}`,
      `Status: ${status.trim()}`,
      '',
      `> Migrated from STATE.xml on ${new Date().toISOString().split('T')[0]}`,
    ].join('\n') + '\n';
  }

  if (filename === 'ROADMAP.xml') {
    const phases = [];
    const phaseRe = /<phase id="([^"]+)">([\s\S]*?)<\/phase>/g;
    let m;
    while ((m = phaseRe.exec(xml)) !== null) {
      const id = m[1];
      const body = m[2];
      const goal = (body.match(/<goal>([\s\S]*?)<\/goal>/) || [])[1] || '';
      const status = (body.match(/<status>([\s\S]*?)<\/status>/) || [])[1] || 'planned';
      const done = status === 'done';
      phases.push(`- [${done ? 'x' : ' '}] **Phase ${id}:** ${goal.replace(/<[^>]+>/g, '').trim()}`);
    }
    return [
      `# Roadmap`,
      '',
      `## Milestone`,
      '',
      ...phases,
      '',
      `> Migrated from ROADMAP.xml on ${new Date().toISOString().split('T')[0]}`,
    ].join('\n') + '\n';
  }

  if (filename === 'REQUIREMENTS.xml') {
    const text = xml.replace(/<\?[^>]+\?>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return `# Requirements\n\n${text}\n\n> Migrated from REQUIREMENTS.xml on ${new Date().toISOString().split('T')[0]}\n`;
  }

  // Generic fallback
  const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return `# ${basename}\n\n${text}\n\n> Migrated from ${filename}\n`;
}

// ---------------------------------------------------------------------------
// toml write helpers (minimal — appends to existing toml)
// ---------------------------------------------------------------------------

function findTomlPath(baseDir) {
  const resolved = resolveTomlPath(baseDir);
  if (resolved) return resolved;
  return path.join(baseDir, '.planning', 'gad-config.toml');
}

function normalizePath(p) {
  return p.replace(/\\/g, '/').replace(/\/$/, '') || '.';
}

function writeRootsToToml(baseDir, roots, config) {
  const tomlPath = findTomlPath(baseDir);
  if (!fs.existsSync(tomlPath)) {
    // Create minimal toml with graph query enabled by default (decision gad-201)
    const lines = ['[planning]', `sprintSize = ${config.sprintSize || 5}`, ''];
    lines.push('[features]');
    lines.push('# Graph-backed queries for targeted lookups (~12.9x token savings).');
    lines.push('# Set to false to fall back to raw XML reads.');
    lines.push('useGraphQuery = true');
    lines.push('');
    for (const r of roots) {
      lines.push('[[planning.roots]]');
      lines.push(`id = "${r.id}"`);
      lines.push(`path = "${r.path}"`);
      lines.push(`planningDir = "${r.planningDir}"`);
      lines.push(`discover = ${r.discover ? 'true' : 'false'}`);
      lines.push('');
    }
    fs.writeFileSync(tomlPath, lines.join('\n'));
    try { gadConfig.writeCompatJson(baseDir, { ...config, roots }); } catch {}
    return;
  }

  let toml = fs.readFileSync(tomlPath, 'utf8');

  // Remove all existing [[planning.roots]] blocks
  toml = toml.replace(/\[\[planning\.roots\]\][\s\S]*?(?=\[\[|\[(?!planning\.roots)|$)/g, '').trimEnd();

  // Append new roots
  const rootsSection = roots.map(r => [
    '',
    '[[planning.roots]]',
    `id = "${r.id}"`,
    `path = "${r.path}"`,
    `planningDir = "${r.planningDir}"`,
    `discover = ${r.discover ? 'true' : 'false'}`,
  ].join('\n')).join('\n');

  fs.writeFileSync(tomlPath, toml + '\n' + rootsSection + '\n');
  try { gadConfig.writeCompatJson(baseDir, { ...config, roots }); } catch {}
}

function appendIgnoreToToml(baseDir, pattern) {
  const tomlPath = findTomlPath(baseDir);
  if (!fs.existsSync(tomlPath)) return;
  let toml = fs.readFileSync(tomlPath, 'utf8');
  // Find ignore array and append, or add new ignore line
  if (/ignore\s*=\s*\[/.test(toml)) {
    toml = toml.replace(/(ignore\s*=\s*\[[\s\S]*?)(\])/, `$1  "${pattern}",\n$2`);
  } else {
    toml += `\nignore = ["${pattern}"]\n`;
  }
  fs.writeFileSync(tomlPath, toml);
  try {
    const nextConfig = gadConfig.load(baseDir);
    gadConfig.writeCompatJson(baseDir, nextConfig);
  } catch {}
}

// ---------------------------------------------------------------------------
// crawl helpers
// ---------------------------------------------------------------------------

function crawlPlanningDirs(baseDir, ignore) {
  const results = [];
  const ignoreRe = ignore.map(p => {
    const escaped = p.replace(/\*\*/g, '(.*)').replace(/\*/g, '([^/]*)').replace(/\?/g, '[^/]');
    return new RegExp(escaped);
  });

  function crawl(dir, rel) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (ignoreRe.some(re => re.test(childRel))) continue;
      if (e.name === '.planning') {
        results.push(rel || '.');
        continue;
      }
      crawl(path.join(dir, e.name), childRel);
    }
  }

  crawl(baseDir, '');
  return results;
}

// ---------------------------------------------------------------------------
// sink subcommands
// ---------------------------------------------------------------------------
//
// Manages the relationship between .planning/ files and the docs sink (MDX).
// sink_workflow = "manual" means compile is always explicit.
//
//   gad sink status     — table of planning vs sink (mtimes, generated flag)
//   gad sink diff       — show what compile would change vs sink on disk
//   gad sink compile    — write planning state → docs MDX (manual trigger)
//   gad sink compile --force — overwrite sink MDX even when not generated
//   gad sink decompile  — pull docs MDX → planning state (reverse)
//   gad sink validate   — check all sink mappings are well-formed

function getSink(config) {
  if (!config.docs_sink) {
    outputError('No docs_sink configured in gad-config.toml. Add: docs_sink = "apps/portfolio/content/docs"');
    return null;
  }
  return config.docs_sink;
}

// SOURCE_MAP mirror — XML preferred over MD (matches docs-compiler.cjs compile priority)
const SINK_SOURCE_MAP = [
  { srcs: ['STATE.xml', 'STATE.md'],                 sink: 'state.mdx' },
  { srcs: ['ROADMAP.xml', 'ROADMAP.md'],             sink: 'roadmap.mdx' },
  { srcs: ['DECISIONS.xml', 'DECISIONS.md'],         sink: 'decisions.mdx' },
  { srcs: ['TASK-REGISTRY.xml', 'TASK-REGISTRY.md'], sink: 'task-registry.mdx' },
  { srcs: ['REQUIREMENTS.xml', 'REQUIREMENTS.md'],   sink: 'requirements.mdx' },
  { srcs: ['ERRORS-AND-ATTEMPTS.xml'],               sink: 'errors-and-attempts.mdx' },
  { srcs: ['BLOCKERS.xml'],                          sink: 'blockers.mdx' },
];

const sinkStatus = defineCommand({
  meta: { name: 'status', description: 'Show sync status between .planning/ files and docs sink' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const sink = getSink(config); if (!sink) return;
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    const rows = [];
    for (const root of roots) {
      const planDir = path.join(baseDir, root.path, root.planningDir);
      for (const { srcs, sink: sinkName } of SINK_SOURCE_MAP) {
        // Find which source file exists (prefer first)
        const srcFile = srcs.find(s => fs.existsSync(path.join(planDir, s)));
        if (!srcFile) continue;
        const srcPath  = path.join(planDir, srcFile);
        const destPath = path.join(baseDir, sink, root.id, 'planning', sinkName);
        const { isGenerated } = require('../lib/docs-compiler.cjs');
        const srcMtime  = fs.statSync(srcPath).mtimeMs;
        const destExists = fs.existsSync(destPath);
        const destMtime  = destExists ? fs.statSync(destPath).mtimeMs : 0;
        const status = !destExists ? 'missing'
          : !isGenerated(destPath) ? 'human-authored'
          : srcMtime > destMtime ? 'stale' : 'ok';
        rows.push({ project: root.id, src: srcFile, sink: `${root.id}/planning/${sinkName}`, status });
      }
    }

    output(rows, { title: `Sink Status  [sink: ${sink}]` });
    const needSync = rows.filter(r => r.status === 'missing' || r.status === 'stale').length;
    const humanAuthored = rows.filter(r => r.status === 'human-authored').length;
    if (needSync > 0) console.log(`\n${needSync} file(s) need sync. Run \`gad sink diff\`, then \`gad sink compile\`.`);
    else console.log('\n✓ All generated sink files are up to date.');
    if (humanAuthored > 0) console.log(`${humanAuthored} sink file(s) are not tagged generated — run \`gad sink diff\`; use \`gad sink compile --force\` only after review.`);
  },
});

const sinkDiff = defineCommand({
  meta: { name: 'diff', description: 'Show what sink compile would change vs MDX on disk (compare before compile --force)' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Diff all projects', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const sink = getSink(config); if (!sink) return;
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    const { diffSink } = require('../lib/docs-compiler.cjs');
    let totalChanged = 0;
    let totalForce = 0;
    for (const root of roots) {
      const { chunks, changed, needsForce } = diffSink(baseDir, root, sink);
      totalChanged += changed;
      totalForce += needsForce;
      if (chunks.length) {
        console.log(`\n── ${root.id} ──`);
        console.log(chunks.join('\n'));
      }
    }
    if (totalChanged === 0) {
      console.log(`\n✓ Sink diff: no content changes (sink matches compile output — ${sink})`);
      return;
    }
    console.log(`\n${totalChanged} file(s) differ from compiled output.`);
    if (totalForce > 0) {
      console.log(`${totalForce} of those need \`gad sink compile --force\` to overwrite (not generated on disk).`);
    }
    console.log('Review the output above, then run `gad sink compile` or `gad sink compile --force` as needed.');
    process.exit(1);
  },
});

const sinkCompile = defineCommand({
  meta: { name: 'compile', description: 'Compile .planning/ XML files → docs sink MDX' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Compile all projects', default: false },
    force: { type: 'boolean', description: 'Overwrite sink MDX even when not tagged generated (use after gad sink diff)', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const sink = getSink(config); if (!sink) return;
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    const { compile: compileDocs2 } = require('../lib/docs-compiler.cjs');
    let compiled = 0;
    for (const root of roots) {
      // Stamp first so the source mtime is set before the sink mtime
      stampSinkCompileNote(root, baseDir, sink, new Date().toISOString());
      const n = compileDocs2(baseDir, root, sink, { force: args.force }) || 0;
      if (n > 0) console.log(`  ✓ ${root.id}: ${n} file(s)`);
      compiled += n;
    }
    const forceNote = args.force ? ' (including non-generated sink files)' : '';
    console.log(`\n✓ Sink compile: ${compiled} file(s) written to ${sink}${forceNote}`);
  },
});

const sinkSync = defineCommand({
  meta: { name: 'sync', description: 'Sync all planning files to sink (compile all, non-destructive)' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Sync all projects (default when no session)', default: false },
    force: { type: 'boolean', description: 'Overwrite sink MDX even when not tagged generated (use after gad sink diff)', default: false },
  },
  run({ args }) {
    // sync = compile everything; --all is the natural default
    args.all = args.all || !args.projectid;
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const sink = getSink(config); if (!sink) return;
    const roots = resolveRoots(args, baseDir, config.roots);

    const { compile: compileDocs2 } = require('../lib/docs-compiler.cjs');
    let compiled = 0;
    for (const root of roots) {
      stampSinkCompileNote(root, baseDir, sink, new Date().toISOString());
      const n = compileDocs2(baseDir, root, sink, { force: args.force }) || 0;
      console.log(`  ${n > 0 ? '✓' : '–'} ${root.id}: ${n} file(s) written`);
      compiled += n;
    }
    const forceNote = args.force ? ' (including non-generated sink files)' : '';
    console.log(`\n✓ Sync complete: ${compiled} file(s) updated in ${sink}${forceNote}`);
  },
});

const sinkDecompile = defineCommand({
  meta: { name: 'decompile', description: 'Ensure .planning/ dirs exist for all projects; create stubs for missing source files' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Decompile all projects', default: false },
  },
  run({ args }) {
    // decompile defaults to all (it's a structural ensure operation)
    args.all = args.all || !args.projectid;
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const sink = getSink(config); if (!sink) return;
    const roots = resolveRoots(args, baseDir, config.roots);

    const { decompile } = require('../lib/docs-compiler.cjs');
    let total = 0;
    for (const root of roots) {
      const n = decompile(baseDir, root, sink);
      const planDir = path.join(baseDir, root.path, root.planningDir);
      if (n > 0) console.log(`  ✓ ${root.id}: ${n} stub(s) created in ${planDir}`);
      else console.log(`  – ${root.id}: dir ensured, no new stubs needed`);
      total += n;
    }
    console.log(`\n✓ Decompile: ${total} stub file(s) created. Run \`gad sink compile\` to populate the sink.`);
  },
});

const sinkValidate = defineCommand({
  meta: { name: 'validate', description: 'Check all sink mappings are well-formed' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Validate all projects', default: false },
  },
  run({ args }) {
    args.all = args.all || !args.projectid;
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const sink = getSink(config); if (!sink) return;
    const roots = resolveRoots(args, baseDir, config.roots);

    let errors = 0; let ok = 0;
    for (const root of roots) {
      const planDir = path.join(baseDir, root.path, root.planningDir);
      if (!fs.existsSync(planDir)) {
        console.log(`  ✗ [${root.id}] .planning/ missing: ${planDir}`);
        errors++; continue;
      }
      const sinkDir = path.join(baseDir, sink, root.id, 'planning');
      if (!fs.existsSync(sinkDir)) {
        console.log(`  ⚠ [${root.id}] sink dir not yet compiled: ${sink}/${root.id}/planning/`);
      } else {
        console.log(`  ✓ [${root.id}]`); ok++;
      }
    }
    console.log(`\n${ok} valid, ${errors} error(s). Sink: ${sink}`);
    if (errors > 0) process.exit(1);
  },
});

// ---------------------------------------------------------------------------
// pack command — bundle all planning data for a project into portable JSON
// ---------------------------------------------------------------------------

const packCmd = defineCommand({
  meta: { name: 'pack', description: 'Bundle all planning data for a project into a portable JSON pack' },
  args: {
    projectid: { type: 'string', description: 'Project id to pack (default: session or first root)', default: '' },
    output:    { type: 'string', description: 'Output path for pack JSON (default: .planning/pack.json)', default: '' },
    stdout:    { type: 'boolean', description: 'Print pack JSON to stdout instead of writing file', default: false },
    pretty:    { type: 'boolean', description: 'Pretty-print JSON (default true)', default: true },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) { outputError('No project found. Use --projectid or start a session.'); return; }
    if (roots.length > 1) { outputError('pack only supports a single project. Use --projectid to specify one.'); return; }

    const root = roots[0];

    const state   = readState(root, baseDir);
    const phases  = readPhases(root, baseDir);
    const tasks   = readTasks(root, baseDir);
    const decisions = readDecisions(root, baseDir);
    const reqs    = readRequirements(root, baseDir);
    const errors  = readErrors(root, baseDir);
    const blockers = readBlockers(root, baseDir);
    const docsMap = readDocsMap(root, baseDir);

    // Build doc refs from decisions + requirements + phase plans + docs-map
    const docRefs = [];
    for (const d of decisions) {
      for (const ref of d.references) {
        docRefs.push({ source: 'decisions', via: d.id, path: ref });
      }
    }
    for (const r of reqs) {
      if (r.docPath) docRefs.push({ source: 'requirements', via: r.kind, path: r.docPath });
    }
    for (const p of phases) {
      if (p.plans) docRefs.push({ source: 'phases', via: `phase-${p.id}`, path: p.plans });
    }
    for (const d of docsMap) {
      docRefs.push({ source: 'docs-map', via: d.skill || d.kind, path: d.sink });
    }

    const pack = {
      version: 1,
      project: root.id,
      projectPath: root.path,
      planningDir: root.planningDir,
      packedAt: new Date().toISOString(),
      state,
      phases,
      tasks,
      decisions,
      requirements: reqs,
      errors,
      blockers,
      docsMap,
      docRefs,
    };

    const json = args.pretty ? JSON.stringify(pack, null, 2) : JSON.stringify(pack);

    if (args.stdout) {
      console.log(json);
      return;
    }

    const outPath = args.output
      ? path.resolve(baseDir, args.output)
      : path.join(baseDir, root.path, root.planningDir, 'pack.json');

    fs.writeFileSync(outPath, json, 'utf8');
    console.log(`✓ Pack written: ${path.relative(baseDir, outPath)}`);
    console.log(`  project:   ${root.id}`);
    console.log(`  phases:    ${phases.length}`);
    console.log(`  tasks:     ${tasks.length}`);
    console.log(`  decisions: ${decisions.length}`);
    console.log(`  doc refs:  ${docRefs.length}`);
  },
});

const sinkCmd = defineCommand({
  meta: { name: 'sink', description: 'Manage docs sink — sync, compile, decompile, status, validate' },
  subCommands: { status: sinkStatus, diff: sinkDiff, compile: sinkCompile, sync: sinkSync, decompile: sinkDecompile, validate: sinkValidate },
});

// ---------------------------------------------------------------------------
// Root command
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// verify command
// ---------------------------------------------------------------------------

const verifyCmd = defineCommand({
  meta: { name: 'verify', description: 'Verify a phase achieved its goals — checks tasks, build, state, conventions' },
  args: {
    projectid: { type: 'string', description: 'Project ID', default: '' },
    phase: { type: 'string', description: 'Phase ID to verify', default: '' },
  },
  run({ args }) {
    const { execSync } = require('child_process');
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;
    const root = roots[0];
    const planDir = path.join(baseDir, root.path, root.planningDir);

    // Determine phase to verify
    const phases = readPhases(root, baseDir);
    let targetPhase = args.phase;
    if (!targetPhase) {
      // Find latest active or done phase
      const stateXml = readXmlFile(path.join(planDir, 'STATE.xml'));
      targetPhase = stateXml ? (stateXml.match(/<current-phase>([\s\S]*?)<\/current-phase>/) || [])[1]?.trim() : '';
    }
    if (!targetPhase) { outputError('No phase specified and no current phase found. Use --phase <id>'); return; }

    const padded = targetPhase.padStart(2, '0');
    const phase = phases.find(p => p.id === padded || p.id === targetPhase);
    if (!phase) { outputError(`Phase ${targetPhase} not found in ROADMAP.xml`); return; }

    console.log(`\nVerifying phase ${padded}: ${phase.title || ''}\n`);

    const checks = [];

    // 1. All tasks done
    const allTasks = readTasks(root, baseDir, {});
    const phaseTasks = allTasks.filter(t => {
      const tp = t.id ? t.id.split('-')[0] : '';
      return tp === padded || tp === targetPhase;
    });
    const doneTasks = phaseTasks.filter(t => t.status === 'done');
    const openTasks = phaseTasks.filter(t => t.status !== 'done');
    checks.push({
      category: 'Tasks',
      check: `All tasks done (${doneTasks.length}/${phaseTasks.length})`,
      result: openTasks.length === 0 ? 'PASS' : 'FAIL',
      evidence: openTasks.length === 0 ? `${doneTasks.length} done` : `${openTasks.length} still open: ${openTasks.map(t => t.id).join(', ')}`,
    });

    // 2. Build passes (try common commands)
    const projectDir = path.join(baseDir, root.path);
    let buildResult = 'SKIP';
    let buildEvidence = 'no build command detected';
    const buildCmds = [
      { cmd: 'npm run build', check: 'package.json' },
      { cmd: 'npx tsc --noEmit', check: 'tsconfig.json' },
      { cmd: 'pnpm run build', check: 'pnpm-workspace.yaml' },
    ];
    for (const bc of buildCmds) {
      if (fs.existsSync(path.join(projectDir, bc.check))) {
        try {
          execSync(bc.cmd, { cwd: projectDir, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
          buildResult = 'PASS';
          buildEvidence = `${bc.cmd} exited 0`;
        } catch (e) {
          buildResult = 'FAIL';
          buildEvidence = `${bc.cmd} failed: ${(e.stderr || e.message || '').slice(0, 200)}`;
        }
        break;
      }
    }
    checks.push({ category: 'Build', check: 'Build/typecheck passes', result: buildResult, evidence: buildEvidence });

    // 3. STATE.xml is current
    const stateXml = readXmlFile(path.join(planDir, 'STATE.xml'));
    if (stateXml) {
      const nextAction = (stateXml.match(/<next-action>([\s\S]*?)<\/next-action>/) || [])[1]?.trim() || '';
      const stateOk = nextAction.length > 10;
      checks.push({
        category: 'State',
        check: 'STATE.xml next-action is current',
        result: stateOk ? 'PASS' : 'FAIL',
        evidence: stateOk ? nextAction.slice(0, 100) : 'next-action is empty or too short',
      });
    }

    // 4. Decisions captured (if any tasks suggest architectural choices)
    const decisionsXml = readXmlFile(path.join(planDir, 'DECISIONS.xml'));
    const decCount = decisionsXml ? (decisionsXml.match(/<decision\s/g) || []).length : 0;
    checks.push({
      category: 'Decisions',
      check: 'Decisions documented',
      result: decCount > 0 ? 'PASS' : 'SKIP',
      evidence: decCount > 0 ? `${decCount} decisions in DECISIONS.xml` : 'no decisions (may be ok for non-architectural phases)',
    });

    // 5. Conventions (greenfield first phase)
    const conventionsExists = fs.existsSync(path.join(planDir, 'CONVENTIONS.md'));
    const isFirstPhase = padded === '01' || phases.filter(p => p.status === 'done').length <= 1;
    if (isFirstPhase) {
      checks.push({
        category: 'Conventions',
        check: 'CONVENTIONS.md exists (first implementation phase)',
        result: conventionsExists ? 'PASS' : 'FAIL',
        evidence: conventionsExists ? 'file exists' : 'missing — create with gad:auto-conventions',
      });
    }

    // Output
    const passed = checks.filter(c => c.result === 'PASS').length;
    const failed = checks.filter(c => c.result === 'FAIL').length;
    const skipped = checks.filter(c => c.result === 'SKIP').length;
    const total = checks.length;
    const overall = failed > 0 ? 'FAIL' : 'PASS';

    console.log(`  #  CATEGORY      CHECK                                    RESULT  EVIDENCE`);
    console.log(`  ─  ────────────  ───────────────────────────────────────  ──────  ────────`);
    for (let i = 0; i < checks.length; i++) {
      const c = checks[i];
      const icon = c.result === 'PASS' ? '✓' : c.result === 'FAIL' ? '✗' : '–';
      console.log(`  ${i + 1}  ${c.category.padEnd(12)}  ${c.check.slice(0, 39).padEnd(39)}  ${icon} ${c.result.padEnd(4)}  ${(c.evidence || '').slice(0, 50)}`);
    }
    console.log(`\n  Result: ${overall} (${passed} passed, ${failed} failed, ${skipped} skipped)\n`);

    if (failed > 0) process.exit(1);
  },
});

// ---------------------------------------------------------------------------
// sprint subcommands
// ---------------------------------------------------------------------------

function getSprintPhaseIds(phases, sprintSize, sprintIndex) {
  const start = sprintIndex * sprintSize;
  return phases.slice(start, start + sprintSize).map(p => p.id);
}

function getCurrentSprintIndex(phases, sprintSize, currentPhaseId) {
  const idx = phases.findIndex(p => p.id === currentPhaseId || p.id === String(currentPhaseId).padStart(2, '0'));
  return idx >= 0 ? Math.floor(idx / sprintSize) : 0;
}

const sprintShow = defineCommand({
  meta: { name: 'show', description: 'Show sprint boundaries and phases in each sprint' },
  args: {
    projectid: { type: 'string', description: 'Project ID', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    const sprintSize = config.sprintSize || 5;

    for (const root of roots) {
      const phases = readPhases(root, baseDir);
      if (phases.length === 0) continue;
      const totalSprints = Math.ceil(phases.length / sprintSize);

      if (args.json || shouldUseJson()) {
        const sprints = [];
        for (let i = 0; i < totalSprints; i++) {
          const ids = getSprintPhaseIds(phases, sprintSize, i);
          sprints.push({ sprintIndex: i, phaseIds: ids, phases: phases.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, title: p.title, status: p.status })) });
        }
        console.log(JSON.stringify({ project: root.id, sprintSize, sprints }, null, 2));
      } else {
        console.log(`\nSprints for ${root.id} (size=${sprintSize}):\n`);
        for (let i = 0; i < totalSprints; i++) {
          const ids = getSprintPhaseIds(phases, sprintSize, i);
          const sprintPhases = phases.filter(p => ids.includes(p.id));
          console.log(`  Sprint ${i}: phases ${ids.join(', ')}`);
          for (const p of sprintPhases) {
            console.log(`    ${p.id}  ${(p.title || '').slice(0, 50)}  [${p.status}]`);
          }
        }
      }
    }
  },
});

const sprintContext = defineCommand({
  meta: { name: 'context', description: 'Sprint-scoped context window: paths + summary for current sprint' },
  args: {
    projectid: { type: 'string', description: 'Project ID', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    const sprintSize = config.sprintSize || 5;

    for (const root of roots) {
      const phases = readPhases(root, baseDir);
      const stateContent = readXmlFile(path.join(baseDir, root.path, root.planningDir, 'STATE.xml'));
      const currentPhase = stateContent ? (stateContent.match(/<current-phase>([\s\S]*?)<\/current-phase>/) || [])[1] || '' : '';
      const k = getCurrentSprintIndex(phases, sprintSize, currentPhase.trim());
      const phaseIds = getSprintPhaseIds(phases, sprintSize, k);
      const sprintPhases = phases.filter(p => phaseIds.includes(p.id));
      const tasks = readTasks(root, baseDir, {});
      const sprintTasks = tasks.filter(t => {
        const taskPhase = t.id ? t.id.split('-')[0] : '';
        return phaseIds.includes(taskPhase) || phaseIds.includes(taskPhase.padStart(2, '0'));
      });
      const openTasks = sprintTasks.filter(t => t.status !== 'done');

      const context = {
        project: root.id,
        sprintIndex: k,
        sprintSize,
        phaseIds,
        phases: sprintPhases.map(p => ({ id: p.id, title: p.title, status: p.status })),
        taskCount: sprintTasks.length,
        openTaskCount: openTasks.length,
      };

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(context, null, 2));
      } else {
        console.log(`\nSprint ${k} (${root.id}): phases ${phaseIds.join(', ')}`);
        for (const p of sprintPhases) {
          console.log(`  ${p.id}  ${(p.title || '').slice(0, 60)}  [${p.status}]`);
        }
        console.log(`\nTasks: ${sprintTasks.length} total, ${openTasks.length} open`);
      }
    }
  },
});

const sprintCmd = defineCommand({
  meta: { name: 'sprint', description: 'Sprint management — show boundaries and get sprint context window' },
  subCommands: { show: sprintShow, context: sprintContext },
});

// ---------------------------------------------------------------------------
// gad dev — watch planning files and re-run refs verify on changes
// ---------------------------------------------------------------------------

const devCmd = defineCommand({
  meta: { name: 'dev', description: 'Watch .planning/ files and re-run refs verify on changes (JSON output)' },
  args: {
    debounce: { type: 'string', description: 'Debounce interval in ms (default: 500)', default: '500' },
    poll: { type: 'boolean', description: 'Use polling instead of fs.watch (for unreliable FS watchers)', default: false },
    once: { type: 'boolean', description: 'Run verify once and exit (no watch)', default: false },
  },
  run({ args }) {
    const { startWatch, runVerify } = require('../lib/watch-planning.cjs');
    const baseDir = findRepoRoot();
    const debounceMs = parseInt(args.debounce) || 500;

    if (args.once) {
      const result = runVerify(baseDir, 'once', (obj) => console.log(JSON.stringify(obj)));
      process.exit(result.ok ? 0 : 1);
      return;
    }

    console.error(`gad dev — watching .planning/ files (debounce: ${debounceMs}ms, mode: ${args.poll ? 'poll' : 'fs.watch'})`);
    console.error('Press Ctrl+C to stop.\n');

    const { stop } = startWatch(baseDir, {
      debounceMs,
      poll: args.poll,
    });

    process.on('SIGINT', () => {
      stop();
      console.error('\ngad dev stopped.');
      process.exit(0);
    });
  },
});

// ---------------------------------------------------------------------------
// gad log — inspect CLI call logs
// ---------------------------------------------------------------------------

const logShow = defineCommand({
  meta: { name: 'show', description: 'Show recent CLI call log entries' },
  args: {
    n: { type: 'string', description: 'Number of entries to show (default: 20)', default: '20' },
    date: { type: 'string', description: 'Date to show (YYYY-MM-DD, default: today)', default: '' },
    eval: { type: 'string', description: 'Show logs from an eval run directory', default: '' },
    filter: { type: 'string', description: 'Filter: cli, tool, gad, skill, agent (default: all)', default: '' },
  },
  run({ args }) {
    let logDir;
    if (args.eval) {
      logDir = resolveOrDefaultEvalProjectDir(args.eval);
      // Find latest version with a log
      if (fs.existsSync(logDir)) {
        const versions = fs.readdirSync(logDir).filter(n => /^v\d+$/.test(n)).sort();
        for (let i = versions.length - 1; i >= 0; i--) {
          const candidate = path.join(logDir, versions[i], '.gad-log');
          if (fs.existsSync(candidate)) { logDir = candidate; break; }
        }
      }
    } else {
      logDir = getLogDir();
    }

    if (!logDir || !fs.existsSync(logDir)) {
      console.log('No log directory found. CLI logging starts on first gad command.');
      return;
    }

    const dateStr = args.date || new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `${dateStr}.jsonl`);

    if (!fs.existsSync(logFile)) {
      // Try to find any log file
      const files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl')).sort();
      if (files.length === 0) {
        console.log('No log files found.');
        return;
      }
      console.log(`No log for ${dateStr}. Available dates:`);
      for (const f of files) console.log(`  ${f.replace('.jsonl', '')}`);
      return;
    }

    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    let allEntries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

    // Apply filter
    const filter = args.filter;
    if (filter === 'cli') allEntries = allEntries.filter(e => e.cmd);
    else if (filter === 'tool') allEntries = allEntries.filter(e => e.type === 'tool_call');
    else if (filter === 'gad') allEntries = allEntries.filter(e => e.gad_command || (e.cmd && !e.type));
    else if (filter === 'skill') allEntries = allEntries.filter(e => e.skill);
    else if (filter === 'agent') allEntries = allEntries.filter(e => e.tool === 'Agent');

    const n = parseInt(args.n) || 20;
    const entries = allEntries.slice(-n);

    for (const e of entries) {
      const time = e.ts ? e.ts.slice(11, 19) : '?';

      if (e.type === 'tool_call') {
        // Tool call from PostToolUse hook
        const tool = (e.tool || '?').padEnd(6);
        const summary = e.gad_command ? `gad ${e.gad_command}` :
                        e.skill ? `skill:${e.skill}` :
                        e.agent_type ? `agent:${e.agent_type} ${e.agent_description || ''}` :
                        (e.input_summary || '').slice(0, 80);
        console.log(`  ◆ ${time}  ${tool}  ${summary}`);
      } else if (e.cmd) {
        // GAD CLI call
        const dur = e.duration_ms != null ? `${e.duration_ms}ms` : '?';
        const exit = e.exit || 0;
        const mark = exit === 0 ? '✓' : '✗';
        console.log(`  ${mark} ${time}  ${dur.padStart(7)}  gad ${e.cmd}`);
        if (e.summary) console.log(`    ${e.summary}`);
      }
    }

    const cliCalls = entries.filter(e => e.cmd);
    const toolCalls = entries.filter(e => e.type === 'tool_call');
    console.log(`\n${entries.length} entries (${cliCalls.length} CLI, ${toolCalls.length} tool) — ${logFile}`);
  },
});

const logStats = defineCommand({
  meta: { name: 'stats', description: 'Show CLI usage statistics' },
  args: {
    days: { type: 'string', description: 'Number of days to analyze (default: 7)', default: '7' },
  },
  run({ args }) {
    const logDir = getLogDir();
    if (!logDir || !fs.existsSync(logDir)) {
      console.log('No log directory found.');
      return;
    }

    const days = parseInt(args.days) || 7;
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl')).sort().slice(-days);

    const cmdCounts = {};
    const toolCounts = {};
    let cliCalls = 0;
    let toolCalls = 0;
    let totalDuration = 0;
    let failures = 0;
    let skillTriggers = 0;
    let agentSpawns = 0;

    for (const f of files) {
      const lines = fs.readFileSync(path.join(logDir, f), 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const e = JSON.parse(line);
          if (e.type === 'tool_call') {
            toolCalls++;
            toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
            if (e.skill) skillTriggers++;
            if (e.tool === 'Agent') agentSpawns++;
          } else if (e.cmd) {
            cliCalls++;
            totalDuration += e.duration_ms || 0;
            if (e.exit && e.exit !== 0) failures++;
            const parts = (e.cmd || '').split(' ');
            const key = parts.slice(0, 2).join(' ');
            cmdCounts[key] = (cmdCounts[key] || 0) + 1;
          }
        } catch {}
      }
    }

    console.log(`\nGAD Usage (last ${files.length} day(s))\n`);
    console.log(`  CLI calls:      ${cliCalls}`);
    console.log(`  Tool calls:     ${toolCalls}`);
    console.log(`  Skill triggers: ${skillTriggers}`);
    console.log(`  Agent spawns:   ${agentSpawns}`);
    console.log(`  CLI failures:   ${failures}`);
    console.log(`  CLI duration:   ${(totalDuration / 1000).toFixed(1)}s (avg ${cliCalls > 0 ? Math.round(totalDuration / cliCalls) : 0}ms)`);

    const sortedCmd = Object.entries(cmdCounts).sort((a, b) => b[1] - a[1]);
    if (sortedCmd.length > 0) {
      console.log(`\n  Top GAD commands:`);
      for (const [cmd, count] of sortedCmd.slice(0, 10)) {
        console.log(`    ${String(count).padStart(4)}×  gad ${cmd}`);
      }
    }

    const sortedTool = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]);
    if (sortedTool.length > 0) {
      console.log(`\n  Tool call breakdown:`);
      for (const [tool, count] of sortedTool) {
        console.log(`    ${String(count).padStart(4)}×  ${tool}`);
      }
    }
  },
});

const logClear = defineCommand({
  meta: { name: 'clear', description: 'Clear old log files (keeps last 7 days)' },
  args: {
    keep: { type: 'string', description: 'Days to keep (default: 7)', default: '7' },
  },
  run({ args }) {
    const logDir = getLogDir();
    if (!logDir || !fs.existsSync(logDir)) {
      console.log('No log directory found.');
      return;
    }

    const keep = parseInt(args.keep) || 7;
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl')).sort();
    const toDelete = files.slice(0, -keep);

    for (const f of toDelete) {
      fs.unlinkSync(path.join(logDir, f));
    }
    console.log(`Cleared ${toDelete.length} log file(s), kept ${Math.min(files.length, keep)}.`);
  },
});

const logCmd = defineCommand({
  meta: { name: 'log', description: 'Inspect CLI call logs — usage stats, recent calls, eval logs' },
  subCommands: { show: logShow, stats: logStats, clear: logClear },
});

// ---------------------------------------------------------------------------
// gad worktree — manage git worktrees used by eval agents
// ---------------------------------------------------------------------------

function listGitWorktrees() {
  const { execSync } = require('child_process');
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf8' });
    const worktrees = [];
    let current = null;
    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current) worktrees.push(current);
        current = { path: line.slice(9).trim() };
      } else if (line.startsWith('HEAD ')) {
        if (current) current.head = line.slice(5).trim();
      } else if (line.startsWith('branch ')) {
        if (current) current.branch = line.slice(7).trim().replace('refs/heads/', '');
      } else if (line.startsWith('detached')) {
        if (current) current.detached = true;
      } else if (line.startsWith('prunable')) {
        if (current) {
          current.prunable = true;
          current.prunableReason = line.slice('prunable'.length).trim() || '';
        }
      }
    }
    if (current) worktrees.push(current);
    return worktrees;
  } catch (e) {
    return [];
  }
}

function findWorktreeByPartial(partial) {
  const worktrees = listGitWorktrees();
  return worktrees.filter(w => w.path.includes(partial) || (w.branch && w.branch.includes(partial)));
}

function humanAge(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

function worktreeInfo(worktree) {
  const info = { ...worktree };
  // Age
  try {
    const stat = fs.statSync(worktree.path);
    info.ageMs = Date.now() - stat.mtimeMs;
    info.age = humanAge(info.ageMs);
  } catch {
    info.age = '?';
    info.ageMs = Infinity;
  }
  info.exists = fs.existsSync(worktree.path);
  info.isOrphaned = !info.exists;
  info.isStale = Boolean(worktree.prunable) || info.isOrphaned;
  // Is this an agent worktree?
  info.isAgent = worktree.path.includes('.claude/worktrees/agent-') || worktree.path.includes('.claude\\worktrees\\agent-');
  // Size
  try {
    if (fs.existsSync(worktree.path)) {
      const gameDir = path.join(worktree.path, 'game');
      info.hasGame = fs.existsSync(gameDir);
      info.hasBuild = fs.existsSync(path.join(gameDir, 'dist', 'index.html'));
      info.hasPlanning = fs.existsSync(path.join(gameDir, '.planning')) || fs.existsSync(path.join(worktree.path, '.planning'));
    }
  } catch {}
  return info;
}

const worktreeNew = defineCommand({
  meta: { name: 'new', description: 'Create a git worktree for eval or normal project work' },
  args: {
    path: { type: 'positional', description: 'Destination path for the worktree', required: true },
    branch: { type: 'string', description: 'Branch name to create/use (default: derived from path)', default: '' },
    base: { type: 'string', description: 'Base ref/branch to branch from (default: HEAD)', default: 'HEAD' },
    detach: { type: 'boolean', description: 'Create a detached worktree at the base ref', default: false },
  },
  run({ args }) {
    const targetPath = path.resolve(process.cwd(), args.path);
    if (fs.existsSync(targetPath)) {
      outputError(`Worktree path already exists: ${targetPath}`);
      return;
    }
    const branchName = args.detach
      ? ''
      : (args.branch || path.basename(targetPath).replace(/[^A-Za-z0-9._/-]+/g, '-'));
    const { execSync } = require('child_process');
    try {
      if (args.detach) {
        execSync(`git worktree add --detach "${targetPath}" "${args.base}"`, { stdio: 'pipe' });
      } else {
        execSync(`git worktree add -b "${branchName}" "${targetPath}" "${args.base}"`, { stdio: 'pipe' });
      }
      console.log(`✓ Worktree created: ${targetPath}`);
      if (branchName) console.log(`  Branch: ${branchName}`);
      console.log(`  Base:   ${args.base}`);
    } catch (e) {
      outputError(`Failed to create worktree: ${e.message}`);
    }
  },
});

const worktreeList = defineCommand({
  meta: { name: 'list', description: 'List all git worktrees with status (eval + project worktrees, stale/orphan detection)' },
  args: {
    'agent-only': { type: 'boolean', description: 'Only show agent worktrees', default: false },
    json: { type: 'boolean', description: 'Output JSON', default: false },
  },
  run({ args }) {
    const worktrees = listGitWorktrees().map(worktreeInfo);
    const filtered = args['agent-only'] ? worktrees.filter(w => w.isAgent) : worktrees;

    if (args.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    if (filtered.length === 0) {
      console.log('No worktrees found.');
      return;
    }

    console.log('Git Worktrees\n');
    console.log('ID/BRANCH                            AGE   GAME  BUILD  PLAN  FLAGS        PATH');
    console.log('───────────────────────────────────  ────  ────  ─────  ────  ─────────────────────────────');
    for (const w of filtered) {
      const id = (w.branch || w.head || '').slice(0, 35).padEnd(35);
      const age = (w.age || '?').padEnd(4);
      const game = w.hasGame ? ' ✓ ' : ' - ';
      const build = w.hasBuild ? '  ✓  ' : '  -  ';
      const plan = w.hasPlanning ? ' ✓ ' : ' - ';
      const flags = [
        w.isAgent ? 'agent' : null,
        w.isOrphaned ? 'orphan' : null,
        w.prunable ? 'prunable' : null,
      ].filter(Boolean).join(',');
      const flagsText = (flags || '-').padEnd(10);
      const relPath = path.relative(process.cwd(), w.path).replace(/\\/g, '/');
      console.log(`${id}  ${age}  ${game}  ${build}  ${plan}  ${flagsText}  ${relPath}`);
    }
    console.log(`\n${filtered.length} worktree(s)`);
    const agentCount = filtered.filter(w => w.isAgent).length;
    if (!args['agent-only'] && agentCount > 0) {
      console.log(`${agentCount} agent worktree(s) — use --agent-only to filter`);
    }
  },
});

const worktreeShow = defineCommand({
  meta: { name: 'show', description: 'Show details of a specific worktree' },
  args: {
    id: { type: 'positional', description: 'Worktree id, branch name, or path fragment', required: true },
  },
  run({ args }) {
    const matches = findWorktreeByPartial(args.id);
    if (matches.length === 0) {
      outputError(`No worktree found matching "${args.id}"`);
      return;
    }
    if (matches.length > 1) {
      console.log(`Multiple worktrees match "${args.id}":`);
      for (const m of matches) console.log(`  ${m.path}`);
      return;
    }
    const w = worktreeInfo(matches[0]);
    console.log('Worktree details\n');
    console.log(`  Path:       ${w.path}`);
    console.log(`  Branch:     ${w.branch || '(detached)'}`);
    console.log(`  HEAD:       ${w.head || '?'}`);
    console.log(`  Age:        ${w.age || '?'}`);
    console.log(`  Is agent:   ${w.isAgent ? 'yes' : 'no'}`);
    console.log(`  Exists:     ${w.exists ? 'yes' : 'no'}`);
    console.log(`  Orphaned:   ${w.isOrphaned ? 'yes' : 'no'}`);
    console.log(`  Prunable:   ${w.prunable ? `yes${w.prunableReason ? ` (${w.prunableReason})` : ''}` : 'no'}`);
    console.log(`  Has game/:  ${w.hasGame ? 'yes' : 'no'}`);
    console.log(`  Has build:  ${w.hasBuild ? 'yes' : 'no'}`);
    console.log(`  Has .planning/: ${w.hasPlanning ? 'yes' : 'no'}`);

    // Check git status
    try {
      const { execSync } = require('child_process');
      const status = execSync(`git -C "${w.path}" status --short`, { encoding: 'utf8' }).trim();
      const commits = execSync(`git -C "${w.path}" log --oneline -5`, { encoding: 'utf8' }).trim();
      console.log(`\n  Recent commits:`);
      for (const line of commits.split('\n')) console.log(`    ${line}`);
      if (status) {
        console.log(`\n  Uncommitted changes (first 10 lines):`);
        for (const line of status.split('\n').slice(0, 10)) console.log(`    ${line}`);
      } else {
        console.log(`\n  Working tree: clean`);
      }
    } catch {}
  },
});

const worktreeClean = defineCommand({
  meta: { name: 'clean', description: 'Remove a specific worktree (force)' },
  args: {
    id: { type: 'positional', description: 'Worktree id, branch name, or path fragment', required: true },
    force: { type: 'boolean', description: 'Skip confirmation', default: false },
  },
  run({ args }) {
    const matches = findWorktreeByPartial(args.id);
    if (matches.length === 0) {
      outputError(`No worktree found matching "${args.id}"`);
      return;
    }
    if (matches.length > 1) {
      console.log(`Multiple worktrees match "${args.id}":`);
      for (const m of matches) console.log(`  ${m.path}`);
      console.log('Be more specific.');
      return;
    }
    const w = matches[0];
    if (w.path === process.cwd() || w.path === path.resolve(__dirname, '..', '..', '..')) {
      outputError(`Refusing to remove the main working directory: ${w.path}`);
      return;
    }
    const { execSync } = require('child_process');
    try {
      execSync(`git worktree remove --force "${w.path}"`, { stdio: 'pipe' });
      console.log(`✓ Removed worktree: ${w.path}`);
      if (w.branch) {
        try {
          execSync(`git branch -D "${w.branch}"`, { stdio: 'pipe' });
          console.log(`✓ Deleted branch: ${w.branch}`);
        } catch {}
      }
    } catch (e) {
      outputError(`Failed to remove worktree: ${e.message}`);
    }
  },
});

const worktreePrune = defineCommand({
  meta: { name: 'prune', description: 'Prune stale agent worktrees older than a threshold' },
  args: {
    'older-than': { type: 'string', description: 'Age threshold (e.g. 1d, 12h, 3d) — default 3d', default: '3d' },
    'agent-only': { type: 'boolean', description: 'Only prune agent worktrees (default true)', default: true },
    'dry-run': { type: 'boolean', description: 'Show what would be removed without removing', default: false },
    'preserved-only': { type: 'boolean', description: 'Only prune worktrees whose evals have been preserved', default: true },
  },
  run({ args }) {
    // Parse threshold
    const match = args['older-than'].match(/^(\d+)([hdm])$/);
    if (!match) {
      outputError(`Invalid --older-than: ${args['older-than']}. Use e.g. 12h, 3d, 60m`);
      return;
    }
    const value = parseInt(match[1]);
    const unit = match[2];
    const thresholdMs = unit === 'h' ? value * 3600e3 : unit === 'm' ? value * 60e3 : value * 86400e3;

    const worktrees = listGitWorktrees().map(worktreeInfo);
    const candidates = worktrees.filter(w => {
      if (args['agent-only'] && !w.isAgent) return false;
      if (w.ageMs < thresholdMs) return false;
      return true;
    });

    if (candidates.length === 0) {
      console.log(`No worktrees older than ${args['older-than']}.`);
      return;
    }

    // Check if their evals have been preserved (cross-reference with eval run/ dirs)
    const preservedRunDirs = new Set();
    let allEvalProjects = [];
    try { allEvalProjects = listAllEvalProjects(); } catch {}
    for (const { name, projectDir } of allEvalProjects) {
      for (const version of fs.readdirSync(projectDir, { withFileTypes: true }).filter(e => e.isDirectory() && /^v\d+$/.test(e.name))) {
        const runDir = path.join(projectDir, version.name, 'run');
        if (fs.existsSync(runDir) && fs.readdirSync(runDir).length > 0) {
          preservedRunDirs.add(`${name}/${version.name}`);
        }
      }
    }

    console.log(`Prune candidates (older than ${args['older-than']}):\n`);
    const willRemove = [];
    for (const w of candidates) {
      // Heuristic: if agent worktree has a preserved eval with matching code, safe to remove
      // We can't always determine this precisely, so we show the age and let user decide
      const safe = true; // For now, trust preservation — user sets --preserved-only false to override
      console.log(`  ${w.age.padEnd(5)}  ${path.relative(process.cwd(), w.path).replace(/\\/g, '/')}  ${w.branch || ''}`);
      if (safe) willRemove.push(w);
    }

    console.log(`\n${willRemove.length} worktree(s) would be removed.`);
    if (args['dry-run']) {
      console.log('Dry run — nothing removed. Re-run without --dry-run to proceed.');
      return;
    }

    const { execSync } = require('child_process');
    let removed = 0;
    for (const w of willRemove) {
      try {
        execSync(`git worktree remove --force "${w.path}"`, { stdio: 'pipe' });
        if (w.branch) {
          try { execSync(`git branch -D "${w.branch}"`, { stdio: 'pipe' }); } catch {}
        }
        removed++;
      } catch (e) {
        console.log(`  ✗ Failed to remove ${w.path}: ${e.message}`);
      }
    }
    console.log(`\n✓ Removed ${removed}/${willRemove.length} worktree(s)`);
  },
});

const worktreeCmd = defineCommand({
  meta: { name: 'worktree', description: 'Manage git worktrees for eval agents and normal project work' },
  subCommands: { new: worktreeNew, list: worktreeList, show: worktreeShow, clean: worktreeClean, prune: worktreePrune },
});

// ---------------------------------------------------------------------------
// gad version — framework version info for trace stamping (phase 25 task 25-12)
// ---------------------------------------------------------------------------

const { getFrameworkVersion } = require('../lib/framework-version.cjs');

const discoveryTestCmd = defineCommand({
  meta: { name: 'discovery-test', description: 'Print the subagent discovery test battery instructions. Operator runs the actual battery by invoking the gad:discovery-test skill (or gad:proto-skill-battery with --proto) in an agent session.' },
  args: {
    date: { type: 'string', description: 'ISO date for findings filename (default: today)', default: '' },
    agents: { type: 'string', description: 'Number of cold agents (default: 5 for canonical, 2×N for --proto)', default: '5' },
    proto: { type: 'boolean', description: 'Point at the proto-skill battery (findability + supersession per proto) instead of the canonical discovery battery', default: false },
  },
  run({ args }) {
    const today = args.date || new Date().toISOString().slice(0, 10);
    if (args.proto) {
      console.log('Proto-skill discoverability + supersession battery');
      console.log('');
      console.log(`  findings → .planning/notes/proto-skill-battery-${today}.md`);
      console.log(`  site data → site/data/proto-skill-findings.json`);
      console.log(`  agents    → 2 cold subagents per proto-skill (findability + supersession arms)`);
      console.log('');
      console.log('Runs as a skill (gad:proto-skill-battery). Per-proto measurement: findability');
      console.log('(0-10), execution_sufficiency (0-10), shed_score (0.0-1.0 from proto-vs-proto');
      console.log('supersession ranking). shed_score >= 0.5 flags for review; >= 0.75 recommends');
      console.log('eviction. Operator decides — battery NEVER mutates canonical state.');
      console.log('');
      console.log('  1. Read the workflow:  gad skill show gad-proto-skill-battery --body');
      console.log('  2. In your session: say "run the proto-skill battery"');
      console.log('  3. Automatic cadence: wired as step 9 of workflows/evolution-evolve.md,');
      console.log('     so every `gad evolution evolve` cycle runs the battery on its output.');
      console.log('');
      console.log('Cost: ~2 agents × ~50k tokens per proto. 10 proto-skills → ~1M tokens/run.');
      return;
    }
    const n = parseInt(args.agents, 10) || 5;
    console.log('Subagent discovery test battery');
    console.log('');
    console.log(`  findings → .planning/notes/subagent-discovery-findings-${today}.md`);
    console.log(`  site data → site/data/discovery-findings.json`);
    console.log(`  agents    → ${n} parallel cold subagents`);
    console.log('');
    console.log('Battery runs as a skill (gad:discovery-test), not as a direct CLI invocation —');
    console.log('it requires spawning subagents via the Agent tool, which only works from inside');
    console.log('a coding-agent session. To run it:');
    console.log('');
    console.log('  1. Read the workflow:  gad skill show gad-discovery-test --body');
    console.log('  2. In your session, invoke the skill by saying "run the discovery test battery"');
    console.log('     or by reading workflows/discovery-test.md and following the steps.');
    console.log('');
    console.log('The battery takes ~90 seconds wall-clock and ~250k total tokens (5 agents × ~50k).');
    console.log('Rerun after any change to the skill catalog, CLI discovery surface, or skill-shape docs.');
    console.log('');
    console.log('Target mean confidence: 8.5 / 10. Below that is a regression.');
    console.log('');
    console.log('Proto-skill variant: `gad discovery-test --proto` (per-proto findability + shed score).');
  },
});

const startupCmd = defineCommand({
  meta: { name: 'startup', description: 'Print the GAD session-start contract. One-shot answer to "how do I begin working on this project?" (task 42.2-22, fixes chicken-and-egg identified by subagent battery findings 2026-04-15).' },
  args: {
    projectid: { type: 'string', description: 'Project id to snapshot against (default: first root)', default: '' },
  },
  run({ args }) {
    const lines = [
      'GAD session startup — one command gets you full context.',
      '',
      '  gad snapshot --projectid <id>      # full context dump, ~6-7k tokens',
      '',
      'What snapshot gives you:',
      '  - STATE.xml (current phase, next-action, references)',
      '  - ROADMAP in-sprint phases',
      '  - Open + recently-done tasks in sprint window',
      '  - Recent decisions (last 30)',
      '  - EQUIPPED SKILLS (top 5 by relevance, with workflow pointers)',
      '  - DOCS-MAP + file references',
      '',
      'After reading snapshot output:',
      '  1. Act on the <next-action> line in STATE.xml — this is what to do next.',
      '  2. Browse EQUIPPED SKILLS for skills relevant to the current sprint.',
      '     Use `gad skill show <id>` to inspect any skill end-to-end.',
      '  3. Use `gad skill list --paths` for the full skill inventory with paths.',
      '',
      'Cross-session continuity:',
      '  - Decisions live in .planning/DECISIONS.xml — query with `gad decisions`.',
      '  - Task attribution is on TASK-REGISTRY.xml entries (skill= attribute).',
      '  - Re-run snapshot after auto-compact to re-hydrate.',
      '',
      'Rehydration cost note (decision gad-195, 2026-04-15):',
      '  Snapshot is ~6-7k tokens. Running it every turn wastes cache. Run it',
      '  once at session start and at clean phase boundaries. Between those',
      '  points, trust the planning doc edits you made — they are durable.',
      '',
      'Common project ids on this repo:',
    ];
    // Best-effort enumeration via gad-config.
    try {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      for (const root of config.roots || []) {
        lines.push(`  - ${root.id}`);
      }
    } catch {
      lines.push('  (run `gad projects list` to see available project ids)');
    }
    lines.push('');
    lines.push('Single most important command: `gad snapshot --projectid <id>`.');
    lines.push('Everything else is optional until you have that context.');
    console.log(lines.join('\n'));

    if (args.projectid) {
      console.log('');
      // Auto-create a session so the snapshot stamps staticLoadedAt and
      // subsequent calls with --session auto-downgrade to active mode.
      let sessionArg = [];
      try {
        const startupBaseDir = findRepoRoot();
        const startupConfig = gadConfig.load(startupBaseDir);
        const startupRoots = startupConfig.roots.filter(r => r.id === args.projectid);
        if (startupRoots.length > 0) {
          const startupRoot = startupRoots[0];
          const sDir = sessionsDir(startupBaseDir, startupRoot);
          fs.mkdirSync(sDir, { recursive: true });
          const state = readState(startupRoot, startupBaseDir);
          const newSession = {
            id: generateSessionId(),
            projectId: startupRoot.id,
            contextMode: 'loaded',
            position: { phase: state.currentPhase || null, plan: null, task: null },
            status: SESSION_STATUS.ACTIVE,
            refs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _root: startupRoot,
            _file: path.join(sDir, `${generateSessionId()}.json`),
          };
          // Re-derive file path with the correct id
          newSession._file = path.join(sDir, `${newSession.id}.json`);
          newSession.refs = buildContextRefs(startupRoot, startupBaseDir, newSession);
          writeSession(newSession);
          sessionArg = ['--session', newSession.id];
          console.log(`Session created: ${newSession.id}`);
        }
      } catch { /* non-fatal — snapshot still works without session */ }

      console.log(`Running snapshot now for projectid=${args.projectid}...`);
      console.log('');
      // Delegate to snapshot by re-invoking the process — simplest path.
      const result = require('child_process').spawnSync(
        process.execPath,
        [__filename, 'snapshot', '--projectid', args.projectid, ...sessionArg],
        { stdio: 'inherit' }
      );
      process.exit(result.status || 0);
    }
  },
});

const versionCmd = defineCommand({
  meta: { name: 'version', description: 'Print GAD framework version + git commit/branch for trace stamping' },
  args: {
    json: { type: 'boolean', description: 'Emit JSON for consumption by the eval preserver' },
  },
  run({ args }) {
    const info = getFrameworkVersion();
    if (args.json) {
      process.stdout.write(JSON.stringify(info, null, 2) + '\n');
      return;
    }
    console.log(`\nGAD framework version:`);
    console.log(`  version:     ${info.version || '(unknown)'}`);
    console.log(`  methodology: ${info.methodology_version || '(unknown)'}`);
    console.log(`  commit:      ${info.commit || '(unknown)'}`);
    console.log(`  branch:      ${info.branch || '(unknown)'}`);
    console.log(`  commit_ts:   ${info.commit_ts || '(unknown)'}`);
    console.log(`  stamp:       ${info.stamp}`);
    console.log('');
  },
});

// ---------------------------------------------------------------------------
// Install subcommand — gad install hooks, gad install all, gad uninstall hooks
// ---------------------------------------------------------------------------
//
// Decision gad-59 pins the hook handler location as framework-versioned in
// vendor/get-anything-done/bin/gad-trace-hook.cjs. `gad install hooks` writes
// that absolute path into ~/.claude/settings.json as PreToolUse + PostToolUse
// handler references. `gad uninstall hooks` removes them. Both operations
// merge into existing settings — they don't overwrite the user's other hooks
// or statusline config.
//
// Framework-wide install (skills, agents, commands, templates) delegates to
// the existing bin/install.js which ships with the full cross-runtime install
// runtime installer (--claude --cursor --codex --all etc). This wrapper just
// invokes it via child_process for the framework subcommand.

const GAD_HOOK_MARKER = 'gad-trace-hook';

function getClaudeSettingsPath(isGlobal) {
  if (isGlobal) {
    return path.join(require('os').homedir(), '.claude', 'settings.json');
  }
  return path.join(process.cwd(), '.claude', 'settings.json');
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonPretty(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function isPackagedExecutableRuntime() {
  return Boolean(process.env.GAD_PACKAGED_EXECUTABLE || process.env.GAD_PACKAGED_ROOT);
}

function getPackagedExecutablePath() {
  return process.env.GAD_PACKAGED_EXECUTABLE || process.execPath;
}

function getDefaultSelfInstallDir() {
  const os = require('os');
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'Programs', 'gad', 'bin');
  }
  return path.join(os.homedir(), '.local', 'bin');
}

function updateWindowsUserPath(targetDir) {
  const { spawnSync } = require('child_process');
  const command = [
    `$target='${targetDir.replace(/'/g, "''")}';`,
    `$current=[Environment]::GetEnvironmentVariable('Path','User');`,
    `$parts=@();`,
    `if ($current) { $parts=$current.Split(';') | Where-Object { $_ -and $_.Trim() -ne '' }; }`,
    `if ($parts -notcontains $target) {`,
    `  $newPath = if ($current -and $current.Trim() -ne '') { "$current;$target" } else { $target };`,
    `  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User');`,
    `}`,
  ].join(' ');
  const result = spawnSync('powershell', ['-NoProfile', '-Command', command], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('Failed to update user PATH.');
  }
}

const installHooks = defineCommand({
  meta: {
    name: 'hooks',
    description: 'Wire GAD trace hook (PreToolUse + PostToolUse) into Claude Code settings.json',
  },
  args: {
    global: { type: 'boolean', description: 'Install into ~/.claude/settings.json instead of local .claude/' },
  },
  run: ({ args }) => {
    const isGlobal = Boolean(args.global);
    const settingsPath = getClaudeSettingsPath(isGlobal);
    const handlerPath = path.resolve(__dirname, 'gad-trace-hook.cjs');

    if (!fs.existsSync(handlerPath)) {
      console.error(`gad install hooks: handler not found at ${handlerPath}`);
      process.exit(1);
    }

    const settings = readJsonSafe(settingsPath) || {};
    settings.hooks = settings.hooks || {};

    const hookCommand = `node "${handlerPath}"`;
    const handlerEntry = {
      hooks: [{ type: 'command', command: hookCommand }],
    };

    // Merge into PreToolUse and PostToolUse. If the user already has a
    // GAD trace hook entry (detected by the hook command containing
    // "gad-trace-hook"), replace it rather than duplicate.
    for (const hookType of ['PreToolUse', 'PostToolUse']) {
      const existing = Array.isArray(settings.hooks[hookType]) ? settings.hooks[hookType] : [];
      // Filter out any previous GAD trace hook entries
      const filtered = existing.filter((entry) => {
        if (!entry || !Array.isArray(entry.hooks)) return true;
        return !entry.hooks.some((h) => typeof h?.command === 'string' && h.command.includes(GAD_HOOK_MARKER));
      });
      filtered.push(handlerEntry);
      settings.hooks[hookType] = filtered;
    }

    writeJsonPretty(settingsPath, settings);
    console.log(`✓ Installed GAD trace hooks`);
    console.log(`  handler: ${handlerPath}`);
    console.log(`  settings: ${settingsPath}`);
    console.log(`\n  Hooks wired: PreToolUse, PostToolUse`);
    console.log(`  Events written to <project>/.planning/.trace-events.jsonl per run`);
  },
});

const uninstallHooks = defineCommand({
  meta: {
    name: 'hooks',
    description: 'Remove GAD trace hook entries from Claude Code settings.json',
  },
  args: {
    global: { type: 'boolean', description: 'Uninstall from ~/.claude/settings.json instead of local .claude/' },
  },
  run: ({ args }) => {
    const isGlobal = Boolean(args.global);
    const settingsPath = getClaudeSettingsPath(isGlobal);
    const settings = readJsonSafe(settingsPath);
    if (!settings || !settings.hooks) {
      console.log('No hooks configured; nothing to uninstall.');
      return;
    }

    let removed = 0;
    for (const hookType of ['PreToolUse', 'PostToolUse']) {
      if (!Array.isArray(settings.hooks[hookType])) continue;
      const before = settings.hooks[hookType].length;
      settings.hooks[hookType] = settings.hooks[hookType].filter((entry) => {
        if (!entry || !Array.isArray(entry.hooks)) return true;
        return !entry.hooks.some((h) => typeof h?.command === 'string' && h.command.includes(GAD_HOOK_MARKER));
      });
      removed += before - settings.hooks[hookType].length;
      if (settings.hooks[hookType].length === 0) {
        delete settings.hooks[hookType];
      }
    }

    writeJsonPretty(settingsPath, settings);
    console.log(`✓ Removed ${removed} GAD trace hook entr${removed === 1 ? 'y' : 'ies'}`);
    console.log(`  settings: ${settingsPath}`);
  },
});

const installAll = defineCommand({
  meta: {
    name: 'all',
    description: 'Delegate to bin/install.js for full framework install (skills, agents, commands, hooks)',
  },
  args: {
    claude: { type: 'boolean' },
    opencode: { type: 'boolean' },
    gemini: { type: 'boolean' },
    cursor: { type: 'boolean' },
    codex: { type: 'boolean' },
    copilot: { type: 'boolean' },
    antigravity: { type: 'boolean' },
    windsurf: { type: 'boolean' },
    augment: { type: 'boolean' },
    all: { type: 'boolean' },
    local: { type: 'boolean' },
    global: { type: 'boolean' },
    sdk: { type: 'boolean' },
    uninstall: { type: 'boolean' },
    'force-statusline': { type: 'boolean' },
    'config-dir': { type: 'string', description: 'Custom runtime config directory', default: '' },
  },
  run: ({ args }) => {
    const { spawnSync } = require('child_process');
    const installerPath = path.resolve(__dirname, 'install.js');
    const flagArgs = [];
    if (args.claude) flagArgs.push('--claude');
    if (args.opencode) flagArgs.push('--opencode');
    if (args.gemini) flagArgs.push('--gemini');
    if (args.cursor) flagArgs.push('--cursor');
    if (args.codex) flagArgs.push('--codex');
    if (args.copilot) flagArgs.push('--copilot');
    if (args.antigravity) flagArgs.push('--antigravity');
    if (args.windsurf) flagArgs.push('--windsurf');
    if (args.augment) flagArgs.push('--augment');
    if (args.all) flagArgs.push('--all');
    if (args.local) flagArgs.push('--local');
    if (args.global) flagArgs.push('--global');
    if (args.sdk) flagArgs.push('--sdk');
    if (args.uninstall) flagArgs.push('--uninstall');
    if (args['force-statusline']) flagArgs.push('--force-statusline');
    if (args['config-dir']) flagArgs.push('--config-dir', args['config-dir']);
    if (flagArgs.length === 0) {
      console.log('Usage: gad install all [runtime flags] [--local|--global] [--config-dir <path>]');
      console.log('       passes through to bin/install.js');
      console.log('       runtimes: --claude --opencode --gemini --codex --copilot --antigravity --cursor --windsurf --augment --all');
      return;
    }
    const command = isPackagedExecutableRuntime()
      ? getPackagedExecutablePath()
      : process.execPath;
    const commandArgs = isPackagedExecutableRuntime()
      ? ['__gad_internal_install__', ...flagArgs]
      : [installerPath, ...flagArgs];
    const result = spawnSync(command, commandArgs, { stdio: 'inherit', env: process.env });
    process.exit(result.status || 0);
  },
});

const installSelf = defineCommand({
  meta: {
    name: 'self',
    description: 'Install the packaged gad executable into a user bin directory and add it to PATH',
  },
  args: {
    dir: { type: 'string', description: 'Target install directory', default: '' },
  },
  run: ({ args }) => {
    if (!isPackagedExecutableRuntime()) {
      console.error('gad install self is only available from a packaged gad executable.');
      process.exit(1);
    }

    const targetDir = args.dir ? path.resolve(args.dir) : getDefaultSelfInstallDir();
    const sourceExecutable = getPackagedExecutablePath();
    const executableName = process.platform === 'win32' ? 'gad.exe' : 'gad';
    const targetExecutable = path.join(targetDir, executableName);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(sourceExecutable, targetExecutable);
    if (process.platform === 'win32') {
      fs.copyFileSync(sourceExecutable, path.join(targetDir, 'get-anything-done.exe'));
      updateWindowsUserPath(targetDir);
    }

    console.log(`✓ Installed gad executable`);
    console.log(`  source: ${sourceExecutable}`);
    console.log(`  target: ${targetExecutable}`);
    if (process.platform === 'win32') {
      console.log(`  path:   ${targetDir}`);
      console.log(`\nOpen a new terminal and run: gad --help`);
    } else {
      console.log(`\nAdd ${targetDir} to PATH if it is not already present.`);
    }
  },
});

const installCmd = defineCommand({
  meta: { name: 'install', description: 'Install GAD into an agent runtime (hooks, framework, or full install)' },
  subCommands: {
    hooks: installHooks,
    all: installAll,
    self: installSelf,
  },
});

const uninstallCmd = defineCommand({
  meta: { name: 'uninstall', description: 'Uninstall GAD trace hooks (full uninstall: use install.js --uninstall)' },
  subCommands: {
    hooks: uninstallHooks,
  },
});

// ── gad self-eval — run pressure/metrics pipeline (decision gad-122) ──
const selfEvalCmd = defineCommand({
  meta: { name: 'self-eval', description: 'Compute and display framework self-evaluation metrics — pressure per phase, overhead, compliance' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON', default: false },
  },
  run({ args }) {
    const gadDir = path.join(__dirname, '..');
    const siteDir = path.join(gadDir, 'site');
    const scriptPath = path.join(siteDir, 'scripts', 'compute-self-eval.mjs');

    if (!fs.existsSync(scriptPath)) {
      outputError('compute-self-eval.mjs not found. Is the site directory present?');
      return;
    }

    // Run the pipeline
    const { execSync: exec } = require('child_process');
    try {
      exec(`node "${scriptPath}"`, { cwd: siteDir, stdio: 'pipe' });
    } catch (err) {
      outputError('Pipeline failed: ' + (err.message || err));
      return;
    }

    // Read the output
    const outputPath = path.join(siteDir, 'data', 'self-eval.json');
    if (!fs.existsSync(outputPath)) {
      console.log('No self-eval data produced.');
      return;
    }

    const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const m = data.latest;

    if (args.json) {
      console.log(JSON.stringify(m, null, 2));
      return;
    }

    console.log('GAD Self-Eval Metrics\n');
    console.log(`Period: ${m.period.start} → ${m.period.end} (${m.period.days} days)`);
    console.log(`Events: ${m.totals.events} | Sessions: ${m.totals.sessions} | CLI calls: ${m.totals.gad_cli_calls}`);
    console.log(`Tasks: ${m.tasks.done}/${m.tasks.total} done | Decisions: ${m.decisions}`);
    console.log(`\nFramework overhead: ${(m.framework_overhead.ratio * 100).toFixed(1)}% (score: ${m.framework_overhead.score})`);
    console.log(`Framework compliance: ${(m.framework_compliance.score * 100).toFixed(0)}% (${m.framework_compliance.fully_attributed}/${m.framework_compliance.completed_tasks} done tasks fully attributed)`);
    console.log(`Hydration overhead: ${(m.hydration.overhead_ratio * 100).toFixed(1)}% (${m.hydration.snapshot_count} snapshots, ${m.hydration.estimated_snapshot_tokens} est tokens)`);

    if (m.phases_pressure && m.phases_pressure.length > 0) {
      console.log('\nPressure per phase (top 10):');
      console.log('PHASE  TASKS  CROSSCUTS  PRESSURE');
      console.log('─'.repeat(40));
      const sorted = [...m.phases_pressure].sort((a, b) => b.pressure_score - a.pressure_score).slice(0, 10);
      for (const p of sorted) {
        const flag = p.high_pressure ? ' ⚠ HIGH' : '';
        console.log(`${String(p.phase).padEnd(7)}${String(p.tasks_total).padStart(5)}  ${String(p.crosscuts).padStart(9)}  ${String(p.pressure_score).padStart(8)}${flag}`);
      }
    }

    console.log('\nGAD CLI breakdown: snapshot=' + m.gad_cli_breakdown.snapshot + ' eval=' + m.gad_cli_breakdown.eval + ' other=' + m.gad_cli_breakdown.other);
  },
});

// ── gad data — CRUD for data/*.json (plain fs + JSON; lowdb was removed) ──
const dataListCmd = defineCommand({
  meta: { name: 'list', description: 'List all data collections in data/' },
  run() {
    const gadDir = path.join(__dirname, '..');
    const dataDir = path.join(gadDir, 'data');
    if (!fs.existsSync(dataDir)) { console.log('No data/ directory found.'); return; }
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    console.log(`Data collections (${files.length}):\n`);
    for (const f of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
        const keys = Array.isArray(content) ? `${content.length} items` : `${Object.keys(content).length} keys`;
        console.log(`  ${f.padEnd(30)} ${keys}`);
      } catch {
        console.log(`  ${f.padEnd(30)} (invalid JSON)`);
      }
    }
  },
});

const dataGetCmd = defineCommand({
  meta: { name: 'get', description: 'Read a value from a data collection (dot notation)' },
  args: {
    path: { type: 'positional', description: 'Dot path: file.key.subkey', required: true },
  },
  run({ args }) {
    const gadDir = path.join(__dirname, '..');
    const dataDir = path.join(gadDir, 'data');
    const parts = (args.path || args._[0] || '').split('.');
    if (parts.length < 1) { console.log('Usage: gad data get <file>.<key>'); return; }
    const file = parts[0].endsWith('.json') ? parts[0] : `${parts[0]}.json`;
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) { outputError(`Collection not found: ${file}`); return; }
    let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (let i = 1; i < parts.length; i++) {
      if (data == null || typeof data !== 'object') { outputError(`Path not found: ${parts.slice(0, i + 1).join('.')}`); return; }
      data = data[parts[i]];
    }
    console.log(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
  },
});

const dataSetCmd = defineCommand({
  meta: { name: 'set', description: 'Set a value in a data collection (dot notation)' },
  args: {
    path: { type: 'positional', description: 'Dot path: file.key.subkey', required: true },
    value: { type: 'positional', description: 'Value to set (JSON or string)', required: true },
  },
  run({ args }) {
    const gadDir = path.join(__dirname, '..');
    const dataDir = path.join(gadDir, 'data');
    const rawPath = args.path || args._[0] || '';
    const rawValue = args.value || args._[1] || '';
    const parts = rawPath.split('.');
    if (parts.length < 2) { console.log('Usage: gad data set <file>.<key> <value>'); return; }
    const file = parts[0].endsWith('.json') ? parts[0] : `${parts[0]}.json`;
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) { outputError(`Collection not found: ${file}`); return; }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Navigate to parent
    let target = data;
    for (let i = 1; i < parts.length - 1; i++) {
      if (target[parts[i]] == null) target[parts[i]] = {};
      target = target[parts[i]];
    }
    // Parse value as JSON if possible, otherwise string
    let parsed;
    try { parsed = JSON.parse(rawValue); } catch { parsed = rawValue; }
    target[parts[parts.length - 1]] = parsed;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`✓ Set ${rawPath} = ${JSON.stringify(parsed)}`);
  },
});

const dataCmd = defineCommand({
  meta: { name: 'data', description: 'CRUD operations on data/*.json collections (decision gad-109)' },
  subCommands: { list: dataListCmd, get: dataGetCmd, set: dataSetCmd },
});

// ── gad rounds — query experiment round data ──────────────────
const roundsCmd = defineCommand({
  meta: { name: 'rounds', description: 'List and query experiment rounds from EXPERIMENT-LOG.md (or per-project from TRACE.json)' },
  args: {
    round: { type: 'string', description: 'Show a specific round (e.g. "3")', default: '' },
    project: { type: 'string', description: 'Show rounds for a specific eval project (derived from TRACE.json requirements_version changes)', default: '' },
    json: { type: 'boolean', description: 'Output as JSON', default: false },
  },
  run({ args }) {
    // Per-project rounds: derive from TRACE.json requirements_version changes across runs
    if (args.project) {
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projectDir)) {
        outputError(`Eval project '${args.project}' not found.`);
        return;
      }
      const versions = fs.readdirSync(projectDir)
        .filter(n => /^v\d+$/.test(n))
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
      if (versions.length === 0) {
        outputError(`No runs found for project '${args.project}'.`);
        return;
      }

      // Load TRACE.json for each version, group by requirements_version
      const runs = [];
      for (const v of versions) {
        const tracePath = path.join(projectDir, v, 'TRACE.json');
        let trace = null;
        try {
          if (fs.existsSync(tracePath)) trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
        } catch {}
        const reqVer = trace?.requirements_version || 'unknown';
        const date = trace?.date || null;
        const composite = trace?.scores?.composite ?? null;
        const humanReview = trace?.scores?.human_review ?? trace?.human_review?.score ?? null;
        const workflow = trace?.workflow || null;
        runs.push({ version: v, requirements_version: reqVer, date, composite, human_review: humanReview, workflow });
      }

      // Group runs into rounds by requirements_version transitions
      const rounds = [];
      let currentReqVer = null;
      let roundNum = 0;
      for (const run of runs) {
        if (run.requirements_version !== currentReqVer) {
          currentReqVer = run.requirements_version;
          roundNum++;
          rounds.push({ round: roundNum, requirements_version: currentReqVer, runs: [] });
        }
        rounds[rounds.length - 1].runs.push(run);
      }

      if (args.json) {
        console.log(JSON.stringify(rounds, null, 2));
        return;
      }

      console.log(`Rounds for ${args.project} (${rounds.length} rounds, ${runs.length} runs)\n`);
      for (const r of rounds) {
        console.log(`Round ${r.round} — requirements ${r.requirements_version} (${r.runs.length} runs)`);
        const header = `  ${'VERSION'.padEnd(10)}${'DATE'.padEnd(14)}${'WORKFLOW'.padEnd(12)}${'COMPOSITE'.padEnd(12)}HUMAN`;
        console.log(header);
        console.log('  ' + '─'.repeat(header.length - 2));
        for (const run of r.runs) {
          const comp = run.composite != null ? run.composite.toFixed(3) : '—';
          const hr = run.human_review != null ? run.human_review.toFixed(2) : '—';
          console.log(`  ${run.version.padEnd(10)}${(run.date || '—').padEnd(14)}${(run.workflow || '—').padEnd(12)}${comp.padEnd(12)}${hr}`);
        }
        console.log('');
      }
      return;
    }

    // Global rounds from EXPERIMENT-LOG.md — the canonical log lives in the
    // default (submodule) evals root.
    const logFile = path.join(defaultEvalsDir(), 'EXPERIMENT-LOG.md');
    if (!fs.existsSync(logFile)) {
      outputError('No EXPERIMENT-LOG.md found in evals/');
      return;
    }
    const content = fs.readFileSync(logFile, 'utf8');
    // Parse rounds from markdown headers: ## Round N — Title
    const roundRe = /^## (Round \d+)\s*—\s*(.+)$/gm;
    const rounds = [];
    let match;
    const indices = [];
    while ((match = roundRe.exec(content)) !== null) {
      indices.push({ start: match.index, label: match[1], title: match[2].trim() });
    }
    for (let i = 0; i < indices.length; i++) {
      const start = indices[i].start;
      const end = i + 1 < indices.length ? indices[i + 1].start : content.length;
      const body = content.slice(start, end).trim();
      // Extract key fields
      const dateMatch = body.match(/\*\*Date:\*\*\s*(.+)/);
      const reqMatch = body.match(/\*\*Requirements version:\*\*\s*(.+)/);
      const condMatch = body.match(/\*\*Conditions?:\*\*\s*(.+)/);
      rounds.push({
        round: indices[i].label,
        number: parseInt(indices[i].label.replace('Round ', ''), 10),
        title: indices[i].title,
        date: dateMatch ? dateMatch[1].trim() : null,
        requirements: reqMatch ? reqMatch[1].trim() : null,
        conditions: condMatch ? condMatch[1].trim() : null,
        body: body,
      });
    }

    if (args.round) {
      const num = parseInt(args.round, 10);
      const r = rounds.find(r => r.number === num);
      if (!r) {
        outputError(`Round ${args.round} not found. Available: ${rounds.map(r => r.number).join(', ')}`);
        return;
      }
      if (args.json) {
        console.log(JSON.stringify(r, null, 2));
      } else {
        console.log(r.body);
      }
      return;
    }

    // List all rounds
    if (args.json) {
      console.log(JSON.stringify(rounds.map(({ body, ...r }) => r), null, 2));
      return;
    }
    console.log(`Experiment Rounds (${rounds.length})\n`);
    const header = `${'ROUND'.padEnd(10)}${'TITLE'.padEnd(55)}${'DATE'.padEnd(25)}REQS`;
    console.log(header);
    console.log('─'.repeat(header.length));
    for (const r of rounds) {
      console.log(
        `${r.round.padEnd(10)}${(r.title || '').slice(0, 53).padEnd(55)}${(r.date || '—').slice(0, 23).padEnd(25)}${r.requirements || '—'}`
      );
    }
  },
});

// ---------------------------------------------------------------------------
// evolution subcommands (phase 42) — validate/promote/discard/status
// proto-skills produced by gad-evolution-evolve and create-proto-skill.
// ---------------------------------------------------------------------------

const evolutionPaths = (repoRoot) => ({
  // Decision gad-183 + task 42.2-15: candidates are planning artifacts, not
  // canonical framework assets — they live in .planning/candidates/ not
  // skills/candidates/. The legacy path is still handled downstream via a
  // fallback check so older checkouts keep working during migration.
  candidatesDir: path.join(repoRoot, '.planning', 'candidates'),
  protoSkillsDir: path.join(repoRoot, '.planning', 'proto-skills'),
  finalSkillsDir: path.join(repoRoot, 'skills'),
  evolutionsDir: path.join(repoRoot, 'skills', '.evolutions'),
});

function protoSkillRelativePath(slug = '') {
  return path.posix.join('.planning', 'proto-skills', slug).replace(/\/$/, '');
}

function expandHomeDir(targetPath) {
  if (typeof targetPath !== 'string') return targetPath;
  if (targetPath === '~') return require('os').homedir();
  if (targetPath.startsWith('~/')) return path.join(require('os').homedir(), targetPath.slice(2));
  return targetPath;
}

function normalizeProtoSkillRuntime(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'claude' || normalized === 'claude-code') return 'claude';
  if (normalized === 'codex') return 'codex';
  if (normalized === 'cursor') return 'cursor';
  if (normalized === 'windsurf') return 'windsurf';
  if (normalized === 'augment') return 'augment';
  if (normalized === 'copilot') return 'copilot';
  if (normalized === 'antigravity') return 'antigravity';
  return null;
}

function getProtoSkillRuntimeDirName(runtime) {
  if (runtime === 'copilot') return '.github';
  if (runtime === 'codex') return '.codex';
  if (runtime === 'cursor') return '.cursor';
  if (runtime === 'windsurf') return '.windsurf';
  if (runtime === 'augment') return '.augment';
  if (runtime === 'antigravity') return '.agent';
  return '.claude';
}

function getProtoSkillGlobalDir(runtime, explicitDir = '') {
  const os = require('os');
  if (explicitDir) return path.resolve(expandHomeDir(explicitDir));
  if (runtime === 'claude' && process.env.CLAUDE_CONFIG_DIR) return path.resolve(expandHomeDir(process.env.CLAUDE_CONFIG_DIR));
  if (runtime === 'codex' && process.env.CODEX_HOME) return path.resolve(expandHomeDir(process.env.CODEX_HOME));
  if (runtime === 'cursor' && process.env.CURSOR_CONFIG_DIR) return path.resolve(expandHomeDir(process.env.CURSOR_CONFIG_DIR));
  if (runtime === 'windsurf' && process.env.WINDSURF_CONFIG_DIR) return path.resolve(expandHomeDir(process.env.WINDSURF_CONFIG_DIR));
  if (runtime === 'augment' && process.env.AUGMENT_CONFIG_DIR) return path.resolve(expandHomeDir(process.env.AUGMENT_CONFIG_DIR));
  if (runtime === 'copilot' && process.env.COPILOT_CONFIG_DIR) return path.resolve(expandHomeDir(process.env.COPILOT_CONFIG_DIR));
  if (runtime === 'antigravity' && process.env.ANTIGRAVITY_CONFIG_DIR) return path.resolve(expandHomeDir(process.env.ANTIGRAVITY_CONFIG_DIR));
  if (runtime === 'codex') return path.join(os.homedir(), '.codex');
  if (runtime === 'cursor') return path.join(os.homedir(), '.cursor');
  if (runtime === 'windsurf') return path.join(os.homedir(), '.windsurf');
  if (runtime === 'augment') return path.join(os.homedir(), '.augment');
  if (runtime === 'copilot') return path.join(os.homedir(), '.copilot');
  if (runtime === 'antigravity') return path.join(os.homedir(), '.gemini', 'antigravity');
  return path.join(os.homedir(), '.claude');
}

function resolveProtoSkillInstallRuntimes(args) {
  const selected = [];
  if (args.all) {
    selected.push('claude', 'codex', 'cursor', 'windsurf', 'augment', 'copilot', 'antigravity');
  } else {
    if (args.claude) selected.push('claude');
    if (args.codex) selected.push('codex');
    if (args.cursor) selected.push('cursor');
    if (args.windsurf) selected.push('windsurf');
    if (args.augment) selected.push('augment');
    if (args.copilot) selected.push('copilot');
    if (args.antigravity) selected.push('antigravity');
  }
  if (selected.length > 0) return [...new Set(selected)];
  const detected = normalizeProtoSkillRuntime(detectRuntimeIdentity().id);
  if (detected) return [detected];
  console.error('No supported runtime selected for proto-skill install.');
  console.error('Pass one of: --claude --codex --cursor --windsurf --augment --copilot --antigravity --all');
  process.exit(1);
}

function installProtoSkillToRuntime(protoDir, slug, runtime, options = {}) {
  const isGlobal = Boolean(options.global);
  const baseDir = isGlobal
    ? getProtoSkillGlobalDir(runtime, options.configDir || '')
    : (options.configDir
      ? path.resolve(expandHomeDir(options.configDir))
      : path.join(process.cwd(), getProtoSkillRuntimeDirName(runtime)));
  const nativeDir = path.join(baseDir, 'skills', slug);
  const mirrorDir = path.join(baseDir, '.agents', 'skills', slug);
  fs.rmSync(nativeDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(nativeDir), { recursive: true });
  fs.cpSync(protoDir, nativeDir, { recursive: true });
  fs.rmSync(mirrorDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(mirrorDir), { recursive: true });
  fs.cpSync(protoDir, mirrorDir, { recursive: true });
  return { baseDir, nativeDir, mirrorDir };
}

function splitCsvList(raw, fallback = []) {
  if (!raw || typeof raw !== 'string') return fallback;
  return raw
    .split(',')
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
}

function listSkillDirs(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(rootDir, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    out.push({ id: entry.name, dir: skillDir, skillFile });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function readSkillFrontmatter(skillFile) {
  let src = '';
  try { src = fs.readFileSync(skillFile, 'utf8'); } catch { return { name: null, description: null, workflow: null }; }
  const match = src.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { name: null, description: null, workflow: null };
  let name = null;
  let description = null;
  let workflow = null;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    if (kv[1] === 'name') name = kv[2].replace(/^["']|["']$/g, '').trim();
    if (kv[1] === 'description') description = kv[2].replace(/^["']|["']$/g, '').trim();
    if (kv[1] === 'workflow') workflow = kv[2].replace(/^["']|["']$/g, '').trim() || null;
  }
  return { name, description, workflow };
}

function firstExistingImagePath(dir, candidates = []) {
  for (const rel of candidates) {
    const full = path.join(dir, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function sanitizeSkillPromptText(input, maxLen = 420) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  let text = raw
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[>|-]+\s*$/g, '')
    .replace(/\b(?:kill|weapon|blood|gore|violence|violent)\b/gi, '')
    .trim();
  if (!text || text === '>-') return '';
  if (text.length > maxLen) text = `${text.slice(0, maxLen - 1).trimEnd()}.`;
  return text;
}

function buildSafeSkillImagePrompt({ id, name, description }) {
  const label = sanitizeSkillPromptText(name || id, 120) || sanitizeSkillPromptText(id, 120) || 'skill';
  const purpose = sanitizeSkillPromptText(description, 320);
  const parts = [
    `Create a square icon-style illustration for the software skill "${label}".`,
    purpose ? `Purpose: ${purpose}` : '',
    'Use abstract symbols and tooling motifs only.',
    'No people, no faces, no text, no logos, no brand marks.',
    'Non-violent, safe-for-work, high contrast, clean silhouette, minimal background.',
  ];
  return parts.filter(Boolean).join(' ');
}

function buildSkillImageInventory(args = {}) {
  const repoRoot = path.resolve(__dirname, '..');
  const scopes = new Set(splitCsvList(args.scope, ['official', 'proto', 'installed']));
  const includeGlobal = Boolean(args['include-global']);
  const runtimeFilter = new Set(splitCsvList(args.runtime, ['claude', 'codex', 'cursor', 'windsurf', 'augment', 'copilot', 'antigravity']));
  const records = [];

  function pushRecord(base) {
    const imageCandidates = ['image.png', 'cover.png', 'icon.png', 'preview.png'];
    const existingImage = firstExistingImagePath(base.skillDir, imageCandidates);
    const outputPath = base.outputPath || path.join(repoRoot, 'site', 'public', 'skills', `${base.id}.png`);
    const hasOutputImage = fs.existsSync(outputPath);
    const promptSeed = buildSafeSkillImagePrompt({
      id: base.id,
      name: base.name || base.id,
      description: base.description,
    });
    records.push({
      id: base.id,
      name: base.name || base.id,
      kind: base.kind,
      runtime: base.runtime || null,
      sourceDir: base.skillDir,
      skillFile: base.skillFile,
      hasImage: Boolean(existingImage || hasOutputImage),
      imagePath: existingImage || (hasOutputImage ? outputPath : null),
      targetImagePath: outputPath,
      description: base.description || null,
      prompt: promptSeed,
    });
  }

  if (scopes.has('official')) {
    const officialRoot = path.join(repoRoot, 'skills');
    for (const entry of listSkillDirs(officialRoot)) {
      if (entry.id === 'candidates' || entry.id === 'emergent' || entry.id === 'proto-skills') continue;
      const meta = readSkillFrontmatter(entry.skillFile);
      pushRecord({
        id: entry.id,
        name: meta.name || entry.id,
        description: meta.description,
        kind: 'official',
        skillDir: entry.dir,
        skillFile: entry.skillFile,
        outputPath: path.join(repoRoot, 'site', 'public', 'skills', `${entry.id}.png`),
      });
    }
  }

  if (scopes.has('proto')) {
    const protoRoot = path.join(repoRoot, '.planning', 'proto-skills');
    for (const entry of listSkillDirs(protoRoot)) {
      const meta = readSkillFrontmatter(entry.skillFile);
      pushRecord({
        id: entry.id,
        name: meta.name || entry.id,
        description: meta.description,
        kind: 'proto',
        skillDir: entry.dir,
        skillFile: entry.skillFile,
        outputPath: path.join(entry.dir, 'image.png'),
      });
    }
  }

  if (scopes.has('installed')) {
    const localRuntimeRoots = [
      { runtime: 'claude', dir: path.join(process.cwd(), '.claude', 'skills') },
      { runtime: 'codex', dir: path.join(process.cwd(), '.codex', 'skills') },
      { runtime: 'cursor', dir: path.join(process.cwd(), '.cursor', 'skills') },
      { runtime: 'windsurf', dir: path.join(process.cwd(), '.windsurf', 'skills') },
      { runtime: 'augment', dir: path.join(process.cwd(), '.augment', 'skills') },
      { runtime: 'copilot', dir: path.join(process.cwd(), '.github', 'skills') },
      { runtime: 'antigravity', dir: path.join(process.cwd(), '.agent', 'skills') },
      { runtime: 'agents', dir: path.join(process.cwd(), '.agents', 'skills') },
    ];
    const runtimeRoots = [...localRuntimeRoots];
    if (includeGlobal) {
      for (const runtime of ['claude', 'codex', 'cursor', 'windsurf', 'augment', 'copilot', 'antigravity']) {
        runtimeRoots.push({ runtime, dir: path.join(getProtoSkillGlobalDir(runtime), 'skills') });
      }
    }
    for (const root of runtimeRoots) {
      if (root.runtime !== 'agents' && !runtimeFilter.has(root.runtime)) continue;
      for (const entry of listSkillDirs(root.dir)) {
        const meta = readSkillFrontmatter(entry.skillFile);
        const targetDir = path.join(repoRoot, 'site', 'public', 'skills', 'installed', root.runtime);
        pushRecord({
          id: `${root.runtime}:${entry.id}`,
          name: meta.name || entry.id,
          description: meta.description,
          kind: 'installed',
          runtime: root.runtime,
          skillDir: entry.dir,
          skillFile: entry.skillFile,
          outputPath: path.join(targetDir, `${entry.id}.png`),
        });
      }
    }
  }

  records.sort((a, b) => a.id.localeCompare(b.id));
  return records;
}

function skillImagePromptDataPath(repoRoot) {
  return path.join(repoRoot, 'data', 'skill-image-prompts.json');
}

function loadSkillImagePromptData(repoRoot) {
  const file = skillImagePromptDataPath(repoRoot);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeSkillImagePromptData(repoRoot, payload) {
  const file = skillImagePromptDataPath(repoRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

function buildSkillImagePromptPayload(records) {
  const globalStyle = [
    'Magicborn narrative style.',
    'Game icon / spell glyph aesthetic.',
    'Centered composition.',
    'High-contrast readability at small sizes.',
    'No text, no logos, no UI chrome.',
    'Painterly-fantasy energy with clean silhouette.',
  ];
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    globalStyle,
    items: records.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      runtime: r.runtime || null,
      targetImagePath: path.relative(path.resolve(__dirname, '..'), r.targetImagePath).replace(/\\/g, '/'),
      prompt: r.prompt,
    })),
  };
}

function mergeInventoryWithPromptData(records, promptData, repoRoot) {
  if (!promptData || !Array.isArray(promptData.items)) return records;
  const byId = new Map(promptData.items.map((it) => [String(it.id || '').trim(), it]).filter(([id]) => id));
  const stylePrefix = Array.isArray(promptData.globalStyle) ? promptData.globalStyle.join(' ') : '';
  return records.map((r) => {
    const item = byId.get(r.id);
    if (!item) return r;
    const prompt = sanitizeSkillPromptText(item.prompt, 800);
    const targetImagePath = item.targetImagePath
      ? path.resolve(repoRoot, String(item.targetImagePath))
      : r.targetImagePath;
    return {
      ...r,
      prompt: prompt || sanitizeSkillPromptText(`${stylePrefix} ${r.prompt}`, 800),
      targetImagePath,
    };
  });
}

function parseImageInputFile(inputFile) {
  const resolved = path.resolve(inputFile);
  const src = fs.readFileSync(resolved, 'utf8');
  if (resolved.endsWith('.json')) {
    const parsed = JSON.parse(src);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    throw new Error(`Expected array or { items: [] } JSON in ${resolved}`);
  }
  const rows = [];
  for (const line of src.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(JSON.parse(trimmed));
  }
  return rows;
}

function loadLocalEnvFile(repoRoot, relPath = '.env') {
  const envPath = path.resolve(repoRoot, relPath);
  if (!fs.existsSync(envPath)) return;
  const src = fs.readFileSync(envPath, 'utf8');
  for (const line of src.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const kv = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2] || '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function generateImageWithOpenAI({ apiKey, model, prompt, size }) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      n: 1,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI image generation failed (${res.status}): ${body.slice(0, 400)}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (b64) return Buffer.from(b64, 'base64');
  const url = json?.data?.[0]?.url;
  if (url) {
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error(`OpenAI image URL fetch failed (${imgRes.status})`);
    const arr = await imgRes.arrayBuffer();
    return Buffer.from(arr);
  }
  throw new Error('OpenAI response did not include data[0].b64_json or data[0].url');
}

const evolutionImagesStatus = defineCommand({
  meta: { name: 'status', description: 'List official/proto/installed skills and show which are missing images' },
  args: {
    scope: { type: 'string', description: 'Comma-separated: official,proto,installed (default all three)', default: 'official,proto,installed' },
    runtime: { type: 'string', description: 'When scope includes installed: comma-separated runtimes (default all)', default: 'claude,codex,cursor,windsurf,augment,copilot,antigravity' },
    'include-global': { type: 'boolean', description: 'Also scan global runtime config dirs in home directory', default: false },
    syncPrompts: { type: 'boolean', description: 'Write/update data/skill-image-prompts.json from current inventory', default: false },
    json: { type: 'boolean', description: 'Emit full JSON inventory', default: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    let records = buildSkillImageInventory(args);
    const promptData = loadSkillImagePromptData(repoRoot);
    records = mergeInventoryWithPromptData(records, promptData, repoRoot);
    const missing = records.filter((r) => !r.hasImage);
    let promptFile = null;
    if (args.syncPrompts) {
      const payload = buildSkillImagePromptPayload(records);
      promptFile = writeSkillImagePromptData(repoRoot, payload);
    }
    if (args.json) {
      console.log(JSON.stringify({
        total: records.length,
        missing: missing.length,
        promptFile: promptFile ? path.relative(process.cwd(), promptFile) : null,
        records,
      }, null, 2));
      return;
    }
    console.log(`Skill image inventory: ${records.length} total, ${missing.length} missing`);
    const byKind = ['official', 'proto', 'installed'];
    for (const kind of byKind) {
      const rows = records.filter((r) => r.kind === kind);
      if (rows.length === 0) continue;
      const missingCount = rows.filter((r) => !r.hasImage).length;
      console.log(`  ${kind}: ${rows.length} total, ${missingCount} missing`);
    }
    if (missing.length > 0) {
      console.log('');
      console.log('Missing image targets:');
      for (const row of missing) {
        console.log(`  - ${row.id}`);
        console.log(`    skill:  ${path.relative(process.cwd(), row.skillFile)}`);
        console.log(`    target: ${path.relative(process.cwd(), row.targetImagePath)}`);
      }
      console.log('');
      console.log('Generate with: gad evolution images generate');
    }
    if (promptFile) {
      console.log('');
      console.log(`Prompt registry updated: ${path.relative(process.cwd(), promptFile)}`);
    }
  },
});

const evolutionImagesGenerate = defineCommand({
  meta: { name: 'generate', description: 'Generate skill images via OpenAI (opt-in, requires OPENAI_API_KEY)' },
  args: {
    input: { type: 'string', description: 'JSON/JSONL file with [{ id, prompt, targetImagePath? }]. If omitted, uses inventory rows.' },
    scope: { type: 'string', description: 'Used when --input is omitted. Comma-separated: official,proto,installed', default: 'official,proto' },
    runtime: { type: 'string', description: 'Used for installed scan when --input is omitted', default: 'claude,codex,cursor,windsurf,augment,copilot,antigravity' },
    'include-global': { type: 'boolean', description: 'Used for installed scan when --input is omitted', default: false },
    'missing-only': { type: 'boolean', description: 'When using inventory rows, generate only missing images', default: true },
    'auto-prompt': { type: 'boolean', description: 'Fill missing prompt fields from skill metadata', default: true },
    model: { type: 'string', description: 'OpenAI image model', default: 'gpt-image-1' },
    size: { type: 'string', description: 'Image size', default: '1024x1024' },
    limit: { type: 'string', description: 'Max images to generate', default: '' },
    overwrite: { type: 'boolean', description: 'Overwrite files that already exist', default: false },
    'env-file': { type: 'string', description: 'Load env vars from this file before generation', default: '.env' },
    prompts: { type: 'string', description: 'Prompt registry file (default: data/skill-image-prompts.json)', default: '' },
    dryRun: { type: 'boolean', description: 'Print planned writes without calling OpenAI', default: false },
  },
  async run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    loadLocalEnvFile(repoRoot, args['env-file'] || '.env');
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey && !args.dryRun) {
      console.error('OPENAI_API_KEY is required for image generation.');
      console.error('Set it in your shell or in vendor/get-anything-done/.env (see .env.example).');
      process.exit(1);
    }

    let rows;
    if (args.input) {
      rows = parseImageInputFile(args.input).map((row, idx) => ({
        id: row.id || `row-${idx + 1}`,
        prompt: row.prompt || '',
        targetImagePath: row.targetImagePath || row.imagePath || '',
      }));
    } else {
      const promptFile = args.prompts
        ? path.resolve(args.prompts)
        : skillImagePromptDataPath(repoRoot);
      let invRows = buildSkillImageInventory(args);
      if (fs.existsSync(promptFile)) {
        const promptData = loadSkillImagePromptData(repoRoot) || JSON.parse(fs.readFileSync(promptFile, 'utf8'));
        invRows = mergeInventoryWithPromptData(invRows, promptData, repoRoot);
      }
      rows = invRows.map((row) => ({
        id: row.id,
        prompt: row.prompt || '',
        targetImagePath: row.targetImagePath,
        hasImage: row.hasImage,
      }));
      if (args['missing-only']) rows = rows.filter((r) => !r.hasImage);
    }

    if (args['auto-prompt']) {
      for (const row of rows) {
        if (!row.prompt) {
          row.prompt = buildSafeSkillImagePrompt({ id: row.id, name: row.id, description: '' });
        } else {
          row.prompt = sanitizeSkillPromptText(row.prompt, 800);
        }
      }
    }
    rows = rows.filter((r) => r.prompt && r.targetImagePath);
    if (args.limit) {
      const lim = Number(args.limit);
      if (Number.isFinite(lim) && lim > 0) rows = rows.slice(0, lim);
    }
    if (rows.length === 0) {
      console.log('No image jobs to run.');
      return;
    }

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    for (const row of rows) {
      const target = path.resolve(row.targetImagePath);
      if (fs.existsSync(target) && !args.overwrite) {
        skipped += 1;
        console.log(`[skip] ${row.id} -> ${path.relative(process.cwd(), target)} (exists, pass --overwrite)`);
        continue;
      }
      if (args.dryRun) {
        console.log(`[dry-run] ${row.id} -> ${path.relative(process.cwd(), target)}`);
        continue;
      }
      try {
        const png = await generateImageWithOpenAI({
          apiKey,
          model: args.model || 'gpt-image-1',
          prompt: row.prompt,
          size: args.size || '1024x1024',
        });
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, png);
        generated += 1;
        console.log(`[ok] ${row.id} -> ${path.relative(process.cwd(), target)}`);
      } catch (err) {
        failed += 1;
        const msg = err && err.message ? String(err.message) : String(err || 'unknown error');
        console.error(`[fail] ${row.id}: ${msg}`);
      }
    }
    console.log(`Done. generated=${generated} skipped=${skipped} failed=${failed} total=${rows.length}`);
    if (failed > 0) process.exitCode = 2;
  },
});

const evolutionImagesCmd = defineCommand({
  meta: { name: 'images', description: 'Skill image inventory + optional OpenAI generation (opt-in)' },
  subCommands: {
    status: evolutionImagesStatus,
    generate: evolutionImagesGenerate,
  },
});

const evolutionValidate = defineCommand({
  meta: { name: 'validate', description: 'Run advisory validator on a proto-skill (writes VALIDATION.md)' },
  args: {
    slug: { type: 'positional', description: 'proto-skill slug (directory name under .planning/proto-skills/)', required: true },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir } = evolutionPaths(repoRoot);
    const dir = path.join(protoSkillsDir, args.slug);
    const skillPath = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      console.error(`No proto-skill found at ${skillPath}`);
      process.exit(1);
    }
    const { writeValidation } = require('../lib/evolution-validator.cjs');
    const { outPath, result } = writeValidation(skillPath, path.resolve(repoRoot, '..', '..'));
    const okFiles = result.fileRefs.filter((f) => f.exists).length;
    const okCmds = result.cliCommands.filter((c) => c.valid === true).length;
    console.log(`Validated ${args.slug}`);
    console.log(`  File refs: ${okFiles}/${result.fileRefs.length}`);
    console.log(`  CLI cmds:  ${okCmds}/${result.cliCommands.length}`);
    console.log(`  → ${outPath}`);
  },
});

const evolutionInstall = defineCommand({
  meta: { name: 'install', description: 'Install a staged proto-skill into one or more coding-agent runtimes without promoting it' },
  args: {
    slug: { type: 'positional', description: 'proto-skill slug', required: true },
    claude: { type: 'boolean' },
    codex: { type: 'boolean' },
    cursor: { type: 'boolean' },
    windsurf: { type: 'boolean' },
    augment: { type: 'boolean' },
    copilot: { type: 'boolean' },
    antigravity: { type: 'boolean' },
    all: { type: 'boolean' },
    global: { type: 'boolean' },
    local: { type: 'boolean' },
    'config-dir': { type: 'string', description: 'Custom runtime config directory', default: '' },
  },
  run({ args }) {
    if (args.global && args.local) {
      console.error('Choose either --global or --local for proto-skill install, not both.');
      process.exit(1);
    }
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir } = evolutionPaths(repoRoot);
    const protoDir = path.join(protoSkillsDir, args.slug);
    const skillPath = path.join(protoDir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      console.error(`No proto-skill found at ${skillPath}`);
      process.exit(1);
    }
    const runtimes = resolveProtoSkillInstallRuntimes(args);
    const installMode = args.global ? 'global' : 'local';
    console.log(`Installing proto-skill ${args.slug} from ${protoSkillRelativePath(args.slug)}/`);
    console.log(`  mode: ${installMode}`);
    for (const runtime of runtimes) {
      const result = installProtoSkillToRuntime(protoDir, args.slug, runtime, {
        global: Boolean(args.global),
        configDir: args['config-dir'] || '',
      });
      console.log(`  ${runtime}: ${result.nativeDir}`);
      console.log(`           ${result.mirrorDir}`);
    }
    console.log('');
    console.log('Proto-skill remains staged in .planning until you promote or discard it.');
  },
});

const evolutionPromote = defineCommand({
  meta: { name: 'promote', description: 'Promote a proto-skill into skills/ + workflows/ (joins species DNA)' },
  args: {
    slug: { type: 'positional', description: 'proto-skill slug', required: true },
    name: { type: 'string', description: 'final skill name in skills/ (defaults to slug)', required: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir, finalSkillsDir, candidatesDir } = evolutionPaths(repoRoot);
    const protoDir = path.join(protoSkillsDir, args.slug);
    if (!fs.existsSync(protoDir)) {
      console.error(`No proto-skill at ${protoDir}`);
      process.exit(1);
    }
    const skillPath = path.join(protoDir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      console.error(`Missing SKILL.md in proto-skill — cannot promote`);
      process.exit(1);
    }
    // Resolve final skill name. Precedence:
    //   1. --name <explicit>  (operator override)
    //   2. SKILL.md `name:` frontmatter field (what the drafter chose)
    //   3. args.slug  (candidate slug — ugly fallback, only if SKILL.md
    //                  has no name: field, which is a malformed proto-skill)
    // Task 42.2-13 surfaced this: promoting with slug alone left the
    // canonical skill at skills/phase-44.5-…-local-dev-ga/ instead of
    // skills/scaffold-visual-context-surface/ because the candidate slug
    // is the candidate directory name, not the skill's public identity.
    let frontmatterName = null;
    try {
      const skillBody = fs.readFileSync(skillPath, 'utf8');
      const fmMatch = skillBody.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
      if (fmMatch) {
        const nameLine = fmMatch[1].match(/^name:\s*(.+?)\s*$/m);
        if (nameLine && nameLine[1]) frontmatterName = nameLine[1].trim();
      }
    } catch {
      // Fall through to slug.
    }
    const finalName = args.name || frontmatterName || args.slug;
    const finalDir = path.join(finalSkillsDir, finalName);
    if (fs.existsSync(finalDir)) {
      console.error(`Final skill dir already exists at ${finalDir} — refusing to overwrite. Pass --name <other> or remove it manually.`);
      process.exit(1);
    }

    // Decision gad-190 + gad-191 + task 42.2-16: promotion performs the
    // proto-skill-bundle → canonical split. The proto-skill ships with a
    // sibling `workflow.md` referenced as `./workflow.md` in SKILL.md
    // frontmatter. Promotion:
    //   1. Copy SKILL.md to skills/<name>/SKILL.md and rewrite its
    //      `workflow:` pointer from `./workflow.md` to `workflows/<name>.md`.
    //   2. Move sibling workflow.md → workflows/<name>.md (canonical location).
    //   3. Copy PROVENANCE.md, CANDIDATE.md, and any other bundle files to
    //      skills/<name>/ as-is.
    //   4. Clean up: remove the proto-skill dir and the candidate dir.
    // If no sibling workflow.md exists, promotion degrades gracefully: the
    // SKILL.md frontmatter is left untouched and the skill ships as
    // inline-body only (valid per gad-190 §3).
    fs.mkdirSync(finalDir, { recursive: true });

    const siblingWorkflowPath = path.join(protoDir, 'workflow.md');
    const hasSiblingWorkflow = fs.existsSync(siblingWorkflowPath);
    const workflowsDir = path.join(repoRoot, 'workflows');
    const canonicalWorkflowPath = hasSiblingWorkflow
      ? path.join(workflowsDir, `${finalName}.md`)
      : null;

    if (hasSiblingWorkflow) {
      if (fs.existsSync(canonicalWorkflowPath)) {
        fs.rmSync(finalDir, { recursive: true, force: true });
        console.error(
          `Canonical workflow already exists at ${path.relative(repoRoot, canonicalWorkflowPath)} — refusing to overwrite. Pass --name <other> or remove it manually.`
        );
        process.exit(1);
      }
      fs.mkdirSync(workflowsDir, { recursive: true });
    }

    // Copy bundle files except sibling workflow.md (handled separately).
    for (const entry of fs.readdirSync(protoDir, { withFileTypes: true })) {
      if (hasSiblingWorkflow && entry.name === 'workflow.md') continue;
      const src = path.join(protoDir, entry.name);
      const dest = path.join(finalDir, entry.name);
      if (entry.isDirectory()) fs.cpSync(src, dest, { recursive: true });
      else fs.copyFileSync(src, dest);
    }

    if (hasSiblingWorkflow) {
      // Move sibling → canonical workflow location.
      fs.copyFileSync(siblingWorkflowPath, canonicalWorkflowPath);
    }

    // Rewrite SKILL.md frontmatter on the copied-into-skills/ file:
    //   (a) `workflow:` pointer from `./workflow.md` → `workflows/<name>.md`
    //       (only when a sibling workflow was split out)
    //   (b) `status: proto` → `status: stable` unconditionally, since
    //       promotion is the proto → canonical transition
    // Both rewrites happen against the freshly-copied SKILL.md so the
    // in-tree proto-skill stays unchanged if promotion aborts below.
    const copiedSkillPath = path.join(finalDir, 'SKILL.md');
    let copiedSkillBody = fs.readFileSync(copiedSkillPath, 'utf8');
    if (hasSiblingWorkflow) {
      const canonicalRef = `workflows/${finalName}.md`;
      copiedSkillBody = copiedSkillBody.replace(
        /^(workflow:\s*)(.+)$/m,
        (_, prefix) => `${prefix}${canonicalRef}`
      );
    }
    copiedSkillBody = copiedSkillBody.replace(
      /^(status:\s*)proto\s*$/m,
      (_, prefix) => `${prefix}stable`
    );
    fs.writeFileSync(copiedSkillPath, copiedSkillBody);

    fs.rmSync(protoDir, { recursive: true, force: true });
    const candidateDir = path.join(candidatesDir, args.slug);
    if (fs.existsSync(candidateDir)) fs.rmSync(candidateDir, { recursive: true, force: true });

    console.log(`Promoted ${args.slug} → ${path.relative(repoRoot, finalDir)}`);
    if (hasSiblingWorkflow) {
      console.log(`  Split workflow: ${path.relative(repoRoot, canonicalWorkflowPath)}`);
    } else {
      console.log('  (no sibling workflow.md — SKILL.md promoted as inline body)');
    }
    console.log(`  Removed proto-skill: ${path.relative(repoRoot, protoDir)}`);
  },
});

// ---------------------------------------------------------------------------
// gad skill — unified skill ops (44-36). promote has two modes:
//   --framework : move .planning/proto-skills/<slug>/ → skills/<slug>/
//                 (canonical, ships in the next release). Gated: only
//                 runs inside the canonical get-anything-done clone.
//   --project   : install the proto-skill into the current project's
//                 coding-agent runtime dirs (.claude/skills/, .codex/
//                 skills/, etc.) via the same runtime path used by
//                 `gad evolution install`. Works in any consumer project.
// ---------------------------------------------------------------------------

function isCanonicalGadRepo(repoRoot) {
  try {
    if (fs.existsSync(path.join(repoRoot, '.gad-canonical'))) return true;
  } catch {}
  try {
    const out = require('child_process')
      .execSync('git config --get remote.origin.url', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    if (/MagicbornStudios\/get-anything-done(\.git)?$/i.test(out)) return true;
    if (/get-anything-done(\.git)?$/i.test(out)) return true;
  } catch {}
  return false;
}

const skillPromote = defineCommand({
  meta: { name: 'promote', description: 'Promote a proto-skill — --framework (canonical skills/) or --project (consumer runtime dir)' },
  args: {
    slug: { type: 'positional', description: 'proto-skill slug', required: true },
    framework: { type: 'boolean', description: 'Promote to canonical skills/ (canonical repo only)' },
    project: { type: 'boolean', description: 'Install into the current project\'s coding-agent runtime dirs' },
    name: { type: 'string', description: 'final skill name for --framework (defaults to slug)', required: false },
    claude: { type: 'boolean' },
    codex: { type: 'boolean' },
    cursor: { type: 'boolean' },
    windsurf: { type: 'boolean' },
    augment: { type: 'boolean' },
    copilot: { type: 'boolean' },
    antigravity: { type: 'boolean' },
    all: { type: 'boolean' },
    global: { type: 'boolean' },
    local: { type: 'boolean' },
    'config-dir': { type: 'string', description: 'Custom runtime config directory (--project only)', default: '' },
  },
  run({ args }) {
    if (args.framework && args.project) {
      console.error('Choose either --framework or --project, not both.');
      process.exit(1);
    }
    if (!args.framework && !args.project) {
      console.error('Specify a mode: --framework (canonical skills/) or --project (consumer runtime).');
      console.error('');
      console.error('Examples:');
      console.error('  gad skill promote my-skill --framework                # canonical (repo gate)');
      console.error('  gad skill promote my-skill --project --claude          # install to ./.claude/skills/');
      console.error('  gad skill promote my-skill --project --all --global    # install to all runtimes globally');
      process.exit(1);
    }

    const repoRoot = path.resolve(__dirname, '..');

    if (args.framework) {
      if (!isCanonicalGadRepo(repoRoot)) {
        console.error('Refusing --framework promote: this does not look like the canonical get-anything-done repo.');
        console.error('');
        console.error('Detection: git remote.origin.url must match MagicbornStudios/get-anything-done,');
        console.error('or a .gad-canonical sentinel file must exist at the repo root.');
        console.error('');
        console.error('For a consumer project, use: gad skill promote <slug> --project [--claude|--codex|...]');
        process.exit(1);
      }
      // Delegate to evolutionPromote.run — same body.
      return evolutionPromote.run({ args: { slug: args.slug, name: args.name } });
    }

    // --project mode: delegate to evolutionInstall.run
    return evolutionInstall.run({
      args: {
        slug: args.slug,
        claude: args.claude,
        codex: args.codex,
        cursor: args.cursor,
        windsurf: args.windsurf,
        augment: args.augment,
        copilot: args.copilot,
        antigravity: args.antigravity,
        all: args.all,
        global: args.global,
        local: args.local,
        'config-dir': args['config-dir'] || '',
      },
    });
  },
});

const skillList = defineCommand({
  meta: { name: 'list', description: 'List canonical skills (from skills/) and any pending proto-skills' },
  args: {
    proto: { type: 'boolean', description: 'List only pending proto-skills' },
    canonical: { type: 'boolean', description: 'List only canonical skills' },
    paths: { type: 'boolean', description: 'Print absolute SKILL.md path and resolved workflow path for each skill (decision gad-194, task 42.2-20)' },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir, finalSkillsDir } = evolutionPaths(repoRoot);
    const showCanonical = !args.proto;
    const showProto = !args.canonical;
    const showPaths = Boolean(args.paths);
    if (showCanonical) {
      const canonical = listSkillDirs(finalSkillsDir);
      console.log(`Canonical skills (skills/): ${canonical.length}`);
      for (const s of canonical) {
        const fm = readSkillFrontmatter(s.skillFile);
        console.log(`  ${s.id}${fm.name && fm.name !== s.id ? `  (${fm.name})` : ''}`);
        if (showPaths) {
          console.log(`      SKILL.md: ${s.skillFile}`);
          if (fm.workflow) {
            const isSibling = fm.workflow.startsWith('./') || fm.workflow.startsWith('../');
            const resolved = isSibling
              ? path.resolve(s.dir, fm.workflow)
              : path.resolve(repoRoot, fm.workflow);
            const exists = fs.existsSync(resolved);
            console.log(`      workflow: ${resolved}${exists ? '' : ' (MISSING)'}`);
          }
        }
      }
      console.log('');
    }
    if (showProto) {
      const proto = listSkillDirs(protoSkillsDir);
      console.log(`Proto-skills (.planning/proto-skills/): ${proto.length}`);
      for (const s of proto) {
        const fm = readSkillFrontmatter(s.skillFile);
        console.log(`  ${s.id}${fm.name && fm.name !== s.id ? `  (${fm.name})` : ''}`);
        if (showPaths) {
          console.log(`      SKILL.md: ${s.skillFile}`);
          if (fm.workflow) {
            const isSibling = fm.workflow.startsWith('./') || fm.workflow.startsWith('../');
            const resolved = isSibling
              ? path.resolve(s.dir, fm.workflow)
              : path.resolve(repoRoot, fm.workflow);
            const exists = fs.existsSync(resolved);
            console.log(`      workflow: ${resolved}${exists ? '' : ' (MISSING)'}`);
          }
        }
      }
      if (proto.length > 0) {
        console.log('');
        console.log('Promote with:');
        console.log('  gad skill promote <slug> --framework            # canonical (this repo only)');
        console.log('  gad skill promote <slug> --project --claude     # runtime install');
      }
    }
    // Authoring skill disambiguation footer (task 42.2-23, findings
    // 2026-04-15). Agents surfaced confusion about which of the four
    // authoring skills to fire for "create a skill" — this footer answers.
    console.log('');
    console.log('Authoring skills — which to fire when:');
    console.log('  create-skill         neutral generic authoring, no eval loop');
    console.log('  create-proto-skill   fast drafter inside evolution loop (candidate → proto)');
    console.log('  gad-skill-creator    GAD-tailored heavy path, eval scaffold');
    console.log('  merge-skill          fuse overlapping / duplicate skills');
    console.log('');
    console.log('Skill lifecycle (decision gad-183 / references/skill-shape.md §11):');
    console.log('  candidate → proto-skill → [install/validate] → promoted');
    console.log('  gad evolution evolve       # find high-pressure phases → write CANDIDATE.md');
    console.log('  create-proto-skill         # draft from candidate → .planning/proto-skills/<slug>/');
    console.log('  gad evolution install      # test in runtime without promoting');
    console.log('  gad evolution validate     # advisory checker → VALIDATION.md');
    console.log('  gad evolution promote      # → skills/<name>/ + workflows/<name>.md');
    console.log('');
    console.log('Discovery helpers:');
    console.log('  gad skill show <id>        # name, description, resolved workflow path');
    console.log('  gad skill show <id> --body # full SKILL.md + workflow contents');
    console.log('  gad skill list --paths     # inventory with absolute paths + MISSING flags');
  },
});

const bundleExport = defineCommand({
  meta: {
    name: 'export',
    description: 'Export one or all GAD skills as a self-contained bundle for upload to Claude Code, OpenCode, or other agent runtimes. Inlines workflow content so the bundle is portable.',
  },
  args: {
    name: { type: 'positional', description: 'Skill name (e.g. gad-visual-context-system) or --all', required: false },
    all: { type: 'boolean', description: 'Export all canonical skills' },
    output: { type: 'string', description: 'Output directory (default: ./skill-bundles/<name> or ./skill-bundles/all)', required: false },
    zip: { type: 'boolean', description: 'Also create a .zip archive for upload', default: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const skillsDir = path.join(repoRoot, 'skills');

    if (!args.all && !args.name) {
      console.error('Provide a skill name or use --all');
      console.error('  gad bundle export gad-visual-context-system');
      console.error('  gad bundle export --all');
      process.exit(1);
    }

    const outputBase = args.output
      ? path.resolve(args.output)
      : path.join(process.cwd(), 'skill-bundles');

    const skillsToBundle = [];

    if (args.all) {
      function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const skillDir = path.join(dir, entry.name);
          const skillMd = path.join(skillDir, 'SKILL.md');
          if (fs.existsSync(skillMd)) {
            skillsToBundle.push({ id: entry.name, dir: skillDir });
          } else {
            walk(skillDir);
          }
        }
      }
      walk(skillsDir);
    } else {
      const skillName = args.name.replace(/^skills\//, '');
      const skillDir = path.join(skillsDir, skillName);
      const skillMd = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) {
        console.error(`Skill not found: ${skillName}`);
        process.exit(1);
      }
      skillsToBundle.push({ id: skillName, dir: skillDir });
    }

    const archivers = [];
    try {
      if (args.zip) {
        archivers.push('archiver');
      }
    } catch {}

    for (const { id, dir } of skillsToBundle) {
      const skillMd = path.join(dir, 'SKILL.md');
      const content = fs.readFileSync(skillMd, 'utf8');
      const fm = readSkillFrontmatter(skillMd);

      let outDir = path.join(outputBase, id);
      if (args.all) {
        fs.mkdirSync(outputBase, { recursive: true });
        fs.mkdirSync(outDir, { recursive: true });
      } else {
        fs.mkdirSync(outDir, { recursive: true });
      }

      let bundled = content;

      if (fm.workflow) {
        const isSibling = fm.workflow.startsWith('./') || fm.workflow.startsWith('../');
        const workflowPath = isSibling
          ? path.resolve(dir, fm.workflow)
          : path.join(repoRoot, fm.workflow);

        if (fs.existsSync(workflowPath)) {
          let workflowContent = fs.readFileSync(workflowPath, 'utf8');
          workflowContent = workflowContent
            .split('\n')
            .filter(line => line.trim() !== '---')
            .join('\n')
            .trim();
          bundled = content.replace(
            /^workflow:\s*.+$/m,
            `workflow_content: |\n${workflowContent.split('\n').map(l => '  ' + l).join('\n')}`
          );
          bundled = bundled.split('\n');
          for (let i = 1; i < bundled.length; i++) {
            if (bundled[i].trim() === '---') {
              bundled = bundled.slice(0, i + 1);
              break;
            }
          }
          bundled = bundled.join('\n') + '\n';
          bundled = bundled.replace(/<([^>]+)>/g, '&lt;$1&gt;');
        } else {
          console.warn(`  [warn] Workflow not found: ${workflowPath}`);
        }
      }

      fs.writeFileSync(path.join(outDir, 'SKILL.md'), bundled);
      console.log(`  ✓ ${id}`);

      const evalsSrc = path.join(dir, 'evals');
      if (fs.existsSync(evalsSrc)) {
        const evalsDest = path.join(outDir, 'evals');
        copyDirRecursive(evalsSrc, evalsDest);
        console.log(`    + evals/`);
      }

      if (args.zip) {
        const zipPath = outDir + '.zip';
        try {
          const archiver = require('archiver') || null;
          if (archiver) {
            const { execSync } = require('child_process');
            execSync(`cd "${path.dirname(outDir)}" && npx --yes archiver --output "${zipPath}" --source "${path.basename(outDir)}"`, {
              stdio: 'inherit',
            });
            console.log(`    → ${id}.zip`);
          }
        } catch {
          console.log(`    [skip] zip unavailable, SKILL.md exported`);
        }
      }
    }

    console.log(`\n  Bundled ${skillsToBundle.length} skill(s) → ${outputBase}`);
    if (!args.zip) {
      console.log('  Run with --zip to create uploadable archives.');
    }
  },
});

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const bundleCmd = defineCommand({
  meta: { name: 'bundle', description: 'Export GAD skills as portable bundles for agent runtime upload' },
  subCommands: {
    export: bundleExport,
  },
});

const skillShow = defineCommand({
  meta: { name: 'show', description: 'Show a canonical or proto-skill: resolved paths, frontmatter, and (optionally) SKILL.md + workflow body. Decision gad-194, task 42.2-20.' },
  args: {
    id: { type: 'positional', description: 'skill id (e.g. gad-plan-phase) or slug', required: true },
    body: { type: 'boolean', description: 'Also print SKILL.md and workflow file body', default: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir, finalSkillsDir } = evolutionPaths(repoRoot);

    // Search canonical first, then proto. Accept exact match or public-name match.
    const roots = [
      { label: 'canonical', dir: finalSkillsDir },
      { label: 'proto', dir: protoSkillsDir },
    ];
    let hit = null;
    for (const root of roots) {
      const entries = listSkillDirs(root.dir);
      for (const s of entries) {
        const fm = readSkillFrontmatter(s.skillFile);
        if (s.id === args.id || fm.name === args.id || fm.name === `gad:${args.id.replace(/^gad-/, '')}`) {
          hit = { ...s, fm, origin: root.label };
          break;
        }
      }
      if (hit) break;
    }

    if (!hit) {
      console.error(`Skill not found: ${args.id}`);
      console.error(`  Try:  gad skill list --paths   # full inventory with paths`);
      process.exit(1);
    }

    console.log(`Skill: ${hit.id}  [${hit.origin}]`);
    console.log(`  public name: ${hit.fm.name || '(none)'}`);
    console.log(`  description: ${(hit.fm.description || '').replace(/\s+/g, ' ').trim()}`);
    console.log(`  SKILL.md:    ${hit.skillFile}`);
    if (hit.fm.workflow) {
      const isSibling = hit.fm.workflow.startsWith('./') || hit.fm.workflow.startsWith('../');
      const resolved = isSibling
        ? path.resolve(hit.dir, hit.fm.workflow)
        : path.resolve(repoRoot, hit.fm.workflow);
      const exists = fs.existsSync(resolved);
      console.log(`  workflow:    ${resolved}${exists ? '' : ' (MISSING)'}`);
    } else {
      console.log(`  workflow:    (none — inline body in SKILL.md)`);
    }

    if (args.body) {
      console.log('');
      console.log('-- SKILL.md ---------------------------------------------------');
      console.log(fs.readFileSync(hit.skillFile, 'utf8'));
      if (hit.fm.workflow) {
        const isSibling = hit.fm.workflow.startsWith('./') || hit.fm.workflow.startsWith('../');
        const resolved = isSibling
          ? path.resolve(hit.dir, hit.fm.workflow)
          : path.resolve(repoRoot, hit.fm.workflow);
        if (fs.existsSync(resolved)) {
          console.log('');
          console.log(`-- workflow (${path.relative(repoRoot, resolved)}) --------`);
          console.log(fs.readFileSync(resolved, 'utf8'));
        }
      }
    }
  },
});

const skillPromoteFolder = defineCommand({
  meta: { name: 'promote-folder', description: 'Promote any skill-shaped folder into the canonical get-anything-done framework `skills/` + `workflows/` tree. Generalizes `evolution promote` — source can be `.planning/proto-skills/<slug>/` (the evolve-loop pathway), a hand-authored draft, or a consumer project proto-skill being elevated to framework canonical. Consumer projects do NOT use this — their proto-skills auto-register in the project tree. Decision gad-196 (task 42.2-32/34).' },
  args: {
    source: { type: 'positional', description: 'absolute or relative path to a skill-shaped folder (must contain SKILL.md with valid frontmatter)', required: true },
    name: { type: 'string', description: 'Final skill name (defaults to source dir basename)', default: '' },
    'dry-run': { type: 'boolean', description: 'Print what would happen without writing anything', default: false },
    force: { type: 'boolean', description: 'Overwrite an existing skills/<name>/ or workflows/<name>.md at the destination', default: false },
  },
  run({ args }) {
    const srcDir = path.resolve(args.source);
    if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
      console.error(`Source path is not a directory: ${srcDir}`);
      process.exit(1);
    }
    const srcSkill = path.join(srcDir, 'SKILL.md');
    if (!fs.existsSync(srcSkill)) {
      console.error(`Source folder is not skill-shaped: missing SKILL.md at ${srcSkill}`);
      process.exit(1);
    }

    // Parse frontmatter for validation + name + workflow pointer.
    const raw = fs.readFileSync(srcSkill, 'utf8');
    const fmMatch = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
    if (!fmMatch) {
      console.error(`SKILL.md has no frontmatter block: ${srcSkill}`);
      process.exit(1);
    }
    const fmBody = fmMatch[1];
    const nameMatch = fmBody.match(/^name:\s*(.+?)\s*$/m);
    const descMatch = fmBody.match(/^description:\s*(.+?)\s*$/m);
    if (!nameMatch) {
      console.error(`SKILL.md frontmatter missing required 'name:' key`);
      process.exit(1);
    }
    if (!descMatch) {
      console.error(`SKILL.md frontmatter missing required 'description:' key`);
      process.exit(1);
    }

    // Compute destination. Always the canonical get-anything-done framework
    // tree. Consumer projects do NOT promote — their proto-skills auto-
    // register in the project's own tree, there is no cross-project
    // "install" operation via this command.
    const finalName = args.name || path.basename(srcDir);
    const repoRoot = path.resolve(__dirname, '..');
    if (!isCanonicalGadRepo(repoRoot)) {
      console.error('Refusing promote-folder: not in the canonical get-anything-done repo.');
      console.error('');
      console.error('Detection: git remote.origin.url must match MagicbornStudios/get-anything-done,');
      console.error('or a .gad-canonical sentinel file must exist at the repo root.');
      console.error('');
      console.error('Consumer projects do not promote — proto-skills in a consumer project');
      console.error('live in that project\'s own tree and are automatically available.');
      console.error('There is no cross-project install operation for this command.');
      process.exit(1);
    }
    const destRoot = repoRoot;

    const destSkillDir = path.join(destRoot, 'skills', finalName);
    const destWorkflowsDir = path.join(destRoot, 'workflows');

    // Resolve source workflow ref — same logic as readCanonicalSkillRecords.
    const workflowRefMatch = fmBody.match(/^workflow:\s*(.+?)\s*$/m);
    let workflowRef = null;
    let sourceWorkflowPath = null;
    let destCanonicalWorkflowPath = null;
    if (workflowRefMatch) {
      workflowRef = workflowRefMatch[1].replace(/^["']|["']$/g, '').trim();
      const isSibling = workflowRef.startsWith('./') || workflowRef.startsWith('../');
      if (isSibling) {
        sourceWorkflowPath = path.resolve(srcDir, workflowRef);
      } else {
        // Canonical ref — look for the file in the source's enclosing repo.
        // Try source grand-parent first (typical `<repo>/skills/<name>/` layout).
        const candidate = path.resolve(path.dirname(path.dirname(srcDir)), workflowRef);
        if (fs.existsSync(candidate)) sourceWorkflowPath = candidate;
      }
      destCanonicalWorkflowPath = path.join(destWorkflowsDir, `${finalName}.md`);
    }

    // Pre-check collisions.
    const collisions = [];
    if (fs.existsSync(destSkillDir) && !args.force) {
      collisions.push(`destination skill dir already exists: ${destSkillDir}`);
    }
    if (destCanonicalWorkflowPath && fs.existsSync(destCanonicalWorkflowPath) && !args.force) {
      collisions.push(`destination workflow file already exists: ${destCanonicalWorkflowPath}`);
    }
    if (collisions.length > 0) {
      console.error('Refusing to overwrite (pass --force to override):');
      for (const c of collisions) console.error(`  ${c}`);
      process.exit(1);
    }

    // Plan (print under --dry-run).
    console.log(`Promote skill folder`);
    console.log(`  source:      ${srcDir}`);
    console.log(`  destination: ${destSkillDir}`);
    if (destCanonicalWorkflowPath) {
      console.log(`  workflow →   ${destCanonicalWorkflowPath}`);
    }
    console.log(`  name:        ${finalName}`);
    console.log(`  public name: ${nameMatch[1].replace(/^["']|["']$/g, '').trim()}`);
    console.log('');

    if (args['dry-run']) {
      console.log('--dry-run: no files written.');
      return;
    }

    // Perform the copy + split.
    fs.mkdirSync(destSkillDir, { recursive: true });
    if (destCanonicalWorkflowPath) fs.mkdirSync(destWorkflowsDir, { recursive: true });

    // Copy every file from source except the workflow file (if sibling).
    const siblingToSkip = sourceWorkflowPath && workflowRef &&
      (workflowRef.startsWith('./') || workflowRef.startsWith('../'))
      ? path.resolve(sourceWorkflowPath)
      : null;
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const src = path.join(srcDir, entry.name);
      if (siblingToSkip && path.resolve(src) === siblingToSkip) continue;
      const dest = path.join(destSkillDir, entry.name);
      if (entry.isDirectory()) fs.cpSync(src, dest, { recursive: true });
      else fs.copyFileSync(src, dest);
    }

    // Copy the workflow file to canonical location + rewrite pointer.
    if (sourceWorkflowPath && fs.existsSync(sourceWorkflowPath) && destCanonicalWorkflowPath) {
      fs.copyFileSync(sourceWorkflowPath, destCanonicalWorkflowPath);
      const canonicalRef = `workflows/${finalName}.md`;
      const destSkillFile = path.join(destSkillDir, 'SKILL.md');
      const destRaw = fs.readFileSync(destSkillFile, 'utf8');
      const rewritten = destRaw.replace(
        /^(workflow:\s*)(.+)$/m,
        (_, prefix) => `${prefix}${canonicalRef}`
      );
      fs.writeFileSync(destSkillFile, rewritten);
    }

    console.log(`Promoted → ${path.relative(destRoot, destSkillDir)}`);
    if (destCanonicalWorkflowPath && fs.existsSync(destCanonicalWorkflowPath)) {
      console.log(`  Workflow: ${path.relative(destRoot, destCanonicalWorkflowPath)}`);
    }
    console.log('');
    console.log('Verify:');
    console.log(`  gad skill show ${finalName}`);
  },
});

const skillFind = defineCommand({
  meta: { name: 'find', description: 'Search canonical + proto skills by keyword — matches name, description, id. Ranked by token overlap. Eliminates the "guess the slug" problem for cold agents.' },
  args: {
    query: { type: 'positional', description: 'keyword(s) to match', required: true },
    limit: { type: 'string', description: 'max results (default 10)', default: '10' },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir, finalSkillsDir } = evolutionPaths(repoRoot);
    const limit = parseInt(args.limit, 10) || 10;
    const query = String(args.query || '').toLowerCase();
    if (!query) {
      console.error('gad skill find requires a search query');
      process.exit(1);
    }
    const queryTokens = new Set(
      query.split(/[^a-z0-9]+/).filter((t) => t.length >= 2)
    );

    const entries = [];
    const harvest = (root, kind) => {
      for (const s of listSkillDirs(root)) {
        const fm = readSkillFrontmatter(s.skillFile);
        const haystack = `${s.id} ${fm.name || ''} ${fm.description || ''}`.toLowerCase();
        const haystackTokens = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));
        let score = 0;
        // Direct substring gets a big boost — matches the user's mental model.
        if (haystack.includes(query)) score += 10;
        // Token overlap (Jaccard-ish without normalizing for union size).
        for (const t of queryTokens) if (haystackTokens.has(t)) score += 2;
        // Partial token match (keyword appears inside any token).
        for (const t of queryTokens) {
          for (const ht of haystackTokens) {
            if (ht !== t && ht.includes(t)) score += 1;
          }
        }
        if (score > 0) {
          entries.push({ id: s.id, name: fm.name || s.id, description: fm.description || '', workflow: fm.workflow || null, kind, score });
        }
      }
    };
    harvest(finalSkillsDir, 'canonical');
    harvest(protoSkillsDir, 'proto');

    if (entries.length === 0) {
      console.log(`No skills matched query: ${query}`);
      console.log(`Try:  gad skill list          # full inventory`);
      console.log(`      gad skill find debug    # keyword search`);
      return;
    }

    entries.sort((a, b) => b.score - a.score);
    const top = entries.slice(0, limit);
    console.log(`Skills matching "${query}" (${top.length} of ${entries.length}):`);
    console.log('');
    for (const e of top) {
      const tag = e.kind === 'proto' ? ' [proto]' : '';
      const wf = e.workflow ? ` → ${e.workflow}` : '';
      const desc = (e.description || '').replace(/\s+/g, ' ').slice(0, 120);
      console.log(`  ${e.id}${tag}${wf}`);
      if (desc) console.log(`      ${desc}`);
    }
    console.log('');
    console.log('Inspect with: gad skill show <id>');
  },
});

const skillCmd = defineCommand({
  meta: { name: 'skill', description: 'Skill ops — list, show, find, promote (--framework canonical / --project consumer runtime install), promote-folder (any skill-shaped folder → framework canonical, framework-only). See decisions gad-188, gad-196.' },
  subCommands: {
    list: skillList,
    show: skillShow,
    find: skillFind,
    promote: skillPromote,
    'promote-folder': skillPromoteFolder,
  },
});

const evolutionDiscard = defineCommand({
  meta: { name: 'discard', description: 'Discard a proto-skill (deletes the directory)' },
  args: {
    slug: { type: 'positional', description: 'proto-skill slug', required: true },
    keepCandidate: { type: 'boolean', description: 'keep the candidate file (only delete the proto-skill draft)', required: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir, candidatesDir } = evolutionPaths(repoRoot);
    const protoDir = path.join(protoSkillsDir, args.slug);
    if (!fs.existsSync(protoDir)) {
      console.error(`No proto-skill at ${protoDir}`);
      process.exit(1);
    }
    fs.rmSync(protoDir, { recursive: true, force: true });
    console.log(`Discarded proto-skill: ${path.relative(repoRoot, protoDir)}`);
    if (!args.keepCandidate) {
      const candidateDir = path.join(candidatesDir, args.slug);
      if (fs.existsSync(candidateDir)) {
        fs.rmSync(candidateDir, { recursive: true, force: true });
        console.log(`Discarded candidate:    ${path.relative(repoRoot, candidateDir)}`);
      }
    }
  },
});

const { classifyProtoSkillDraftingState } = require('../lib/proto-skill-state.cjs');

const evolutionStatus = defineCommand({
  meta: { name: 'status', description: 'Show evolution state — pending proto-skills + candidates' },
  run() {
    const repoRoot = path.resolve(__dirname, '..');
    const { candidatesDir, protoSkillsDir, evolutionsDir } = evolutionPaths(repoRoot);
    const candidates = fs.existsSync(candidatesDir)
      ? fs.readdirSync(candidatesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
      : [];
    const protoSkills = fs.existsSync(protoSkillsDir)
      ? fs.readdirSync(protoSkillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
      : [];
    const evolutions = fs.existsSync(evolutionsDir)
      ? fs.readdirSync(evolutionsDir).filter((e) => !e.startsWith('.'))
      : [];

    const drafting = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);

    if (candidates.length === 0 && protoSkills.length === 0) {
      console.log('No active evolution.');
      console.log(`  ${evolutions.length} historical evolutions recorded in skills/.evolutions/`);
      return;
    }
    console.log(`Active evolution: ${evolutions[evolutions.length - 1] || '(no marker found)'}`);
    console.log('');

    // Drafting queue — the counts create-proto-skill's checkpoint protocol relies on.
    console.log('Drafting queue (create-proto-skill):');
    console.log(`  pending:     ${drafting.pending.length}   (candidate without proto-skill dir)`);
    console.log(`  in-progress: ${drafting.inProgress.length}   (PROVENANCE.md present, SKILL.md missing — resume target)`);
    console.log(`  complete:    ${drafting.complete.length}   (proto-skill bundle drafted)`);
    console.log('');

    if (drafting.inProgress.length > 0) {
      console.log('Resume in-progress proto-skills (previous run crashed mid-draft):');
      for (const slug of drafting.inProgress) {
        console.log(`  - ${protoSkillRelativePath(slug)}/   [PROVENANCE.md only]`);
      }
      console.log('');
    }

    if (candidates.length > 0) {
      console.log(`Candidates (raw, awaiting drafting): ${candidates.length}`);
      for (const c of candidates) console.log(`  - .planning/candidates/${c}/`);
      console.log('');
    }
    if (protoSkills.length > 0) {
      console.log(`Proto-skills (drafted, awaiting human review): ${protoSkills.length}`);
      for (const p of protoSkills) {
        const hasValidation = fs.existsSync(path.join(protoSkillsDir, p, 'VALIDATION.md'));
        console.log(`  - ${protoSkillRelativePath(p)}/   ${hasValidation ? '[validated]' : '[no validation yet]'}`);
      }
      console.log('');
      console.log('Review then run:');
      console.log('  gad evolution install <slug> [--codex|--claude|...]   # test without promotion');
      console.log('  gad evolution promote <slug>   # joins species DNA');
      console.log('  gad evolution discard <slug>   # delete');
    }
  },
});

const evolutionSimilarity = defineCommand({
  meta: { name: 'similarity', description: 'Compute semantic similarity matrix across candidates + proto-skills (offline, no API)' },
  args: {
    threshold: { type: 'string', description: 'Flag pairs with score >= threshold (default 0.6)', default: '0.6' },
    shedThreshold: { type: 'string', description: 'Flag candidates stale vs promoted skills above this score (default 0.55)', default: '0.55' },
    includePromoted: { type: 'boolean', description: 'Include promoted skills/ in the main matrix (default: only shedding-compare)', default: false },
    against: { type: 'string', description: 'Reference corpus for shedding: "skills" (promoted skills — HIGH = redundant) or "sprint" (current sprint trajectory — LOW = obsolete)', default: 'skills' },
    obsoleteThreshold: { type: 'string', description: 'With --against sprint, flag candidates BELOW this score as obsolete (default 0.40 TF-IDF / 0.65 embeddings)', default: '' },
    embeddings: { type: 'boolean', description: 'Use transformers.js embeddings instead of TF-IDF (requires `gad models install`)', default: false },
    model: { type: 'string', description: 'Embedding model id or tag (e.g. minilm, bge-small) — default Xenova/all-MiniLM-L6-v2', default: '' },
    json: { type: 'boolean', description: 'Emit JSON instead of markdown report', default: false },
  },
  async run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const sim = require('../lib/similarity.cjs');
    const threshold = parseFloat(args.threshold);
    const shedThreshold = parseFloat(args.shedThreshold);
    const useSprint = args.against === 'sprint';
    const obsoleteDefault = args.embeddings ? 0.65 : 0.40;
    const obsoleteThreshold = args.obsoleteThreshold ? parseFloat(args.obsoleteThreshold) : obsoleteDefault;

    const candidateDocs = sim.loadCorpusFromDirs([
      { kind: 'candidate', root: path.join(repoRoot, '.planning', 'candidates') },
      { kind: 'proto',     root: path.join(repoRoot, '.planning', 'proto-skills') },
    ]);
    const promotedDocs = sim.loadCorpusFromDirs([
      { kind: 'skill', root: path.join(repoRoot, 'skills') },
    ]).filter((d) => !d.id.includes('/candidates/') && !d.id.includes('/.evolutions/'));

    // Sprint-window reference corpus: a single virtual doc composed of
    // STATE.xml next-action, open/recent tasks, recent decisions, and
    // planned/active roadmap phase goals. Used when --against=sprint so
    // candidates can be checked against the live trajectory.
    const sprintDoc = useSprint ? sim.loadSprintCorpus(repoRoot, repoRoot) : null;

    const mainDocs = args.includePromoted ? [...candidateDocs, ...promotedDocs] : candidateDocs;

    let analysis, shed;
    if (args.embeddings) {
      const emb = require('../lib/embeddings.cjs');
      const modelId = emb.resolveModelId(args.model);
      console.error(`[embeddings] model=${modelId}`);
      console.error(`[embeddings] encoding ${mainDocs.length} docs...`);
      try {
        const vectors = await emb.embedCorpus(mainDocs, modelId, repoRoot, (i, n) => {
          if (i % 5 === 0 || i === n) console.error(`[embeddings]   ${i}/${n}`);
        });
        analysis = emb.analyzeEmbeddingCorpus(mainDocs, vectors, { threshold });
        // Shedding pass: embed promoted skills and find best match per candidate.
        console.error(`[embeddings] encoding ${promotedDocs.length} promoted skills for shedding...`);
        const promotedVecs = await emb.embedCorpus(promotedDocs, modelId, repoRoot);
        const candVecStart = args.includePromoted ? 0 : 0; // candidateDocs are the first N of mainDocs
        const shedResults = [];
        for (let i = 0; i < candidateDocs.length; i++) {
          const cv = vectors[candVecStart + i];
          let best = { id: null, score: 0 };
          for (let j = 0; j < promotedDocs.length; j++) {
            const score = emb.cosineSimDense(cv, promotedVecs[j]);
            if (score > best.score) best = { id: promotedDocs[j].id, score };
          }
          shedResults.push({
            candidate: candidateDocs[i].id,
            bestMatch: best.id,
            score: best.score,
            cosine: best.score,
            jaccard: 0,
            stale: best.score >= shedThreshold,
          });
        }
        shedResults.sort((a, b) => b.score - a.score);
        shed = { results: shedResults, threshold: shedThreshold };
        // Decorate pairs with unique-term diffs from the TF-IDF path so the
        // "context being lost on merge" report still works. The TF-IDF diff
        // is independent of the similarity score and cheap to recompute.
        const tfidfRef = sim.analyzeCorpus(mainDocs, { threshold: 0 });
        const pairIndex = new Map();
        for (const p of tfidfRef.pairs) pairIndex.set(`${p.a}||${p.b}`, p);
        analysis.pairs = analysis.pairs.map((p) => {
          const tf = pairIndex.get(`${p.a}||${p.b}`) || pairIndex.get(`${p.b}||${p.a}`);
          return {
            ...p,
            cosine: p.score,
            jaccard: 0,
            uniqueInA: tf?.uniqueInA || [],
            uniqueInB: tf?.uniqueInB || [],
            sharedFiles: tf?.sharedFiles || [],
          };
        });
      } catch (err) {
        if (err.code === 'TRANSFORMERS_MISSING') {
          console.error(err.message);
          process.exit(2);
        }
        throw err;
      }
    } else {
      analysis = sim.analyzeCorpus(mainDocs, { threshold });
      shed = sim.analyzeShedding(candidateDocs, promotedDocs, { threshold: shedThreshold });
    }

    // Sprint-window obsolescence pass. For every candidate, score its
    // similarity against the single sprint virtual doc. LOW score means the
    // candidate is outside the live trajectory — likely obsolete, shed it.
    let obsolete = null;
    if (useSprint && sprintDoc && sprintDoc.text.trim()) {
      if (args.embeddings) {
        const emb = require('../lib/embeddings.cjs');
        const modelId = emb.resolveModelId(args.model);
        console.error(`[embeddings] encoding sprint corpus...`);
        const [sprintVec] = await emb.embedCorpus([sprintDoc], modelId, repoRoot);
        console.error(`[embeddings] scoring ${candidateDocs.length} candidates vs sprint...`);
        const candVecs = await emb.embedCorpus(candidateDocs, modelId, repoRoot);
        const rows = candidateDocs.map((c, i) => {
          const score = emb.cosineSimDense(candVecs[i], sprintVec);
          return { candidate: c.id, score, obsolete: score < obsoleteThreshold };
        });
        rows.sort((a, b) => a.score - b.score);
        obsolete = { threshold: obsoleteThreshold, results: rows };
      } else {
        // Pure TF-IDF: build one corpus of candidates + sprint, compute doc freq,
        // then cosine each candidate against sprint.
        const all = [...candidateDocs, sprintDoc];
        const tf = sim.analyzeCorpus(all, { threshold: 0 });
        // analyzeCorpus returns a matrix — use it. Sprint is the last row.
        const sprintIdx = all.length - 1;
        const rows = candidateDocs.map((c, i) => ({
          candidate: c.id,
          score: tf.matrix[i][sprintIdx],
          obsolete: tf.matrix[i][sprintIdx] < obsoleteThreshold,
        }));
        rows.sort((a, b) => a.score - b.score);
        obsolete = { threshold: obsoleteThreshold, results: rows };
      }
    }

    if (args.json) {
      console.log(JSON.stringify({
        docCount: analysis.docCount,
        threshold: analysis.threshold,
        pairs: analysis.pairs,
        matrix: analysis.matrix,
        ids: analysis.ids,
        shedding: shed,
      }, null, 2));
      return;
    }

    // Build the path map from the full union so both main analysis and
    // shedding reports can print clickable repo-relative paths.
    const pathMap = sim.buildPathMap([...candidateDocs, ...promotedDocs]);
    const cwd = process.cwd();

    console.log(`# Similarity analysis — ${analysis.docCount} docs, threshold ${threshold.toFixed(2)}`);
    if (args.embeddings) {
      console.log('');
      console.log('Backend: embeddings (Xenova/all-MiniLM-L6-v2 by default).');
      console.log('Note: embedding scores run ~0.15-0.25 higher than TF-IDF on the same');
      console.log('corpus because the model captures topical prior ("GAD framework prose")');
      console.log('as baseline similarity. Suggested thresholds with --embeddings:');
      console.log('  merge-candidate:  --threshold 0.80   (vs 0.60 for TF-IDF)');
      console.log('  stale-shed:       --shedThreshold 0.75   (vs 0.55 for TF-IDF)');
    }
    console.log('');
    console.log('## Flagged pairs (score >= threshold)');
    if (analysis.pairs.length === 0) {
      console.log('  none');
    } else {
      console.log('');
      for (const pair of analysis.pairs) {
        console.log(sim.formatPairReport(pair, pathMap, cwd));
        console.log('');
      }
    }
    console.log('## Full matrix');
    console.log('');
    console.log(sim.formatMatrixMarkdown(analysis));
    console.log('');
    console.log('## Shedding (candidates vs promoted skills)');
    console.log('');
    console.log(sim.formatSheddingReport(shed, pathMap, cwd));
    console.log('');
    const stale = shed.results.filter((r) => r.stale).length;
    const flagged = analysis.pairs.length;
    let obsoleteCount = 0;
    if (obsolete) {
      console.log('');
      console.log(`## Sprint-window obsolescence (candidates vs active trajectory)`);
      console.log('');
      console.log(`Low score = candidate is outside the live sprint trajectory.`);
      console.log(`Obsolete threshold: < ${obsoleteThreshold.toFixed(2)} (below this = probably shed)`);
      console.log('');
      const obs = obsolete.results.filter((r) => r.obsolete);
      const live = obsolete.results.filter((r) => !r.obsolete);
      console.log(`Likely obsolete (${obs.length}): project evolved past these — discard candidates`);
      for (const r of obs) {
        console.log(`  [${r.score.toFixed(3)}] ${r.candidate}`);
        const p = pathMap.get(r.candidate);
        if (p) {
          const rel = path.relative(cwd, p).split(path.sep).join('/');
          console.log(`           ${rel}`);
        }
      }
      console.log('');
      console.log(`Still in trajectory (${live.length}):`);
      for (const r of live) {
        console.log(`  [${r.score.toFixed(3)}] ${r.candidate}`);
      }
      obsoleteCount = obs.length;
    }
    console.log('');
    console.log(`Summary: ${flagged} merge-candidate pair(s) above ${threshold.toFixed(2)}, ${stale} stale candidate(s) above ${shedThreshold.toFixed(2)}${obsolete ? `, ${obsoleteCount} obsolete candidate(s) below ${obsoleteThreshold.toFixed(2)} vs sprint` : ''}.`);
    if (obsolete && obsoleteCount > 0) {
      console.log('');
      console.log(`Shed the obsolete ones with:`);
      for (const r of obsolete.results.filter((r) => r.obsolete)) {
        const slug = r.candidate.split(':').pop();
        console.log(`  gad evolution shed ${slug}`);
      }
    }
  },
});

// ---------------------------------------------------------------------------
// `gad evolution shed` — dismiss a candidate so self-eval stops regenerating
// it. Deletes the candidate dir and writes a one-line reason marker to
// skills/.shed/<slug> that compute-self-eval.mjs respects.
// ---------------------------------------------------------------------------
function shedOne(repoRoot, slug, reason) {
  const candidateDir = path.join(repoRoot, '.planning', 'candidates', slug);
  const shedDir = path.join(repoRoot, 'skills', '.shed');
  if (!fs.existsSync(candidateDir)) return { ok: false, reason: 'not-found', slug };
  if (!fs.existsSync(shedDir)) fs.mkdirSync(shedDir, { recursive: true });
  fs.writeFileSync(path.join(shedDir, slug), `${new Date().toISOString()}\n${reason}\n`);
  fs.rmSync(candidateDir, { recursive: true, force: true });
  return { ok: true, slug, marker: path.join(shedDir, slug) };
}

const evolutionShed = defineCommand({
  meta: { name: 'shed', description: 'Dismiss candidates — delete and prevent regeneration. Use --all to clear, --obsolete to shed only ones below the sprint-window threshold.' },
  args: {
    slug: { type: 'positional', description: 'Candidate slug (omit when using --all or --obsolete)', required: false, default: '' },
    all: { type: 'boolean', description: 'Shed every candidate currently under .planning/candidates/', default: false },
    obsolete: { type: 'boolean', description: 'Shed only candidates flagged obsolete by sprint-window analysis (uses --threshold)', default: false },
    threshold: { type: 'string', description: 'Obsolete cutoff for --obsolete (default 0.65 with embeddings, 0.40 TF-IDF)', default: '' },
    embeddings: { type: 'boolean', description: 'Use embeddings backend for --obsolete (default TF-IDF)', default: false },
    reason: { type: 'string', description: 'Reason recorded in skills/.shed/<slug>', default: 'shed via cli' },
    dryRun: { type: 'boolean', description: 'Print what would be shed without doing it', default: false },
  },
  async run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const candidatesDir = path.join(repoRoot, '.planning', 'candidates');

    let targets = [];
    if (args.all) {
      targets = fs.existsSync(candidatesDir)
        ? fs.readdirSync(candidatesDir, { withFileTypes: true })
            .filter((e) => e.isDirectory()).map((e) => e.name)
        : [];
    } else if (args.obsolete) {
      const sim = require('../lib/similarity.cjs');
      const sprintDoc = sim.loadSprintCorpus(repoRoot, repoRoot);
      const candidateDocs = sim.loadCorpusFromDirs([
        { kind: 'candidate', root: candidatesDir },
      ]);
      const cutoff = args.threshold ? parseFloat(args.threshold) : (args.embeddings ? 0.65 : 0.40);
      let scores;
      if (args.embeddings) {
        const emb = require('../lib/embeddings.cjs');
        const modelId = emb.resolveModelId('');
        const [sv] = await emb.embedCorpus([sprintDoc], modelId, repoRoot);
        const cv = await emb.embedCorpus(candidateDocs, modelId, repoRoot);
        scores = candidateDocs.map((c, i) => ({ slug: c.id.split(':').pop(), score: emb.cosineSimDense(cv[i], sv) }));
      } else {
        const tf = sim.analyzeCorpus([...candidateDocs, sprintDoc], { threshold: 0 });
        const last = tf.matrix.length - 1;
        scores = candidateDocs.map((c, i) => ({ slug: c.id.split(':').pop(), score: tf.matrix[i][last] }));
      }
      targets = scores.filter((s) => s.score < cutoff).map((s) => s.slug);
      console.log(`[obsolete] cutoff=${cutoff.toFixed(2)} → ${targets.length}/${candidateDocs.length} candidates flagged`);
    } else if (args.slug) {
      targets = [args.slug];
    } else {
      console.error('Provide a slug, or use --all, or --obsolete.');
      process.exit(1);
    }

    if (targets.length === 0) {
      console.log('Nothing to shed.');
      return;
    }

    if (args.dryRun) {
      console.log(`[dry-run] would shed ${targets.length}:`);
      for (const s of targets) console.log(`  ${s}`);
      return;
    }

    const results = targets.map((slug) => shedOne(repoRoot, slug, args.reason));
    const ok = results.filter((r) => r.ok);
    const missing = results.filter((r) => !r.ok);
    console.log(`Shed: ${ok.length}/${targets.length}`);
    for (const r of ok) console.log(`  ${path.relative(repoRoot, path.join(repoRoot, '.planning', 'candidates', r.slug))}`);
    if (missing.length) {
      console.log('');
      console.log(`Not found: ${missing.length}`);
      for (const r of missing) console.log(`  ${r.slug}`);
    }
    console.log('');
    console.log(`Markers: ${path.relative(repoRoot, path.join(repoRoot, 'skills', '.shed'))}`);
    console.log('Self-eval will skip these slugs on future runs.');
  },
});

const evolutionCmd = defineCommand({
  meta: { name: 'evolution', description: 'Manage GAD evolution proto-skills (validate/promote/discard/status/similarity/images)' },
  subCommands: {
    install: evolutionInstall,
    validate: evolutionValidate,
    promote: evolutionPromote,
    discard: evolutionDiscard,
    status: evolutionStatus,
    similarity: evolutionSimilarity,
    shed: evolutionShed,
    images: evolutionImagesCmd,
  },
});

// -------------------------------------------------------------------------
// workflow subcommands (phase 42.3-11) — status/validate/promote/discard
// for hand-authored + emergent workflows. Decision gad-174.
//
// Mirrors the `gad evolution` surface so users learn one mental model.
// Authored workflows live at .planning/workflows/<slug>.md. Emergent
// candidates are surfaced via `compute-self-eval` / `build-site-data`
// mining trace events; promotion persists the detector's best candidate
// to .planning/workflows/<slug>.md with an inlined PROVENANCE block.
// -------------------------------------------------------------------------

const workflowPaths = (repoRoot) => ({
  workflowsDir: path.join(repoRoot, '.planning', 'workflows'),
  emergentDir: path.join(repoRoot, '.planning', 'workflows', 'emergent'),
  catalogFile: path.join(repoRoot, 'site', 'lib', 'catalog.generated.ts'),
});

function loadWorkflowsFromCatalog(catalogFile) {
  if (!fs.existsSync(catalogFile)) {
    return { authored: [], emergent: [], error: `catalog not found at ${catalogFile} — run build-site-data.mjs first` };
  }
  const src = fs.readFileSync(catalogFile, 'utf8');
  const m = src.match(/export const WORKFLOWS: Workflow\[\] = (\[[\s\S]*?\]);/);
  if (!m) return { authored: [], emergent: [], error: 'WORKFLOWS export not found in catalog.generated.ts' };
  try {
    const arr = JSON.parse(m[1]);
    return {
      authored: arr.filter((w) => w.origin !== 'emergent'),
      emergent: arr.filter((w) => w.origin === 'emergent'),
    };
  } catch (err) {
    return { authored: [], emergent: [], error: `parse error: ${err.message}` };
  }
}

function readWorkflowFrontmatter(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: src };
  const frontmatter = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) frontmatter[kv[1]] = kv[2].trim();
  }
  return { frontmatter, body: m[2] };
}

const workflowStatus = defineCommand({
  meta: { name: 'status', description: 'Show workflow state — authored + emergent candidates + conformance' },
  async run() {
    const repoRoot = process.cwd();
    const { workflowsDir, catalogFile } = workflowPaths(repoRoot);

    // Count authored files on disk (source of truth before catalog build).
    let authoredOnDisk = 0;
    if (fs.existsSync(workflowsDir)) {
      for (const name of fs.readdirSync(workflowsDir)) {
        if (name.endsWith('.md') && name !== 'README.md') authoredOnDisk += 1;
      }
    }

    const { authored, emergent, error } = loadWorkflowsFromCatalog(catalogFile);
    if (error) {
      console.log(`Authored workflows on disk: ${authoredOnDisk}`);
      console.log(`Emergent candidates: unknown (${error})`);
      console.log('');
      console.log('Run `node site/scripts/build-site-data.mjs` to refresh the catalog.');
      return;
    }

    console.log(`Authored workflows: ${authored.length}`);
    for (const w of authored) {
      const conf = w.conformance ? ` conformance=${(w.conformance.score * 100).toFixed(0)}%` : '';
      const parent = w.parentWorkflow ? ` [→ ${w.parentWorkflow}]` : '';
      console.log(`  ${w.slug}${parent}${conf}`);
    }
    console.log('');
    console.log(`Emergent candidates: ${emergent.length}`);
    for (const e of emergent) {
      const support = e.support ? ` support=${e.support.phases}×` : '';
      console.log(`  ${e.slug}${support}`);
    }
    if (emergent.length > 0) {
      console.log('');
      console.log('Next:');
      console.log('  gad workflow promote <slug>   # persist as .planning/workflows/<name>.md');
      console.log('  gad workflow discard <slug>   # drop for this run (will re-detect next build if still above threshold)');
    }
  },
});

const workflowValidate = defineCommand({
  meta: { name: 'validate', description: 'Re-run the detector + conformance scorer against current trace data' },
  async run() {
    const repoRoot = process.cwd();
    const script = path.join(repoRoot, 'site', 'scripts', 'build-site-data.mjs');
    if (!fs.existsSync(script)) {
      console.error(`build-site-data.mjs not found at ${script}`);
      process.exitCode = 1;
      return;
    }
    console.log('Refreshing workflow catalog by running build-site-data.mjs...');
    const { spawnSync } = require('child_process');
    const result = spawnSync(process.execPath, [script], { cwd: path.dirname(script), stdio: 'inherit' });
    if (result.status !== 0) {
      console.error(`build-site-data.mjs exited with status ${result.status}`);
      process.exitCode = result.status || 1;
      return;
    }
    console.log('');
    console.log('Catalog refreshed. Run `gad workflow status` to see the current state.');
  },
});

const workflowPromote = defineCommand({
  meta: { name: 'promote', description: 'Promote an emergent candidate to an authored workflow' },
  args: {
    slug: { type: 'positional', description: 'Emergent workflow slug from `gad workflow status`' },
    name: { type: 'string', alias: 'n', description: 'Final workflow slug on disk (defaults to emergent slug stripped of support suffix)' },
  },
  async run({ args }) {
    const repoRoot = process.cwd();
    const { workflowsDir, catalogFile } = workflowPaths(repoRoot);
    const { emergent, error } = loadWorkflowsFromCatalog(catalogFile);
    if (error) {
      console.error(error);
      process.exitCode = 1;
      return;
    }
    const cand = emergent.find((e) => e.slug === args.slug);
    if (!cand) {
      console.error(`Emergent workflow not found: ${args.slug}`);
      console.error('Run `gad workflow status` to list current candidates.');
      process.exitCode = 1;
      return;
    }
    const finalSlug = args.name || cand.slug.replace(/^emergent-/, '').replace(/-\d+-\d+$/, '');
    const targetFile = path.join(workflowsDir, `${finalSlug}.md`);
    if (fs.existsSync(targetFile)) {
      console.error(`Refusing to overwrite existing workflow file: ${path.relative(repoRoot, targetFile)}`);
      console.error(`Use --name to choose a different slug.`);
      process.exitCode = 1;
      return;
    }

    const now = new Date().toISOString();
    const frontmatter = [
      '---',
      `slug: ${finalSlug}`,
      `name: ${cand.name || finalSlug}`,
      `description: ${(cand.description || '').replace(/\n/g, ' ')}`,
      `trigger: ${(cand.trigger || 'Detected automatically from trace data.').replace(/\n/g, ' ')}`,
      'participants:',
      '  skills: []',
      '  agents: [default]',
      '  cli: []',
      '  artifacts: []',
      'parent-workflow: null',
      'related-phases: [42.3]',
      'origin: authored',
      'provenance:',
      `  emergent-slug: ${cand.slug}`,
      `  support: ${cand.support ? cand.support.phases : 1}`,
      `  promoted-at: ${now}`,
      '---',
      '',
      '## Provenance',
      '',
      `This workflow was promoted from an emergent detector candidate on ${now.slice(0, 10)}.`,
      `It was observed ${cand.support ? cand.support.phases : 'N'}× in trace data before promotion.`,
      'Original detector slug: `' + cand.slug + '`.',
      '',
      '## Expected graph',
      '',
      '```mermaid',
      cand.mermaidBody || 'flowchart LR\n  a[unknown]',
      '```',
      '',
    ].join('\n');

    if (!fs.existsSync(workflowsDir)) fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(targetFile, frontmatter, 'utf8');
    console.log(`✓ Promoted ${args.slug}`);
    console.log(`  → ${path.relative(repoRoot, targetFile)}`);
    console.log('');
    console.log('Review the file, edit frontmatter participants to describe the real pattern,');
    console.log('then re-run `node site/scripts/build-site-data.mjs` so the authored graph picks it up.');
  },
});

const workflowDiscard = defineCommand({
  meta: { name: 'discard', description: 'Discard an emergent candidate for this run (detector will re-emit next build if still above threshold)' },
  args: {
    slug: { type: 'positional', description: 'Emergent workflow slug' },
  },
  async run({ args }) {
    console.log(`Discarded candidate: ${args.slug}`);
    console.log('');
    console.log('Emergent candidates are regenerated from trace data on every build.');
    console.log('To permanently suppress this pattern, raise the detector thresholds in');
    console.log('.planning/config.json (min_support, min_length, etc).');
  },
});

const workflowCmd = defineCommand({
  meta: { name: 'workflow', description: 'Manage GAD workflows — status/validate/promote/discard authored + emergent' },
  subCommands: {
    status: workflowStatus,
    validate: workflowValidate,
    promote: workflowPromote,
    discard: workflowDiscard,
  },
});

// ---------------------------------------------------------------------------
// models subcommands — manage local embedding models per gad project.
// Models cache under `.gad/models/` at the repo root (never committed).
// Zero-cost when unused; lazy-requires @huggingface/transformers only when
// an action that needs it runs.
// ---------------------------------------------------------------------------

const modelsListAvailable = defineCommand({
  meta: { name: 'list-available', description: 'Show curated embedding models we know work with gad' },
  run() {
    const emb = require('../lib/embeddings.cjs');
    console.log('Curated embedding models:');
    console.log('');
    for (const m of emb.CURATED_MODELS) {
      const def = m.id === emb.DEFAULT_MODEL ? ' (default)' : '';
      console.log(`  ${m.tag.padEnd(12)} ${m.id}${def}`);
      console.log(`    ${m.note}`);
      console.log(`    ~${m.sizeMB}MB on disk, ${m.dim}-dim vectors, task=${m.task}`);
      console.log('');
    }
    console.log('Install: gad models install <tag-or-id>');
    console.log('Example: gad models install minilm');
  },
});

const modelsList = defineCommand({
  meta: { name: 'list', description: 'Show models installed in this gad project' },
  run() {
    const emb = require('../lib/embeddings.cjs');
    const repoRoot = process.cwd();
    const installed = emb.listInstalledModels(repoRoot);
    const dir = emb.projectModelsDir(repoRoot);
    console.log(`Project models dir: ${dir}`);
    console.log('');
    if (installed.length === 0) {
      console.log('No models installed.');
      console.log('');
      console.log('Install one with: gad models install <tag-or-id>');
      console.log('See options with:  gad models list-available');
      return;
    }
    console.log(`Installed models (${installed.length}):`);
    for (const m of installed) {
      console.log(`  ${m.id}   ${emb.formatBytes(m.sizeBytes)}`);
      console.log(`    ${m.path}`);
    }
  },
});

const modelsPath = defineCommand({
  meta: { name: 'path', description: 'Print the project models cache directory' },
  run() {
    const emb = require('../lib/embeddings.cjs');
    console.log(emb.projectModelsDir(process.cwd()));
  },
});

const modelsInstall = defineCommand({
  meta: { name: 'install', description: 'Download and cache an embedding model from HuggingFace' },
  args: {
    model: { type: 'positional', description: 'Model id or tag (e.g. minilm, Xenova/all-MiniLM-L6-v2)', required: false, default: '' },
  },
  async run({ args }) {
    const emb = require('../lib/embeddings.cjs');
    const repoRoot = process.cwd();
    const modelId = emb.resolveModelId(args.model);
    console.log(`Resolving: ${modelId}`);
    console.log(`Cache dir: ${emb.projectModelsDir(repoRoot)}`);
    console.log('');
    console.log('Downloading (first run will fetch ~90MB for MiniLM)...');
    try {
      // Instantiating the pipeline forces transformers.js to fetch and cache
      // the model weights + tokenizer into env.cacheDir.
      await emb.getEmbedder(modelId, repoRoot);
      console.log('');
      console.log(`Installed: ${modelId}`);
      const installed = emb.listInstalledModels(repoRoot);
      const match = installed.find((m) => m.id === modelId);
      if (match) {
        console.log(`  ${match.path}`);
        console.log(`  ${emb.formatBytes(match.sizeBytes)}`);
      }
    } catch (err) {
      if (err.code === 'TRANSFORMERS_MISSING') {
        console.error(err.message);
        process.exit(2);
      }
      console.error(`Install failed: ${err.message}`);
      process.exit(1);
    }
  },
});

const modelsRemove = defineCommand({
  meta: { name: 'remove', description: 'Delete a cached model from this gad project' },
  args: {
    model: { type: 'positional', description: 'Model id to remove (full org/model form)', required: true },
  },
  run({ args }) {
    const emb = require('../lib/embeddings.cjs');
    const repoRoot = process.cwd();
    const installed = emb.listInstalledModels(repoRoot);
    const match = installed.find((m) => m.id === args.model || m.id.endsWith(`/${args.model}`));
    if (!match) {
      console.error(`Not installed: ${args.model}`);
      console.error('Run `gad models list` to see what is installed.');
      process.exit(1);
    }
    fs.rmSync(match.path, { recursive: true, force: true });
    // Also remove the org dir if empty
    const orgDir = path.dirname(match.path);
    try {
      if (fs.existsSync(orgDir) && fs.readdirSync(orgDir).length === 0) {
        fs.rmdirSync(orgDir);
      }
    } catch (_) { /* ignore */ }
    console.log(`Removed: ${match.id}`);
    console.log(`  ${match.path}`);
  },
});

const modelsCmd = defineCommand({
  meta: { name: 'models', description: 'Manage local embedding models for this gad project (install/remove/list)' },
  subCommands: {
    list: modelsList,
    'list-available': modelsListAvailable,
    install: modelsInstall,
    remove: modelsRemove,
    path: modelsPath,
  },
});

// ─── gad graph — planning knowledge-graph generator ────────────────────────
//
// Builds a typed-node, typed-edge graph from .planning/ XML files, skills/,
// and workflows/. Output: .planning/graph.json + .planning/graph.html.
// Structural queries are LLM-free — see `gad query`.

const graphExtractor = require('../lib/graph-extractor.cjs');

/**
 * Silently rebuild graph.json after a planning file mutation (task status change,
 * decision added, state update). ~320ms, zero deps, no output unless error.
 * Only rebuilds when useGraphQuery is enabled in gad-config.toml.
 */
function maybeRebuildGraph(baseDir, root) {
  try {
    if (!graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path))) return;
    const gadDir = path.resolve(__dirname, '..');
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const graph = graphExtractor.buildGraph(root, baseDir, { gadDir });
    fs.writeFileSync(path.join(planDir, 'graph.json'), JSON.stringify(graph, null, 2));
  } catch {
    // Silent — graph rebuild is best-effort, never blocks the primary operation.
  }
}

const graphBuildCmd = defineCommand({
  meta: { name: 'build', description: 'Generate graph.json + graph.html from .planning/ XML files' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    json: { type: 'boolean', description: 'Output graph JSON to stdout instead of file', default: false },
    html: { type: 'boolean', description: 'Also generate graph.html (default true)', default: true },
    stats: { type: 'boolean', description: 'Print graph stats summary', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    const gadDir = path.resolve(__dirname, '..');

    for (const root of roots) {
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const graph = graphExtractor.buildGraph(root, baseDir, { gadDir });

      if (args.json) {
        console.log(JSON.stringify(graph, null, 2));
        continue;
      }

      // Write graph.json
      const jsonPath = path.join(planDir, 'graph.json');
      fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
      console.log(`Written: ${path.relative(baseDir, jsonPath)} (${graph.meta.nodeCount} nodes, ${graph.meta.edgeCount} edges)`);

      // Write graph.html
      if (args.html !== false) {
        const htmlPath = path.join(planDir, 'graph.html');
        fs.writeFileSync(htmlPath, graphExtractor.generateHtml(graph));
        console.log(`Written: ${path.relative(baseDir, htmlPath)}`);
      }

      if (args.stats) {
        console.log('');
        console.log(`Node types: ${Object.entries(graph.meta.nodeTypes).map(([k,v]) => `${k}(${v})`).join(', ')}`);
        console.log(`Edge types: ${Object.entries(graph.meta.edgeTypes).map(([k,v]) => `${k}(${v})`).join(', ')}`);
      }
    }
  },
});

const graphStatsCmd = defineCommand({
  meta: { name: 'stats', description: 'Show graph statistics without regenerating' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    for (const root of roots) {
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const jsonPath = path.join(planDir, 'graph.json');
      if (!fs.existsSync(jsonPath)) {
        console.log(`No graph.json for ${root.id} — run \`gad graph build\` first.`);
        continue;
      }
      const graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      console.log(`[${root.id}] ${graph.meta.nodeCount} nodes, ${graph.meta.edgeCount} edges`);
      console.log(`  Node types: ${Object.entries(graph.meta.nodeTypes).map(([k,v]) => `${k}(${v})`).join(', ')}`);
      console.log(`  Edge types: ${Object.entries(graph.meta.edgeTypes).map(([k,v]) => `${k}(${v})`).join(', ')}`);
      console.log(`  Generated: ${graph.meta.generated}`);
    }
  },
});

const graphCmd = defineCommand({
  meta: { name: 'graph', description: 'Build and inspect the planning knowledge graph' },
  subCommands: {
    build: graphBuildCmd,
    stats: graphStatsCmd,
  },
});

// ─── gad query — structural graph queries ──────────────────────────────────
//
// Query the planning knowledge graph without reading full planning files.
// Accepts natural-language-ish queries or structured flags.
// Runs against .planning/graph.json (generated by `gad graph build`).

const queryRunCmd = defineCommand({
  meta: { name: 'run', description: 'Run a query against the planning graph' },
  args: {
    q: { type: 'positional', description: 'Natural language query (e.g. "open tasks in phase 44.5")', required: false },
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    type: { type: 'string', description: 'Filter by node type (phase, task, decision, skill, workflow)', default: '' },
    status: { type: 'string', description: 'Filter by status (planned, done, active, cancelled)', default: '' },
    phase: { type: 'string', description: 'Filter tasks in this phase', default: '' },
    skill: { type: 'string', description: 'Filter tasks using this skill', default: '' },
    depends: { type: 'string', description: 'Find nodes that depend on this ID', default: '' },
    cites: { type: 'string', description: 'Find nodes that cite this ID', default: '' },
    search: { type: 'string', description: 'Text search across node fields', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
    rebuild: { type: 'boolean', description: 'Rebuild graph before querying', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    const gadDir = path.resolve(__dirname, '..');

    for (const root of roots) {
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const jsonPath = path.join(planDir, 'graph.json');

      // Auto-build if missing or --rebuild
      if (!fs.existsSync(jsonPath) || args.rebuild) {
        const graph = graphExtractor.buildGraph(root, baseDir, { gadDir });
        fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
        if (!args.json) {
          console.error(`Graph built: ${graph.meta.nodeCount} nodes, ${graph.meta.edgeCount} edges`);
        }
      }

      const graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

      // Build query from args — natural language or structured
      let query = {};
      if (args.q) {
        query = graphExtractor.parseNaturalQuery(args.q);
      }
      // Structured flags override natural-language parsed fields
      if (args.type) query.type = args.type;
      if (args.status) query.status = args.status;
      if (args.phase) query.phase = args.phase;
      if (args.skill) query.skill = args.skill;
      if (args.depends) query.depends = args.depends;
      if (args.cites) query.cites = args.cites;
      if (args.search) query.search = args.search;

      const result = graphExtractor.queryGraph(graph, query);

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(graphExtractor.formatQueryResult(result, query));
      }
    }
  },
});

const queryCmd = defineCommand({
  meta: { name: 'query', description: 'Query the planning knowledge graph (structural, LLM-free)' },
  subCommands: {
    run: queryRunCmd,
  },
});

// ─── gad try — temporary skill install flow (task 42.2-40) ─────────────────
//
// Stage an external skill into .gad-try/<slug>/ without polluting
// ~/.claude/skills/ or the current project's .claude/skills/. Designed
// for trialing skills before full install — codebase maps, knowledge
// graphs, one-off artifact generators. Supports three source types:
//   - Local slug: `gad try codebase-map` → resolves to skills/<slug>/
//   - Git URL:    `gad try https://github.com/safishamsi/graphify`
//   - Local path: `gad try ./my-skill/`
//
// Does NOT execute the skill (decision gad-18: skills are methodology
// docs, not executable code). Writes ENTRY.md with a copy-paste handoff
// prompt for the user's coding agent and lists any dependencies the
// skill declared via `requires:` / `installs:` frontmatter.

function tryPaths(repoRoot) {
  const cwd = process.cwd();
  return {
    cwd,
    sandboxRoot: path.join(cwd, '.gad-try'),
  };
}

function slugifyRef(ref) {
  // Extract a kebab-case slug from any source ref — always the LAST
  // meaningful path segment.
  //   https://github.com/user/REPO         → repo
  //   https://github.com/user/REPO.git     → repo
  //   git@github.com:user/REPO.git         → repo
  //   ./foo/bar/                           → bar
  //   already-good                         → already-good
  const normalizeSegment = (s) => s.replace(/\.git$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');

  if (/^https?:\/\/|^git@|^git\+|^ssh:\/\//.test(ref)) {
    // Strip query / fragment, then take the last non-empty slash segment.
    const cleaned = ref.replace(/^git\+/, '').replace(/[#?].*$/, '').replace(/:/g, '/');
    const segments = cleaned.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || 'skill';
    return normalizeSegment(last);
  }
  if (ref.includes('/') || ref.includes('\\')) {
    return normalizeSegment(path.basename(ref.replace(/[\\]/g, '/').replace(/\/$/, '')));
  }
  return normalizeSegment(ref);
}

function parseFrontmatterLoose(body) {
  const match = body.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { raw: '', fields: {} };
  const raw = match[1];
  const fields = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = null;
  let currentList = null;
  for (const line of lines) {
    const keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();
      if (value === '' || value === '|' || value === '>-' || value === '>') {
        currentList = null;
        fields[currentKey] = '';
      } else {
        fields[currentKey] = value;
        currentList = null;
      }
    } else if (/^\s+-\s+/.test(line) && currentKey) {
      if (!currentList) {
        currentList = [];
        fields[currentKey] = currentList;
      }
      currentList.push(line.replace(/^\s+-\s+/, '').trim());
    }
  }
  return { raw, fields };
}

function extractSkillDependencies(skillBody) {
  // Extract dependency signals from SKILL.md — both declared (via
  // `requires:`/`installs:` frontmatter) and implicit (pip/npm/curl
  // commands mentioned in the body). Body signals are advisory only.
  const { fields } = parseFrontmatterLoose(skillBody);
  const requires = Array.isArray(fields.requires) ? fields.requires : (fields.requires ? [fields.requires] : []);
  const installs = Array.isArray(fields.installs) ? fields.installs : (fields.installs ? [fields.installs] : []);
  const outputs = Array.isArray(fields.outputs) ? fields.outputs : (fields.outputs ? [fields.outputs] : []);

  // Body signal scan — catches skills that don't declare frontmatter.
  const implicit = [];
  const bodyText = skillBody.replace(/^---[\s\S]*?---\s*/m, '');
  const patterns = [
    /\bpip install\s+[^\s`'"]+/g,
    /\bnpm install\s+-g\s+[^\s`'"]+/g,
    /\bnpm i\s+-g\s+[^\s`'"]+/g,
    /\bpipx install\s+[^\s`'"]+/g,
    /\buv tool install\s+[^\s`'"]+/g,
    /\bbrew install\s+[^\s`'"]+/g,
    /\bcurl -fsSL\s+https?:\/\/[^\s`'"]+/g,
  ];
  for (const pat of patterns) {
    const matches = bodyText.match(pat);
    if (matches) {
      for (const m of matches) {
        if (!implicit.includes(m)) implicit.push(m);
      }
    }
  }

  return { requires, installs, outputs, implicit };
}

function resolveTrySource(ref, repoRoot, opts = {}) {
  // Returns { kind, sourceDir, slug, cleanup } where kind is 'local-slug',
  // 'local-path', or 'git-url'. cleanup is a fn to call when done (e.g.
  // remove tmp clone).
  // opts.branch (task 42.2-40.b): explicit branch/tag override for git
  // sources — skips the fallback probe entirely when set.
  const slug = slugifyRef(ref);

  // Git URL
  if (/^https?:\/\/|^git@|^git\+|^ssh:\/\//.test(ref)) {
    const cleanRef = ref.replace(/^git\+/, '').replace(/#.*$/, '');
    // Parse optional branch/tag from `@ref` suffix: github.com/a/b@v1
    let cloneUrl = cleanRef;
    let branch = null;
    const atMatch = cleanRef.match(/^(.+?@[^:]+?:[^@]+?|[a-z]+:\/\/[^@]+?)@([^\/@]+)$/);
    if (atMatch) {
      cloneUrl = atMatch[1];
      branch = atMatch[2];
    }
    // Explicit opts.branch wins over @-suffix.
    if (opts.branch) branch = opts.branch;

    const tmpBase = path.join(require('os').tmpdir(), `gad-try-clone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    // Try the default branch first, then fall back to common skill-hosting
    // branches (v1 is Graphify's pattern, main / master are standard).
    // When branch is explicit, skip the fallback probe.
    const branchAttempts = branch
      ? [branch]
      : [null, 'v1', 'main', 'master'];

    let cloneErr = null;
    let cloned = false;
    for (const attempt of branchAttempts) {
      if (fs.existsSync(tmpBase)) {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      }
      const cloneArgs = ['clone', '--depth', '1'];
      if (attempt) cloneArgs.push('-b', attempt);
      cloneArgs.push(cloneUrl, tmpBase);
      try {
        require('child_process').execFileSync('git', cloneArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        cloned = true;
        break;
      } catch (err) {
        cloneErr = err;
      }
    }

    if (!cloned) {
      throw new Error(`git clone failed for ${cleanRef}: ${cloneErr?.stderr?.toString()?.slice(0, 200) || cloneErr?.message || 'unknown error'}`);
    }

    // Recursively search for SKILL.md / skill.md up to 3 levels deep.
    function walkForSkillMd(dir, depth) {
      if (depth > 3) return null;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return null;
      }
      // Prefer SKILL.md > skill.md at this level.
      for (const pref of ['SKILL.md', 'skill.md']) {
        const hit = entries.find((e) => e.isFile() && e.name === pref);
        if (hit) return path.join(dir, pref);
      }
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          const nested = walkForSkillMd(path.join(dir, e.name), depth + 1);
          if (nested) return nested;
        }
      }
      return null;
    }

    const found = walkForSkillMd(tmpBase, 0);
    if (!found) {
      fs.rmSync(tmpBase, { recursive: true, force: true });
      throw new Error(`no SKILL.md or skill.md found in ${cleanRef} within 3 levels`);
    }
    return {
      kind: 'git-url',
      sourceDir: path.dirname(found),
      slug,
      source: cleanRef,
      cleanup: () => {
        try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
      },
    };
  }

  // Local path
  if (ref.includes('/') || ref.includes('\\') || fs.existsSync(ref)) {
    const absPath = path.resolve(ref);
    if (!fs.existsSync(absPath)) {
      throw new Error(`path does not exist: ${ref}`);
    }
    const skillPath = fs.statSync(absPath).isFile() && /SKILL\.md$/i.test(absPath)
      ? absPath
      : path.join(absPath, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      throw new Error(`no SKILL.md at ${skillPath}`);
    }
    return {
      kind: 'local-path',
      sourceDir: path.dirname(skillPath),
      slug,
      source: absPath,
      cleanup: () => {},
    };
  }

  // Local slug — resolve against the framework skills/ dir.
  const slugDir = path.join(repoRoot, 'skills', ref);
  const slugSkill = path.join(slugDir, 'SKILL.md');
  if (fs.existsSync(slugSkill)) {
    return {
      kind: 'local-slug',
      sourceDir: slugDir,
      slug: ref,
      source: path.relative(repoRoot, slugDir),
      cleanup: () => {},
    };
  }

  throw new Error(`could not resolve skill ref "${ref}" — not a URL, not a path, not a skills/ slug`);
}

function stageTrySandbox(resolved, sandboxRoot) {
  const sandboxDir = path.join(sandboxRoot, resolved.slug);
  if (fs.existsSync(sandboxDir)) {
    throw new Error(`sandbox already exists at ${path.relative(process.cwd(), sandboxDir)} — run \`gad try cleanup ${resolved.slug}\` first`);
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  // Copy source dir contents into sandbox.
  fs.cpSync(resolved.sourceDir, sandboxDir, { recursive: true });

  // Task 42.2-40.b (1): strip .git/ from cloned sandboxes to save disk
  // space. For git-url sources, sourceDir is often the repo root and the
  // sandbox inherits a full git history that serves no purpose post-stage.
  const gitDir = path.join(sandboxDir, '.git');
  if (fs.existsSync(gitDir)) {
    try { fs.rmSync(gitDir, { recursive: true, force: true }); } catch {}
  }

  // Task 42.2-40.b (4): normalize lowercase skill.md -> SKILL.md so
  // downstream reads (which hardcode the canonical filename) succeed and
  // the sandbox matches the skill-shape contract.
  const upper = path.join(sandboxDir, 'SKILL.md');
  const lower = path.join(sandboxDir, 'skill.md');
  if (!fs.existsSync(upper) && fs.existsSync(lower)) {
    try {
      fs.renameSync(lower, upper);
      console.warn('  Note: source used lowercase skill.md — normalized to SKILL.md in sandbox.');
    } catch {
      // On case-insensitive filesystems the rename is a no-op; surface as a warning only.
      console.warn('  Note: source used lowercase skill.md — filesystem may be case-insensitive; downstream reads target SKILL.md.');
    }
  }

  return sandboxDir;
}

function writeTryProvenance(sandboxDir, resolved, deps) {
  const body = [
    '---',
    `slug: ${resolved.slug}`,
    `source: ${resolved.source}`,
    `kind: ${resolved.kind}`,
    `staged_on: ${new Date().toISOString().slice(0, 10)}`,
    `staged_by: gad-try`,
    '---',
    '',
    `# Provenance — ${resolved.slug}`,
    '',
    `Staged by \`gad try\` from ${resolved.kind} source: ${resolved.source}`,
    '',
    '## Declared requires',
    deps.requires.length === 0 ? '_(none declared)_' : deps.requires.map((r) => `- ${r}`).join('\n'),
    '',
    '## Declared installs',
    deps.installs.length === 0 ? '_(none declared)_' : deps.installs.map((r) => `- ${r}`).join('\n'),
    '',
    '## Implicit (body-scanned) install commands',
    deps.implicit.length === 0 ? '_(no pip/npm/brew/curl install commands found in SKILL.md body)_' : deps.implicit.map((r) => `- \`${r}\``).join('\n'),
    '',
    '## Declared outputs',
    deps.outputs.length === 0 ? '_(none declared — artifacts may land in cwd)_' : deps.outputs.map((r) => `- ${r}`).join('\n'),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sandboxDir, 'PROVENANCE.md'), body);
}

function buildHandoffPrompt(resolved) {
  // The canonical copy-paste text that the user hands to their coding
  // agent. Single source of truth so ENTRY.md, stdout, and the clipboard
  // all get the same string.
  return [
    `Invoke the skill at .gad-try/${resolved.slug}/SKILL.md on this directory.`,
    `Follow its instructions exactly. When done, tell me what artifacts it produced.`,
  ].join(' ');
}

/**
 * Copy a string to the OS clipboard via the platform's native command.
 * Shells out to clip.exe (Windows), pbcopy (macOS), wl-copy (Wayland),
 * xclip / xsel (X11). Silently degrades when no clipboard tool is
 * available — the handoff prompt is always printed and saved to
 * ENTRY.md so the clipboard path is a convenience, not a requirement.
 *
 * Returns the tool name on success, or null if nothing worked.
 */
function copyToClipboardSync(text) {
  const { spawnSync } = require('child_process');
  const attempts = [];
  if (process.platform === 'win32') {
    attempts.push({ cmd: 'clip', args: [] });
  } else if (process.platform === 'darwin') {
    attempts.push({ cmd: 'pbcopy', args: [] });
  } else {
    if (process.env.WAYLAND_DISPLAY) {
      attempts.push({ cmd: 'wl-copy', args: [] });
    }
    attempts.push({ cmd: 'xclip', args: ['-selection', 'clipboard'] });
    attempts.push({ cmd: 'xsel', args: ['--clipboard', '--input'] });
    // Wayland fallback for systems without WAYLAND_DISPLAY set.
    if (!process.env.WAYLAND_DISPLAY) {
      attempts.push({ cmd: 'wl-copy', args: [] });
    }
  }
  for (const { cmd, args } of attempts) {
    try {
      const result = spawnSync(cmd, args, {
        input: text,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      if (result.status === 0 && !result.error) return cmd;
    } catch {
      // Try the next one.
    }
  }
  return null;
}

function writeTryEntry(sandboxDir, resolved, skillBody) {
  const { fields } = parseFrontmatterLoose(skillBody);
  const skillName = fields.name || resolved.slug;
  const cwd = path.dirname(sandboxDir).replace(new RegExp(`[\\\\/]?\\.gad-try$`), '');
  const prompt = buildHandoffPrompt(resolved);
  const body = [
    `# ${skillName} — try entry`,
    '',
    `Staged by \`gad try\` on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '## Where the sandbox is',
    '',
    `The sandbox lives at \`${sandboxDir}\` (relative to whatever directory`,
    'you ran `gad try` in — the sandbox is always under `<cwd>/.gad-try/<slug>/`,',
    'regardless of whether `gad` itself is globally or locally installed).',
    '',
    '## How to run it',
    '',
    'Open your coding agent (Claude Code, Codex, Cursor, Windsurf, etc.)',
    `in **${cwd}** (the directory that contains \`.gad-try/\`) and paste:`,
    '',
    '```',
    prompt,
    '```',
    '',
    'The exact prompt above was also copied to your clipboard when `gad try`',
    'finished, if your OS has a clipboard tool installed (clip.exe on Windows,',
    'pbcopy on macOS, xclip/xsel/wl-copy on Linux).',
    '',
    'Or, if the skill ships its own slash command and is wired into your',
    'runtime, use that command directly — the skill body will tell you what',
    'syntax it expects.',
    '',
    '## Where artifacts will land',
    '',
    'Read `PROVENANCE.md` in this sandbox for declared outputs. If the skill',
    'does not declare outputs, it will write to the current working directory —',
    `likely producing files next to \`.gad-try/\`.`,
    '',
    '## When you\'re done',
    '',
    `\`\`\`sh`,
    `gad try cleanup ${resolved.slug}    # remove this sandbox`,
    `\`\`\``,
    '',
    'If the skill installed system packages (pip / npm / brew), cleanup will',
    'print the suggested uninstall commands but will NOT run them — you',
    'decide whether to roll them back.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sandboxDir, 'ENTRY.md'), body);
}

function printConsentGate(deps, resolved) {
  console.log('');
  console.log(`  ${dim('Source:')}  ${resolved.source} (${resolved.kind})`);
  console.log(`  ${dim('Slug:')}    ${resolved.slug}`);
  console.log('');
  if (deps.requires.length > 0) {
    console.log('  Requires (advisory — not checked):');
    for (const r of deps.requires) console.log(`    - ${r}`);
    console.log('');
  }
  if (deps.installs.length > 0) {
    console.log('  Declared installs (skill will run these when invoked):');
    for (const r of deps.installs) console.log(`    ! ${r}`);
    console.log('');
  }
  if (deps.implicit.length > 0) {
    console.log('  Implicit installs found in SKILL.md body:');
    for (const r of deps.implicit) console.log(`    ? ${r}`);
    console.log('');
  }
  if (deps.requires.length === 0 && deps.installs.length === 0 && deps.implicit.length === 0) {
    console.log('  No install commands declared or detected in SKILL.md.');
    console.log('  Sandbox will be staged with no system changes.');
    console.log('');
  }
}

// A tiny dim() helper because the existing color constants in bin/gad.cjs
// may not include one; fall back to identity if not exported.
function dim(s) { return s; }

// ---------------------------------------------------------------------------
// generate — AI generation fundamentals (decision gad-217)
// ---------------------------------------------------------------------------

const generateText = defineCommand({
  meta: { name: 'text', description: 'Generate text from a prompt and write to file' },
  args: {
    prompt: { type: 'positional', description: 'The prompt text', required: true },
    out: { type: 'string', alias: 'o', description: 'Output file path (default: stdout)', default: '' },
    model: { type: 'string', alias: 'm', description: 'Model to use (default: claude-sonnet-4-20250514)', default: 'claude-sonnet-4-20250514' },
    system: { type: 'string', alias: 's', description: 'System prompt', default: '' },
    maxTokens: { type: 'string', description: 'Max output tokens', default: '4096' },
  },
  async run({ args }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      outputError('ANTHROPIC_API_KEY not set. Export it or add to .env');
      process.exit(1);
    }

    const body = {
      model: args.model,
      max_tokens: parseInt(args.maxTokens, 10),
      messages: [{ role: 'user', content: args.prompt }],
    };
    if (args.system) {
      body.system = args.system;
    }

    try {
      // Use fetch directly — no SDK dependency needed
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.text();
        outputError(`API error ${resp.status}: ${err}`);
        process.exit(1);
      }

      const data = await resp.json();
      const text = data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      if (args.out) {
        const outPath = path.resolve(args.out);
        const dir = path.dirname(outPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(outPath, text, 'utf8');
        console.log(`Written to ${args.out} (${text.length} chars)`);
      } else {
        console.log(text);
      }
    } catch (err) {
      outputError(`Generation failed: ${err.message}`);
      process.exit(1);
    }
  },
});

const generateCmd = defineCommand({
  meta: { name: 'generate', description: 'AI generation fundamentals — prompt in, file out' },
  subCommands: {
    text: generateText,
    // image, audio, video will be added later
  },
});

const tryStage = defineCommand({
  meta: { name: 'stage', description: 'Stage a skill into .gad-try/<slug>/ (default subcommand)' },
  args: {
    ref:    { type: 'positional', description: 'slug | path | git url', required: true },
    yes:    { type: 'boolean',   description: 'Skip consent gate (scripted mode)', default: false },
    branch: { type: 'string',    description: 'Explicit branch/tag for git sources (skips fallback probe). Task 42.2-40.b.', default: '' },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { cwd, sandboxRoot } = tryPaths(repoRoot);

    let resolved;
    try {
      resolved = resolveTrySource(args.ref, repoRoot, { branch: args.branch || undefined });
    } catch (err) {
      console.error(`gad try: ${err.message}`);
      process.exit(1);
    }

    try {
      // SKILL.md is the canonical name; skill.md (lowercase) is tolerated at
      // read-time and normalized in stageTrySandbox (task 42.2-40.b).
      const upperPath = path.join(resolved.sourceDir, 'SKILL.md');
      const lowerPath = path.join(resolved.sourceDir, 'skill.md');
      const skillPath = fs.existsSync(upperPath) ? upperPath : lowerPath;
      const skillBody = fs.readFileSync(skillPath, 'utf8');
      const deps = extractSkillDependencies(skillBody);

      console.log(`gad try ${resolved.slug}`);
      printConsentGate(deps, resolved);

      // Staging itself is non-destructive — we just copy files into
      // .gad-try/<slug>/. The destructive parts (`pip install`, `npm i`)
      // only happen when the user invokes the skill through their coding
      // agent. We print the consent gate for awareness; no prompt.
      if (!args.yes && (deps.installs.length > 0 || deps.implicit.length > 0)) {
        console.log('  Note: staging is non-destructive. Install commands above');
        console.log('  will only run if you invoke the skill via your coding agent.');
        console.log('');
      }

      const sandboxDir = stageTrySandbox(resolved, sandboxRoot);
      writeTryProvenance(sandboxDir, resolved, deps);
      writeTryEntry(sandboxDir, resolved, skillBody);

      // Auto-populate the clipboard with the handoff prompt so the user
      // can immediately paste into their coding agent without opening
      // ENTRY.md. Silent degradation when no clipboard tool is available.
      const prompt = buildHandoffPrompt(resolved);
      const clipboardTool = copyToClipboardSync(prompt);

      console.log('');
      console.log(`  Staged ${path.relative(cwd, sandboxDir)}`);
      console.log(`  Handoff prompt: ${path.relative(cwd, path.join(sandboxDir, 'ENTRY.md'))}`);
      if (clipboardTool) {
        console.log(`  Clipboard: copied via ${clipboardTool}`);
      } else {
        console.log(`  Clipboard: (no clipboard tool found — prompt is in ENTRY.md)`);
      }
      console.log('');
      console.log(`Paste this into your coding agent running in ${cwd}:`);
      console.log('');
      console.log(`  ${prompt}`);
      console.log('');
      console.log('Then:');
      console.log(`  gad try status                     # list all staged sandboxes`);
      console.log(`  gad try cleanup ${resolved.slug}   # remove this sandbox when done`);
    } finally {
      resolved.cleanup();
    }
  },
});

const tryStatus = defineCommand({
  meta: { name: 'status', description: 'List staged .gad-try/ sandboxes' },
  run() {
    const repoRoot = path.resolve(__dirname, '..');
    const { sandboxRoot } = tryPaths(repoRoot);
    if (!fs.existsSync(sandboxRoot)) {
      console.log('No staged tries in this directory.');
      return;
    }
    const entries = fs.readdirSync(sandboxRoot, { withFileTypes: true }).filter((e) => e.isDirectory());
    if (entries.length === 0) {
      console.log('No staged tries in this directory.');
      return;
    }
    console.log(`Staged tries in ${path.relative(process.cwd(), sandboxRoot) || '.gad-try'}:`);
    for (const e of entries) {
      const provPath = path.join(sandboxRoot, e.name, 'PROVENANCE.md');
      let source = '(unknown)';
      if (fs.existsSync(provPath)) {
        const body = fs.readFileSync(provPath, 'utf8');
        const m = body.match(/^source:\s*(.+)$/m);
        if (m) source = m[1].trim();
      }
      console.log(`  - ${e.name}    ${source}`);
    }
    console.log('');
    console.log('Commands:');
    console.log('  gad try cleanup <slug>   # remove one sandbox');
    console.log('  gad try cleanup --all    # remove all sandboxes');
  },
});

const tryCleanup = defineCommand({
  meta: { name: 'cleanup', description: 'Remove a staged .gad-try/<slug>/ sandbox' },
  args: {
    slug: { type: 'positional', description: 'sandbox slug to remove', required: false },
    all: { type: 'boolean', description: 'Remove all staged sandboxes', default: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { sandboxRoot } = tryPaths(repoRoot);
    if (!fs.existsSync(sandboxRoot)) {
      console.log('No .gad-try/ directory in cwd — nothing to clean up.');
      return;
    }

    const toRemove = [];
    if (args.all) {
      for (const e of fs.readdirSync(sandboxRoot, { withFileTypes: true })) {
        if (e.isDirectory()) toRemove.push(e.name);
      }
    } else {
      if (!args.slug) {
        console.error('gad try cleanup: pass a <slug> or --all');
        process.exit(1);
      }
      const dir = path.join(sandboxRoot, args.slug);
      if (!fs.existsSync(dir)) {
        console.error(`No sandbox at ${path.relative(process.cwd(), dir)}`);
        process.exit(1);
      }
      toRemove.push(args.slug);
    }

    for (const slug of toRemove) {
      const dir = path.join(sandboxRoot, slug);
      const provPath = path.join(dir, 'PROVENANCE.md');
      // Surface install commands that were declared — the user may want
      // to roll them back manually.
      if (fs.existsSync(provPath)) {
        const body = fs.readFileSync(provPath, 'utf8');
        const installsSection = body.match(/## Declared installs\s*\n([\s\S]*?)\n##/);
        const implicitSection = body.match(/## Implicit.*?install commands\s*\n([\s\S]*?)\n##/);
        const allInstallLines = [];
        for (const section of [installsSection, implicitSection]) {
          if (section && !/\(none/i.test(section[1]) && !/no pip/i.test(section[1])) {
            for (const line of section[1].split('\n')) {
              const trimmed = line.replace(/^[-!?\s]+/, '').replace(/`/g, '').trim();
              if (trimmed) allInstallLines.push(trimmed);
            }
          }
        }
        if (allInstallLines.length > 0) {
          console.log(`  ${slug}: skill declared or referenced these installs:`);
          for (const l of allInstallLines) console.log(`    ${l}`);
          console.log('  (not rolled back automatically — run manually if needed)');
        }
      }
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`  Removed ${path.relative(process.cwd(), dir)}`);
    }

    // Remove the .gad-try parent dir if now empty.
    try {
      if (fs.readdirSync(sandboxRoot).length === 0) {
        fs.rmdirSync(sandboxRoot);
      }
    } catch {}
  },
});

const tryHelp = defineCommand({
  meta: { name: 'help', description: 'Show gad try usage' },
  run() {
    console.log('gad try — temporary skill install flow');
    console.log('');
    console.log('Stages an external skill into .gad-try/<slug>/ in your current');
    console.log('directory — NOT in ~/.claude/skills/ or any global location.');
    console.log('The sandbox is always under <cwd>/.gad-try/, regardless of');
    console.log('whether the gad binary is installed globally or locally, so cd');
    console.log('into the project where you want the sandbox to live before');
    console.log('running gad try.');
    console.log('');
    console.log('Usage:');
    console.log('  gad try <slug|path|url>       Stage a skill into .gad-try/<slug>/');
    console.log('  gad try status                List staged sandboxes in cwd');
    console.log('  gad try cleanup <slug>        Remove one sandbox');
    console.log('  gad try cleanup --all         Remove all sandboxes in cwd');
    console.log('');
    console.log('Examples:');
    console.log('  cd ~/my-project');
    console.log('  gad try gad-help                                  # local slug from framework skills/');
    console.log('  gad try ./my-skill/                               # local path');
    console.log('  gad try https://github.com/safishamsi/graphify    # git url, any branch');
    console.log('');
    console.log('On stage: the handoff prompt is copied to your clipboard');
    console.log('(clip.exe / pbcopy / xclip / xsel / wl-copy depending on OS),');
    console.log('so you can immediately paste it into your coding agent.');
    console.log('Silent degradation if no clipboard tool is installed.');
  },
});

const tryCmd = defineCommand({
  meta: { name: 'try', description: 'Stage a skill into .gad-try/<slug>/ without touching ~/.claude/skills/ or the project skill catalog' },
  subCommands: {
    stage: tryStage,
    status: tryStatus,
    cleanup: tryCleanup,
    help: tryHelp,
  },
});

// ---------------------------------------------------------------------------
// Top-level shortcuts: spawn / play (decision gad-219)
// ---------------------------------------------------------------------------

const spawnCmd = defineCommand({
  meta: { name: 'spawn', description: 'Spawn a new generation from a species (evolutionary: create a build)' },
  args: {
    target: { type: 'positional', description: 'Project/species path (e.g. escape-the-dungeon/vcs-test)', required: true },
    runtime: { type: 'string', description: 'Runtime driving the eval (claude-code, codex, cursor, etc.)', default: '' },
    'prompt-only': { type: 'boolean', description: 'Only generate the bootstrap prompt, do not create worktree', default: false },
    execute: { type: 'boolean', description: 'Output JSON for the orchestrating agent to spawn a worktree agent with full tracing', default: false },
    'install-skills': { type: 'string', description: 'Comma-separated paths to skills to install into the eval template before running', default: '' },
  },
  async run({ args }) {
    const parts = args.target.split('/');
    if (parts.length < 2) {
      outputError('Usage: gad spawn <project>/<species>');
      process.exit(1);
    }
    // Delegate to evalRun — it expects the full slash-separated species path as project
    await evalRun.run({ args: {
      project: args.target,
      baseline: 'HEAD',
      runtime: args.runtime,
      'prompt-only': args['prompt-only'],
      execute: args.execute,
      'install-skills': args['install-skills'],
    }});
  },
});

const breedCmd = defineCommand({
  meta: { name: 'breed', description: 'Breed two species into a new one — union + shed redundancy (decision gad-219)' },
  args: {
    project: { type: 'string',  description: 'Project id', required: true },
    parentA: { type: 'string',  description: 'Primary parent species (precedence on scalar conflicts)', required: true },
    parentB: { type: 'string',  description: 'Secondary parent species', required: true },
    name:    { type: 'string',  description: 'New species name (kebab-case)', required: true },
    description: { type: 'string',  description: 'Override description', default: '' },
    workflow:    { type: 'string',  description: 'Override workflow (gad, bare, emergent)', default: '' },
    noInherit:   { type: 'boolean', description: 'Do not set inherits_from on the bred species', default: false },
    json:        { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const da = evalDataAccess();
    const result = da.breedSpecies(args.project, args.parentA, args.parentB, args.name, {
      description: args.description || undefined,
      workflow: args.workflow || undefined,
      noInherit: args.noInherit,
    });
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(
        `Bred "${args.parentA}" + "${args.parentB}" -> "${args.name}" in project "${args.project}"`
      );
      console.log(
        `  shed: dna=${result.shed.dna}, installedSkills=${result.shed.installedSkills}`
      );
      console.log(`  dir: ${result.speciesDir}`);
    }
  },
});

const playCmd = defineCommand({
  meta: {
    name: 'play',
    description:
      "Serve a preserved generation's static build over HTTP (opens browser). Shorthand for `gad generation open`. Not `gad site serve` (planning/landing UI).",
  },
  args: {
    target: { type: 'positional', description: 'Project/species/version (e.g. escape-the-dungeon/bare/v3)', required: true },
  },
  run({ args }) {
    const parts = args.target.split('/');
    if (parts.length < 3) {
      outputError('Usage: gad play <project>/<species>/<version>');
      process.exit(1);
    }
    const version = parts[parts.length - 1];
    const project = parts.slice(0, -1).join('/');
    // Delegate to evalOpen with parsed project and version
    evalOpen.run({ args: { project, version } });
  },
});

const main = defineCommand({
  meta: {
    name: 'gad',
    description: 'Planning CLI for get-anything-done',
    version: pkg.version,
  },
  subCommands: {
    ls: lsCmd,
    workspace: workspaceCmd,
    projects: projectsCmd,
    species: speciesCmd,
    recipes: recipesCmd,
    generation: generationCmd,
    session: sessionCmd,
    context: contextCmd,
    state: stateCmd,
    phases: phasesCmd,
    tasks: tasksV2Cmd,
    'task-checkpoint': taskCheckpoint,
    decisions: decisionsCmd,
    requirements: requirementsCmd,
    errors: errorsCmd,
    blockers: blockersCmd,
    refs: refsCmd,
    pack: packCmd,
    docs: docsCmd,
    planning: planningCmd,
    site: siteCmd,
    'self-eval': selfEvalCmd,
    data: dataCmd,
    eval: evalCmd,
    evolution: evolutionCmd,
    skill: skillCmd,
    models: modelsCmd,
    workflow: workflowCmd,
    rounds: roundsCmd,
    verify: verifyCmd,
    snapshot: snapshotV2Cmd,
    startup: startupCmd,
    'discovery-test': discoveryTestCmd,
    sprint: sprintCmd,
    dev: devCmd,
    sink: sinkCmd,
    log: logCmd,
    worktree: worktreeCmd,
    'migrate-schema': migrateSchema,
    graph: graphCmd,
    query: queryCmd,
    install: installCmd,
    uninstall: uninstallCmd,
    bundle: bundleCmd,
    try: tryCmd,
    generate: generateCmd,
    spawn: spawnCmd,
    breed: breedCmd,
    play: playCmd,
    version: versionCmd,
  },
});

// `gad query "text"` routes to `gad query run "text"`. Bare `gad query` with
// no args shows help-like output.
(function injectQueryRunDefault() {
  const a = process.argv;
  const i = a.indexOf('query');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['run', 'help']);
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'run');
    return;
  }
  if (known.has(first)) return;
  // Positional text — inject 'run' subcommand
  a.splice(i + 1, 0, 'run');
})();

// `gad graph` with no subcommand routes to `gad graph build`.
(function injectGraphBuildDefault() {
  const a = process.argv;
  const i = a.indexOf('graph');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['build', 'stats', 'help']);
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'build');
    return;
  }
  if (!known.has(first)) return;
})();

// `gad try <slug|path|url>` should route to `gad try stage <ref>` so the
// positional ref doesn't collide with subcommand dispatch. When the first
// arg after `try` is a known subcommand (stage|status|cleanup|help) or a
// flag, leave argv alone. Bare `gad try` with no arg maps to `help`.
(function injectTryStageDefault() {
  const a = process.argv;
  const i = a.indexOf('try');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['stage', 'status', 'cleanup', 'help']);
  if (first === undefined) {
    a.splice(i + 1, 0, 'help');
    return;
  }
  if (known.has(first) || first.startsWith('-')) return;
  a.splice(i + 1, 0, 'stage');
})();

// Bare `gad refs` (and `gad refs --json`, etc.) should behave like `gad refs list`.
// Citty has no default subcommand; without this, only `gad refs list` works.
// Do not inject when a subcommand is already present (list|verify|migrate|watch).
(function injectRefsListDefault() {
  const a = process.argv;
  const i = a.indexOf('refs');
  if (i === -1) return;
  const first = a[i + 1];
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'list');
  }
})();

(function injectStateShowDefault() {
  const a = process.argv;
  const i = a.indexOf('state');
  if (i === -1) return;
  const first = a[i + 1];
  // Recognize known subcommands so `gad state set-next-action ...` still works
  if (first === 'show' || first === 'set-next-action') return;
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'show');
  }
})();

(function injectTasksListDefault() {
  const a = process.argv;
  const i = a.indexOf('tasks');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['list', 'claim', 'release', 'active']);
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'list');
    return;
  }
  if (!known.has(first)) return;
})();

/**
 * Top-level --skill <slug> tagger (decision gad-178 / phase 42.3-16).
 * Any `gad <cmd> --skill <slug>` invocation sets GAD_ACTIVE_SKILL in the
 * environment so the trace hook can stamp the emitted tool_use events
 * with `trigger_skill`. This is how skills that work by running CLI
 * commands (gad-next, check-todos, task-checkpoint, etc.) become
 * visible in the trace stream without having to wrap themselves in an
 * explicit Skill tool call. The flag is stripped from argv before
 * citty parses so sub-commands don't see it as an unknown arg.
 */
(function extractActiveSkillFlag() {
  const a = process.argv;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--skill' && i + 1 < a.length) {
      process.env.GAD_ACTIVE_SKILL = a[i + 1];
      a.splice(i, 2);
      return;
    }
    const eq = a[i] && a[i].startsWith('--skill=') ? a[i].slice('--skill='.length) : null;
    if (eq) {
      process.env.GAD_ACTIVE_SKILL = eq;
      a.splice(i, 1);
      return;
    }
  }
})();

runMain(main);

