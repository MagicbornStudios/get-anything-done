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
 *   gad docs serve [--projectid <id>] [--docs-path <path>]
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
const { pathToFileURL } = require('url');

const gadConfig = require('./gad-config.cjs');
const { resolveTomlPath } = require('./gad-config.cjs');
const { render, shouldUseJson } = require('../lib/table.cjs');
const { readState } = require('../lib/state-reader.cjs');
const { readTasks } = require('../lib/task-registry-reader.cjs');
const { readPhases, readDocFlow } = require('../lib/roadmap-reader.cjs');
const { writePhase } = require('../lib/roadmap-writer.cjs');
const { readDecisions } = require('../lib/decisions-reader.cjs');
const { writeDecision } = require('../lib/decisions-writer.cjs');
const { writeTodo, listTodos } = require('../lib/todos-writer.cjs');
const { writeNote, listNotes, listNoteQuestions } = require('../lib/notes-writer.cjs');
const {
  compactStateXml,
  compactRoadmapSection,
  compactTasksSection,
} = require('../lib/snapshot-compact.cjs');
const teachings = require('../lib/teachings-reader.cjs');

// Decision gad-259 (2026-04-17): DAILY snapshot section removed.
// After gad-258 moved llm-from-scratch execution into a daily subagent,
// the main-session snapshot no longer needs to surface the tip or the
// learning-project next-action. The subagent consumes them directly and
// returns a brief operator-facing report. `gad tip` remains on demand.
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
const { detectRuntimeIdentity, detectRuntimeSessionId } = require('../lib/runtime-detect.cjs');
const { getLastActiveProjectid, setLastActiveProjectid } = require('../lib/user-settings.cjs');
const {
  lintAllSkills,
  lintSkill,
  summarizeLint,
  parseFrontmatter: parseSkillFrontmatter,
  auditSkillTokens,
  extractBodyRefs,
} = require('../lib/skill-linter.cjs');
const {
  collectAttributions,
  buildUsageReport,
  discoverSkillIds,
  SENTINEL_SKILL_VALUES,
} = require('../lib/skill-usage-stats.cjs');

// Sweep E (2026-04-19): graph-extractor used by both state.show (factory dep,
// resolved at module-load time) and the inline graph commands defined later
// in this file. Hoisted to top imports so factory invocations don't see it
// as undefined. Original location preserved as a comment marker for grep.
const graphExtractor = require('../lib/graph-extractor.cjs');

// Sweep E (2026-04-19, opus-claude): extracted command families. Pattern is
// factory-receives-deps so we don't have to extract `resolveRoots` (and its
// transitive `getActiveSessionProjectId` / `loadSessions` chain) yet. Future
// sweeps move shared helpers into lib/cli-helpers.cjs and convert these to
// direct requires.
const { createStateCommand } = require('./commands/state.cjs');
const { createNoteCommand } = require('./commands/note.cjs');
const { createTodosCommand } = require('./commands/todos.cjs');
const { createPhasesCommand } = require('./commands/phases.cjs');
const { createDecisionsCommand } = require('./commands/decisions.cjs');
const { createHandoffsCommand } = require('./commands/handoffs.cjs');
const {
  createRequirementsCommand,
  createErrorsCommand,
  createBlockersCommand,
} = require('./commands/readers.cjs');
const { createRefsCommand } = require('./commands/refs.cjs');
const { createNarrativeCommand } = require('./commands/narrative.cjs');
const { createStartCommand } = require('./commands/start.cjs');
const { createSubagentsCommand } = require('./commands/subagents.cjs');
const { createAgentsCommand } = require('./commands/agents.cjs');
const { createSiteCommand } = require('./commands/site.cjs');

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

const RAW_ARGV = process.argv.slice();
const NO_SIDE_EFFECTS_FLAG = '--no-side-effects';
const NO_SIDE_EFFECTS_MARKER = '.gad-release-build';

function readRawFlagValue(flagName, argv = RAW_ARGV) {
  const inline = argv.find((arg) => String(arg).startsWith(`${flagName}=`));
  if (inline) return String(inline).slice(flagName.length + 1);
  const idx = argv.indexOf(flagName);
  if (idx === -1 || idx + 1 >= argv.length) return '';
  const value = argv[idx + 1];
  if (!value || String(value).startsWith('--')) return '';
  return String(value);
}

function hasRawFlag(flagName, argv = RAW_ARGV) {
  return argv.includes(flagName) || argv.some((arg) => String(arg).startsWith(`${flagName}=`));
}

function envFlagEnabled(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return !['0', 'false', 'no', 'off'].includes(normalized);
}

let _sideEffectsModeCache = null;

function resolveSideEffectsMode() {
  if (_sideEffectsModeCache) return _sideEffectsModeCache;
  const reasons = [];
  if (hasRawFlag(NO_SIDE_EFFECTS_FLAG)) reasons.push('flag');
  if (envFlagEnabled(process.env.GAD_NO_SIDE_EFFECTS)) reasons.push('env:GAD_NO_SIDE_EFFECTS');
  if (envFlagEnabled(process.env.GAD_RELEASE_BUILD)) reasons.push('env:GAD_RELEASE_BUILD');
  if (envFlagEnabled(process.env.GAD_NO_SIDE_EFFECTS_ACTIVE)) reasons.push('env:GAD_NO_SIDE_EFFECTS_ACTIVE');
  try {
    const repoRoot = findRepoRoot();
    if (repoRoot && fs.existsSync(path.join(repoRoot, NO_SIDE_EFFECTS_MARKER))) {
      reasons.push(`marker:${NO_SIDE_EFFECTS_MARKER}`);
    }
  } catch { /* non-fatal */ }
  _sideEffectsModeCache = { enabled: reasons.length > 0, reasons };
  return _sideEffectsModeCache;
}

function sideEffectsSuppressed() {
  return resolveSideEffectsMode().enabled;
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
let _logCmd = RAW_ARGV.slice(2).join(' ');

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
  if (sideEffectsSuppressed()) return null;
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
    args: overrides.args || RAW_ARGV.slice(2),
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
    // Walk up from the target project path, not from the CLI's cwd. When
    // the operator runs `gad projects init` while cd'd inside a submodule
    // (e.g. vendor/get-anything-done/), walking from cwd stops at the
    // submodule's own gad-config.toml and pollutes it instead of the
    // workspace config that actually owns the new project (task 44-13).
    const projectPath = path.resolve(args.path || process.cwd());
    const baseDir = findRepoRoot(projectPath);
    const config = gadConfig.load(baseDir);
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

    // Register in config if not already present. Normalize the stored
    // path to forward slashes so Windows runs don't produce
    // `..\..\projects\project-editor` entries (task 44-13 second bug).
    const relPath = normalizePath(path.relative(baseDir, projectPath) || '.');
    if (!config.roots.find(r => normalizePath(r.path) === relPath)) {
      config.roots.push({ id: projectId, path: relPath, planningDir: '.planning', discover: false });
      writeRootsToToml(baseDir, config.roots, config);
      console.log(`  Registered as [${projectId}] at path "${relPath}" in ${path.join(baseDir, 'gad-config.toml')}`);
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

// species: bin/commands/species.cjs
const { createSpeciesCommand } = require('./commands/species.cjs');
const speciesCmd = createSpeciesCommand({ evalDataAccess });

// recipes: bin/commands/recipes.cjs
const { createRecipesCommand } = require('./commands/recipes.cjs');
const recipesCmd = createRecipesCommand({ evalDataAccess });

// ---------------------------------------------------------------------------
// gad generation salvage — extract reusable data from completed generation runs
// (decision gad-210: project assets convention)
// ---------------------------------------------------------------------------

// generation (salvage etc.): bin/commands/generation.cjs
const { createGenerationCommands } = require('./commands/generation.cjs');
const { generationSalvage, generationCmd } = createGenerationCommands({ outputError, evalDataAccess });

// ---------------------------------------------------------------------------
// state command  (extracted to bin/commands/state.cjs in sweep E)
// ---------------------------------------------------------------------------

const stateCmd = createStateCommand({
  findRepoRoot, gadConfig, resolveRoots, outputError,
  render, shouldUseJson, readState,
  graphExtractor, maybeRebuildGraph,
});

// ---------------------------------------------------------------------------
// phases command  (extracted to bin/commands/phases.cjs in sweep E/F)
// ---------------------------------------------------------------------------

const phasesCmd = createPhasesCommand({
  findRepoRoot, gadConfig, resolveRoots, outputError,
  render, shouldUseJson, readPhases, writePhase, maybeRebuildGraph,
});

// ---------------------------------------------------------------------------
// decisions command  (extracted to bin/commands/decisions.cjs in sweep E/F)
// ---------------------------------------------------------------------------

const decisionsCmd = createDecisionsCommand({
  findRepoRoot, gadConfig, resolveRoots, outputError,
  render, shouldUseJson, readDecisions, writeDecision,
  formatId, maybeRebuildGraph,
});

// ---------------------------------------------------------------------------
// handoffs command  (extracted to bin/commands/handoffs.cjs in sweep E/F)
// NOTE: buildHandoffsSection / printSection / resolveDetectedRuntimeId
// stay below — used by snapshot/sprint/pause-work/startup code paths.
// ---------------------------------------------------------------------------

const {
  listHandoffs,
  countHandoffs,
  createHandoff,
} = require('../lib/handoffs.cjs');

const handoffsCmd = createHandoffsCommand({
  findRepoRoot, outputError, render, shouldUseJson, detectRuntimeIdentity,
});

function resolveDetectedRuntimeId() {
  const detected = detectRuntimeIdentity();
  if (detected.id && detected.id !== 'unknown') return detected.id;
  const fallback = String(process.env.GAD_AGENT || '').trim();
  return fallback || 'unknown';
}

function buildHandoffsSection({ baseDir, projectid, runtime, mineFirst = false, limit = 5 } = {}) {
  const total = countHandoffs({ baseDir, bucket: 'open', projectid, runtime });
  if (total <= 0) return null;
  const handoffs = listHandoffs({ baseDir, bucket: 'open', projectid, mineFirst, runtime });
  const visible = handoffs.slice(0, limit);
  const rows = visible.map((handoff) => ({
    id: handoff.id,
    phase: handoff.frontmatter.phase || '',
    priority: handoff.frontmatter.priority || '',
    context: handoff.frontmatter.estimated_context || '',
    runtime: handoff.frontmatter.runtime_preference || '',
  }));
  let content = render(rows, { format: 'table', headers: ['id', 'phase', 'priority', 'context', 'runtime'] });
  if (total > visible.length) {
    content += `\n+${total - visible.length} more`;
  }
  const runtimeMatches = runtime && runtime !== 'unknown'
    ? handoffs.filter((handoff) => handoff.frontmatter.runtime_preference === runtime)
    : [];
  if (runtimeMatches.length === 1) {
    content += `\nAuto-claim candidate: ${runtimeMatches[0].id} - run: gad handoffs claim ${runtimeMatches[0].id}`;
  }
  return {
    title: `HANDOFFS (${total} unclaimed)`,
    content,
    total,
    autoClaimId: runtimeMatches.length === 1 ? runtimeMatches[0].id : null,
  };
}

function printSection(section) {
  console.log(`-- ${section.title} ${'-'.repeat(Math.max(0, 60 - section.title.length))}`);
  console.log(section.content);
  console.log('');
}
// ---------------------------------------------------------------------------
// todos command  (extracted to bin/commands/todos.cjs in sweep E)
// ---------------------------------------------------------------------------

const todosCmd = createTodosCommand({
  findRepoRoot, gadConfig, resolveRoots, outputError,
  render, shouldUseJson, listTodos, writeTodo,
});

// ---------------------------------------------------------------------------
// note command  (extracted to bin/commands/note.cjs in sweep E)
// ---------------------------------------------------------------------------

const noteCmd = createNoteCommand({
  findRepoRoot, gadConfig, resolveRoots, outputError,
  writeNote, listNotes, listNoteQuestions,
});

// env: bin/commands/env.cjs (BYOK secrets per project)
const { createEnvCommand } = require('./commands/env.cjs');
const envCmd = createEnvCommand();


// ---------------------------------------------------------------------------
// runtime command namespace (GAD-native wrapper over runtime substrate)
// ---------------------------------------------------------------------------

// runtime: bin/commands/runtime.cjs (lazy init below — deps SESSION_STATUS, loadSessions, buildContextRefs defined later)
const { createRuntimeCommand, getRuntimeArg } = require('./commands/runtime.cjs');
let runtimeCmd; // assigned later, after helpers exist

// ---------------------------------------------------------------------------
// requirements / errors / blockers commands  (extracted to bin/commands/readers.cjs)
// ---------------------------------------------------------------------------

const requirementsCmd = createRequirementsCommand({
  findRepoRoot, gadConfig, resolveRoots,
  render, shouldUseJson, readRequirements, readDocFlow,
});

const errorsCmd = createErrorsCommand({
  findRepoRoot, gadConfig, resolveRoots,
  render, shouldUseJson, readErrors,
});

const blockersCmd = createBlockersCommand({
  findRepoRoot, gadConfig, resolveRoots,
  render, shouldUseJson, readBlockers,
});

// ---------------------------------------------------------------------------
// refs command  (extracted to bin/commands/refs.cjs in sweep F)
// ---------------------------------------------------------------------------

const refsCmd = createRefsCommand({
  findRepoRoot, gadConfig, resolveRoots,
  render, shouldUseJson,
  readDecisions, readRequirements, readPhases, readDocFlow, readDocsMap,
  planningRefVerify, outputError,
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

// docs: bin/commands/docs.cjs
const { createDocsCommand } = require("./commands/docs.cjs");
const docsCmd = createDocsCommand({ findRepoRoot, gadConfig, resolveRoots, outputError, compileDocs, readDocsMap, render, shouldUseJson });


// ---------------------------------------------------------------------------
// planning subcommands — MD → XML hydration (task 42.4-17, audit ref
// references/sink-md-xml-audit.md §6). Inverse of `gad docs compile`:
// consumes FOO.md in a source dir and writes FOO.xml into the project's
// .planning/ dir for each canonical slot.
// ---------------------------------------------------------------------------

// planning: bin/commands/planning.cjs
const { createPlanningCommand } = require("./commands/planning.cjs");
const planningCmd = createPlanningCommand({ findRepoRoot, gadConfig, resolveRoots, outputError });


// ---------------------------------------------------------------------------
// narrative command  (extracted to bin/commands/narrative.cjs in sweep F)
// ---------------------------------------------------------------------------

const narrativeCmd = createNarrativeCommand();

// ---------------------------------------------------------------------------
// start / dashboard command  (extracted to bin/commands/start.cjs)
// ---------------------------------------------------------------------------

const startCmd = createStartCommand({ findRepoRoot, outputError });

// ---------------------------------------------------------------------------
// subagents command  (extracted to bin/commands/subagents.cjs)
// ---------------------------------------------------------------------------

const subagentsCmd = createSubagentsCommand({ findRepoRoot, outputError, render });

// ---------------------------------------------------------------------------
// agents command  (extracted to bin/commands/agents.cjs)
// ---------------------------------------------------------------------------

const agentsCmd = createAgentsCommand({
  findRepoRoot, render, detectRuntimeIdentity, detectRuntimeSessionId, listHandoffs,
});

// ---------------------------------------------------------------------------
// site command  (extracted to bin/commands/site.cjs)
// ---------------------------------------------------------------------------

const siteCmd = createSiteCommand({ outputError });

// ---------------------------------------------------------------------------
// eval subcommands
// ---------------------------------------------------------------------------

// eval list/score/diff/status/runs/show/scores/version: bin/commands/eval-info.cjs
const { createEvalInfoCommands } = require('./commands/eval-info.cjs');
const { evalList, evalScore, evalDiff, evalStatus, evalRuns, evalShow, evalScores, evalVersion } = createEvalInfoCommands({
  listAllEvalProjects, listEvalProjectsHint, resolveOrDefaultEvalProjectDir,
  outputError, output, evalDataAccess, loadEvalProject, loadAllResolvedSpecies,
  findRepoRoot, gadConfig, pkg,
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

function parseProjectSpeciesRef(value) {
  const raw = String(value || '').trim();
  if (!raw) return { project: '', species: '', projectRef: '' };
  const parts = raw.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return {
      project: parts[0],
      species: parts[1],
      projectRef: `${parts[0]}/${parts[1]}`,
    };
  }
  return { project: raw, species: '', projectRef: raw };
}

function normalizeGenerationReference(projectArg, speciesArg, versionArg) {
  const parsed = parseProjectSpeciesRef(projectArg);
  let species = String(speciesArg || '').trim();
  let version = String(versionArg || '').trim();
  if (!version && /^v\d+$/i.test(species)) {
    version = species;
    species = '';
  }
  if (!parsed.species && species) {
    parsed.species = species;
    parsed.projectRef = `${parsed.project}/${species}`;
  }
  return {
    project: parsed.project,
    species: parsed.species,
    projectRef: parsed.projectRef,
    version,
  };
}

function formatGenerationPreserveCommand(projectRef, version) {
  const parsed = parseProjectSpeciesRef(projectRef);
  if (parsed.species) return `gad generation preserve ${parsed.project} ${parsed.species} ${version}`;
  return `gad generation preserve ${parsed.project} ${version}`;
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

// eval run: bin/commands/eval-run.cjs
const { createEvalRunCommand } = require('./commands/eval-run.cjs');
const { evalRun } = createEvalRunCommand({
  listEvalProjectsHint, resolveEvalProject, outputError, normalizeEvalRuntime,
  ensureEvalRuntimeHooks, buildEvalPrompt, summarizeAgentLineage,
  buildSkillsProvenance, formatGenerationPreserveCommand,
});

// eval trace: bin/commands/eval-trace.cjs
const { createEvalTraceCommand } = require('./commands/eval-trace.cjs');
const { evalTraceCmd } = createEvalTraceCommand({
  listAllEvalProjects, listEvalProjectsHint, resolveOrDefaultEvalProjectDir,
  outputError, output, shouldUseJson, summarizeAgentLineage, detectRuntimeIdentity,
  readXmlFile, findRepoRoot, pkg,
});


// eval status — projects with coverage gaps
// eval setup/suite/report/readme/inherit-skills: bin/commands/eval-suite.cjs
const { createEvalSuiteCommands } = require('./commands/eval-suite.cjs');
const { evalSetup, evalSuite, evalReport, evalReadme, evalInheritSkills } = createEvalSuiteCommands({
  resolveOrDefaultEvalProjectDir, listAllEvalProjects, defaultEvalsDir,
  outputError, output, buildEvalPrompt, loadEvalProject, loadAllResolvedSpecies,
});

// eval preserve/verify: bin/commands/eval-artifacts.cjs
const { createEvalArtifactsCommands } = require('./commands/eval-artifacts.cjs');
const { evalPreserve, evalVerify } = createEvalArtifactsCommands({
  findRepoRoot, normalizeGenerationReference, resolveOrDefaultEvalProjectDir,
  outputError, parseTraceEventsJsonl, summarizeAgentLineage,
  listAllEvalProjects, defaultEvalsDir,
});

// eval-preview (servePreservedGenerationBuildArtifact + open + review): bin/commands/eval-preview.cjs
const { createEvalPreviewSurfaces } = require('./commands/eval-preview.cjs');
const { servePreservedGenerationBuildArtifact, evalOpen, evalReview } = createEvalPreviewSurfaces({
  resolveOrDefaultEvalProjectDir, outputError, findRepoRoot, loadAllResolvedSpecies,
});

// eval skill: bin/commands/eval-skill.cjs
const { createEvalSkillCommands } = require('./commands/eval-skill.cjs');
const { evalSkillCmd } = createEvalSkillCommands({ outputError });

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

// session/context/pause-work + their helpers: bin/commands/session.cjs
const { createSessionCommands } = require('./commands/session.cjs');
const _sessionMod = createSessionCommands({
  findRepoRoot, gadConfig, resolveRoots, readState, readTasks,
  render, output, outputError, shouldUseJson, sideEffectsSuppressed,
  createHandoff, resolveDetectedRuntimeId,
  getLastActiveProjectid, setLastActiveProjectid,
});
const sessionCmd = _sessionMod.sessionCmd;
const pauseWorkCmd = _sessionMod.pauseWorkCmd;
const contextCmd = _sessionMod.contextCmd;
const { SESSION_STATUS, loadSessions, buildContextRefs } = _sessionMod.helpers;
const { writeSession } = require('./commands/session.cjs');

// runtime: init now that session helpers exist (declared as `let` earlier)
runtimeCmd = createRuntimeCommand({
  findRepoRoot, gadConfig, resolveRoots, loadSessions, SESSION_STATUS,
  readState, buildContextRefs, output, outputError, shouldUseJson,
});

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

const snapshotCmd = defineCommand({
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
    sessionid: { type: 'string', description: 'Session ID alias for --session (runtime command compatibility).', default: '' },
    format: { type: 'string', description: 'compact (default) | xml — "compact" strips XML envelope tokens (prolog, outer tags, per-item tag pairs) while preserving content. "xml" dumps raw file content (legacy). Decision gad-241.', default: 'compact' },
    'no-side-effects': { type: 'boolean', description: 'Read-only snapshot: suppress session/lane/log/graph writes.', default: false },
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
    const readOnlySnapshot = sideEffectsSuppressed();

    // Auto-rebuild graph cache if stale or missing (post-2026-04-19 model:
    // .planning/graph.{json,html} are gitignored, regenerated on demand).
    // Closes 63-graph-task-stale at the snapshot read point. Silent unless
    // a rebuild happened, then a single stderr info line.
    if (!readOnlySnapshot) {
      const r = ensureGraphFresh(baseDir, root);
      if (r.rebuilt) console.error(`[snapshot] graph cache rebuilt (${r.reason})`);
    }

    // Session-aware mode resolution: auto-downgrade to active when session
    // has already received static context, unless --mode was explicitly passed.
    const sessionId = (args.sessionid || args.session || process.env.GAD_SESSION_ID || '').trim();
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
    if (!readOnlySnapshot && shouldAutoRegister && runtimeIdentity.id !== 'unknown') {
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

    if (!readOnlySnapshot && currentAgent) {
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
      const RECENT_CAP = 15; // last N one-liners; older are summarized as a count
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
      // Title-only for all, including core. Core bodies (gad-04/17/18) are
      // duplicated in CLAUDE.md/AGENTS.md — inlining them here wasted ~500
      // tokens per snapshot. Mark core with ★ for emphasis.
      const nonCore = all.filter((d) => !ALWAYS_INCLUDE.includes(d.id));
      const recent = nonCore.slice(-RECENT_CAP);
      const olderCount = nonCore.length - recent.length;
      const coreLines = all
        .filter((d) => ALWAYS_INCLUDE.includes(d.id))
        .map((d) => `★ ${d.id}: ${d.title.slice(0, 96)}`);
      const recentLines = recent.map((d) => `  ${d.id}: ${d.title.slice(0, 96)}`);
      const sections = [];
      if (coreLines.length) sections.push(coreLines.join('\n'));
      if (olderCount > 0) sections.push(`(+${olderCount} older decisions omitted; \`gad decisions list\` or \`gad decisions show <id>\`)`);
      if (recentLines.length) sections.push(recentLines.join('\n'));
      return {
        title: `DECISIONS (${totalDec} total, ★=core loop — see CLAUDE.md; last ${recent.length} shown, full body via \`gad decisions show <id>\`)`,
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

    const compactFmt = (args.format || 'compact').toLowerCase() !== 'xml';

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
      if (stateXml) {
        const stateContent = compactFmt ? compactStateXml(stateXml) : stateXml.trim();
        sections.push({ title: 'STATE', content: stateContent });
      }
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
      const scopedHandoffsSection = buildHandoffsSection({
        baseDir,
        projectid: root.id,
        runtime: resolveDetectedRuntimeId(),
      });
      if (scopedHandoffsSection) sections.push(scopedHandoffsSection);
      const scopedEvolutionSection = buildEvolutionSection(root, baseDir);
      if (scopedEvolutionSection) sections.push(scopedEvolutionSection);
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
    const useCompact = compactFmt;
    if (stateXml) {
      const stateContent = useCompact ? compactStateXml(stateXml) : stateXml.trim();
      sections.push({ title: 'STATE', content: stateContent });
    }

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
    const roadmapContent = useCompact ? compactRoadmapSection(roadmapSection.trim()) : roadmapSection.trim();
    sections.push({ title: `ROADMAP (sprint ${k}, phases ${sprintPhaseIds.join(',')})`, content: roadmapContent });

    // Graph-backed task listing for sprint snapshot (decision gad-201, gad-202)
    // Filters out cancelled (permanent history, not actionable) and scopes
    // to current-sprint phases by default (decision: snapshot bloat audit,
    // 2026-04-18). Out-of-sprint open tasks are counted but not listed —
    // `gad tasks --projectid <id>` shows the full set on demand.
    const sprintPhaseIdSet = new Set(sprintPhaseIds.map(String));
    const isSprintPhase = (phaseId) => sprintPhaseIdSet.has(String(phaseId));
    const sprintUseGraph = graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path));
    let sprintOpenTasks, sprintTasksSection = '', sprintDoneCount;
    let outOfSprintOpenCount = 0;
    if (sprintUseGraph) {
      // Task 63-graph-task-stale: invalidate on TASK-REGISTRY.xml mtime,
      // honouring readOnlySnapshot so concurrent agents don't race on
      // the file write. When read-only and the cache is missing/stale,
      // the helper still returns a freshly-built graph in memory.
      const gadDir = path.resolve(__dirname, '..');
      const { graph: sprintGraph } = graphExtractor.loadOrBuildGraph(root, baseDir, {
        gadDir,
        readOnly: readOnlySnapshot,
      });
      if (sprintGraph) {
        const sprintAllResult = graphExtractor.queryGraph(sprintGraph, { type: 'task' });
        const sprintAllMatches = sprintAllResult.matches || [];
        const sprintOpenMatches = sprintAllMatches.filter(m => m.status !== 'done' && m.status !== 'cancelled');
        sprintDoneCount = sprintAllMatches.filter(m => m.status === 'done').length;
        const inSprintOpenMatches = sprintOpenMatches.filter(m => {
          const taskPhase = m.id.replace(/^task:/, '').split('-')[0];
          return isSprintPhase(taskPhase);
        });
        outOfSprintOpenCount = sprintOpenMatches.length - inSprintOpenMatches.length;
        if (inSprintOpenMatches.length > 0) {
          let currentTaskPhase = '';
          for (const m of inSprintOpenMatches) {
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
        sprintOpenTasks = inSprintOpenMatches;
      } else {
        sprintDoneCount = allTasks.filter(t => t.status === 'done').length;
        sprintOpenTasks = [];
      }
    } else {
      const allOpenTasks = allTasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled');
      const inSprintOpenTasks = allOpenTasks.filter((task) => {
        const taskPhase = task.id ? task.id.split('-')[0] : '';
        return isSprintPhase(taskPhase);
      });
      outOfSprintOpenCount = allOpenTasks.length - inSprintOpenTasks.length;
      sprintOpenTasks = inSprintOpenTasks;
      if (inSprintOpenTasks.length > 0) {
        let currentTaskPhase = '';
        for (const task of inSprintOpenTasks) {
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
      sprintDoneCount = allTasks.filter(t => t.status === 'done').length;
    }
    if (outOfSprintOpenCount > 0) {
      sprintTasksSection += `\n(+${outOfSprintOpenCount} open out-of-sprint — see \`gad tasks --projectid ${root.id}\`)\n`;
    }
    const tasksContent = (() => {
      const raw = sprintTasksSection.trim() || '(no open sprint tasks)';
      return useCompact ? compactTasksSection(raw) : raw;
    })();
    const tasksTitle = outOfSprintOpenCount > 0
      ? `TASKS (${sprintOpenTasks.length} sprint, +${outOfSprintOpenCount} out-of-sprint, ${sprintDoneCount} done)`
      : `TASKS (${sprintOpenTasks.length} open, ${sprintDoneCount} done)`;
    sections.push({ title: tasksTitle, content: tasksContent });
    const sprintHandoffsSection = buildHandoffsSection({
      baseDir,
      projectid: root.id,
      runtime: resolveDetectedRuntimeId(),
    });
    if (sprintHandoffsSection) sections.push(sprintHandoffsSection);
    const sprintEvolutionSection = buildEvolutionSection(root, baseDir);
    if (sprintEvolutionSection) sections.push(sprintEvolutionSection);

    // Decision gad-259 (2026-04-17): DAILY section retired. See function-site
    // comment above where buildDailySection used to live.

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

      // Graph stats section (decision gad-201, freshness via 63-graph-task-stale)
      if (graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path))) {
        const gadDir = path.resolve(__dirname, '..');
        const { graph } = graphExtractor.loadOrBuildGraph(root, baseDir, {
          gadDir,
          readOnly: readOnlySnapshot,
        });
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
    if (snapshotSession && !readOnlySnapshot) {
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
      // Graph-backed task listing — 63-graph-task-stale: pick up
      // hand-edited TASK-REGISTRY.xml entries by checking source mtimes
      // before trusting the on-disk cache.
      const gadDir = path.resolve(__dirname, '..');
      const { graph } = graphExtractor.loadOrBuildGraph(root, baseDir, { gadDir });
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

  // Stall heuristic: in-progress task with no attribution (agent / skill /
  // runtime). "Truly active" work carries attribution; rows that don't are
  // stalled carryovers. Cheap first pass — no git calls. Can refine later.
  let filteredRows = rows;
  if (args.stalled) {
    filteredRows = rows.filter((r) => {
      const attributed = Boolean(
        (r['agent-id'] && String(r['agent-id']).trim()) ||
        (r['agent-role'] && String(r['agent-role']).trim()) ||
        (r.runtime && String(r.runtime).trim()),
      );
      return r.status === 'in-progress' && !attributed;
    });
  }

  if (filteredRows.length === 0) {
    console.log(args.stalled ? 'No stalled tasks.' : 'No tasks found.');
    return;
  }

  const fmt = args.json ? 'json' : 'table';
  const modeLabel = useGraph ? ' (graph)' : '';
  const stalledLabel = args.stalled ? ' stalled' : '';
  console.log(render(filteredRows, { format: fmt, title: `Tasks${stalledLabel}${modeLabel} (${filteredRows.length})` }));
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

// tasks: bin/commands/tasks.cjs
const { createTasksCommand } = require("./commands/tasks.cjs");
const tasksCmd = createTasksCommand({ outputError, resolveSingleTaskRoot, readTasks, resolveSnapshotAgentInputs, resolveSnapshotRuntime, ensureAgentLane, detectRuntimeSessionId, claimTask, addTaskClaim, nowIso, maybeRebuildGraph, shouldUseJson, releaseTask, removeTaskClaim, RAW_ARGV, getRuntimeArg, readRawFlagValue, SENTINEL_SKILL_VALUES, findRepoRoot, gadConfig, resolveRoots, listAgentLanes, simplifyAgentLane, render, runTasksListView });


// migrate-schema (XML→MD): bin/commands/migrate-schema.cjs
const { createMigrateSchemaCommand } = require('./commands/migrate-schema.cjs');
const migrateSchema = createMigrateSchemaCommand({ findRepoRoot });

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

// getSink moved to bin/commands/sink.cjs

// SINK_SOURCE_MAP and getSink moved to bin/commands/sink.cjs

// pack: bin/commands/pack.cjs
const { createPackCommand } = require('./commands/pack.cjs');
const packCmd = createPackCommand({
  findRepoRoot, gadConfig, resolveRoots, outputError,
  readState, readPhases, readTasks, readDecisions, readRequirements,
  readErrors, readBlockers, readDocsMap,
});

// sink: bin/commands/sink.cjs
const { createSinkCommand } = require('./commands/sink.cjs');
const sinkCmd = createSinkCommand({
  findRepoRoot, gadConfig, resolveRoots, outputError, output, stampSinkCompileNote,
});

// ---------------------------------------------------------------------------
// Root command
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// verify, sprint, dev, log — moved to bin/commands/{verify,sprint,dev,log}.cjs
// ---------------------------------------------------------------------------

const { createVerifyCommand } = require('./commands/verify.cjs');
const verifyCmd = createVerifyCommand({ findRepoRoot, gadConfig, resolveRoots, outputError, readPhases, readXmlFile, readTasks });

const { createSprintCommand, getSprintPhaseIds, getCurrentSprintIndex } = require('./commands/sprint.cjs');
const sprintCmd = createSprintCommand({ findRepoRoot, gadConfig, resolveRoots, readPhases, readTasks, readXmlFile, shouldUseJson });

const { createDevCommand } = require('./commands/dev.cjs');
const devCmd = createDevCommand({ findRepoRoot });

const { createLogCommand } = require('./commands/log.cjs');
const logCmd = createLogCommand({ getLogDir, resolveOrDefaultEvalProjectDir });

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
  const worktrees = listAllWorktrees();
  return worktrees.filter(w => w.path.includes(partial) || (w.branch && w.branch.includes(partial)));
}

// Scan known on-disk locations for agent worktrees that may not be
// registered with `git worktree`. Closes the gap behind 63-health-cli:
// `.claude/worktrees/agent-*` directories left behind by crashed runtimes
// never show up in `git worktree list --porcelain`, so the operator
// cannot see (or prune) them via `gad worktree`.
function discoverOnDiskAgentWorktrees(repoRoot) {
  const root = repoRoot || (typeof findRepoRoot === 'function' ? findRepoRoot() : process.cwd());
  if (!root) return [];
  const dirs = [
    path.join(root, '.claude', 'worktrees'),
    path.join(root, '.codex', 'worktrees'),
    path.join(root, '.cursor', 'worktrees'),
  ];
  const out = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!/^agent[-_]/i.test(entry.name)) continue;
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

// Merge git-registered worktrees with on-disk agent worktree dirs that
// git does not know about. Unregistered entries get { unregistered: true }
// so renderers + prune can flag them distinctly from the orphan/prunable
// states that git itself reports.
function listAllWorktrees(repoRoot) {
  const registered = listGitWorktrees();
  const known = new Set(
    registered.map(w => path.resolve(w.path).toLowerCase()),
  );
  const onDisk = discoverOnDiskAgentWorktrees(repoRoot);
  for (const dir of onDisk) {
    const key = path.resolve(dir).toLowerCase();
    if (known.has(key)) continue;
    registered.push({ path: dir, unregistered: true });
    known.add(key);
  }
  return registered;
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
  info.isStale = Boolean(worktree.prunable) || info.isOrphaned || Boolean(worktree.unregistered);
  // Is this an agent worktree?
  const wp = String(worktree.path || '');
  info.isAgent = /[\\/](?:\.claude|\.codex|\.cursor)[\\/]worktrees[\\/]agent[-_]/i.test(wp);
  if (worktree.unregistered) info.isAgent = info.isAgent || true;
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

// worktree: bin/commands/worktree.cjs (factory replaces inline definitions)
const { createWorktreeCommand: __createWorktreeCommand } = require('./commands/worktree.cjs');


const worktreeCmd = __createWorktreeCommand({
  outputError, listAllWorktrees, worktreeInfo, findWorktreeByPartial, listAllEvalProjects,
});

// health: bin/commands/health.cjs (factory replaces helpers + 4 inline cmds)
const { createHealthCommand } = require("./commands/health.cjs");
const healthCmd = createHealthCommand({ findRepoRoot, outputError, listAllWorktrees, worktreeInfo });


// ---------------------------------------------------------------------------
// gad version — framework version info for trace stamping (phase 25 task 25-12)
// ---------------------------------------------------------------------------

const { getFrameworkVersion } = require('../lib/framework-version.cjs');

// discovery-test: bin/commands/discovery-test.cjs
const { createDiscoveryTestCommand } = require('./commands/discovery-test.cjs');
const discoveryTestCmd = createDiscoveryTestCommand();


// startup + self wiring is deferred to after isPackagedExecutableRuntime /
// getPackagedExecutablePath / getDefaultSelfInstallDir helpers are defined
// (those live just below the install/hook block).

/**
 * Check if today's tip file exists; if not and OPENAI_API_KEY is set, fire the
 * generator. Silent on skip (key missing) or success. Errors print to stderr
 * but don't block startup.
 */
function maybeGenerateDailyTip() {
  const today = teachings.isoDate();
  const [Y, M, D] = today.split('-');
  const teachingsDir = teachings.TEACHINGS_DIR;
  const todayFile = path.join(teachingsDir, 'generated', Y, M, `${D}.md`);
  if (fs.existsSync(todayFile)) return;
  if (!process.env.OPENAI_API_KEY) return;
  const scriptPath = path.join(__dirname, '..', 'scripts', 'generate-daily-tip.mjs');
  if (!fs.existsSync(scriptPath)) return;
  console.log(`[daily tip] generating today's teaching (${today}) ...`);
  const result = require('child_process').spawnSync(process.execPath, [scriptPath], {
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`[daily tip] generation failed (exit ${result.status}) — continuing without.`);
  }
  console.log('');
}

// version: bin/commands/version.cjs
const { createVersionCommand } = require('./commands/version.cjs');
const versionCmd = createVersionCommand({ getFrameworkVersion });

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

// startup: bin/commands/startup.cjs (must come after getDefaultSelfInstallDir)
const { createStartupCommand, runDogfoodSelfRefreshOrExit } = require('./commands/startup.cjs');
const startupCmd = createStartupCommand({
  findRepoRoot, gadConfig, render,
  sideEffectsSuppressed, resolveSideEffectsMode, NO_SIDE_EFFECTS_FLAG,
  getPackagedExecutablePath, isPackagedExecutableRuntime, getDefaultSelfInstallDir,
  detectRuntimeIdentity, buildHandoffsSection, printSection, ensureGraphFresh,
  readState, writeEvolutionScan, maybeGenerateDailyTip,
  getLastActiveProjectid, setLastActiveProjectid,
  sessionHelpers: {
    sessionsDir: require('./commands/session.cjs').sessionsDir,
    generateSessionId: require('./commands/session.cjs').generateSessionId,
    SESSION_STATUS,
    buildContextRefs,
    writeSession,
  },
});

// self: bin/commands/self.cjs (depends on runDogfoodSelfRefreshOrExit from startup.cjs)
const { createSelfCommand, createSelfEvalCommand } = require('./commands/self.cjs');
const selfCmd = createSelfCommand({ runDogfoodSelfRefreshOrExit });

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

// install / uninstall: bin/commands/install.cjs
const { createInstallCommand } = require('./commands/install.cjs');
const { install: installCmd, uninstall: uninstallCmd } = createInstallCommand({
  getClaudeSettingsPath, readJsonSafe, writeJsonPretty, GAD_HOOK_MARKER,
  isPackagedExecutableRuntime, getPackagedExecutablePath,
  getDefaultSelfInstallDir, updateWindowsUserPath,
});

// self-eval: bin/commands/self.cjs
const selfEvalCmd = createSelfEvalCommand({ outputError });

// data: bin/commands/data.cjs
const { createDataCommand } = require('./commands/data.cjs');
const dataCmd = createDataCommand({ outputError });

// ── gad rounds — query experiment round data ──────────────────
// rounds: bin/commands/rounds.cjs
const { createRoundsCommand } = require("./commands/rounds.cjs");
const roundsCmd = createRoundsCommand({ outputError, resolveOrDefaultEvalProjectDir, defaultEvalsDir });


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

function resolveSkillRoots(repoRoot) {
  const defaults = evolutionPaths(repoRoot);
  return {
    finalSkillsDir: process.env.GAD_SKILLS_DIR
      ? path.resolve(process.env.GAD_SKILLS_DIR)
      : defaults.finalSkillsDir,
    protoSkillsDir: process.env.GAD_PROTO_SKILLS_DIR
      ? path.resolve(process.env.GAD_PROTO_SKILLS_DIR)
      : defaults.protoSkillsDir,
  };
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
  const parsed = parseSkillFrontmatter(src);
  if (!parsed.hasFrontmatter) return { name: null, description: null, workflow: null };
  const fields = parsed.fields || {};
  return {
    ...fields,
    name: fields.name || null,
    description: fields.description || null,
    workflow: fields.workflow || null,
  };
}

function normalizeSkillLaneValues(value) {
  const raw = Array.isArray(value) ? value : (value ? [value] : []);
  return raw
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean);
}

function skillMatchesLane(frontmatter, lane) {
  if (!lane) return true;
  return normalizeSkillLaneValues(frontmatter.lane).includes(lane);
}

function validateSkillLaneFilter(raw) {
  const lane = String(raw || '').trim().toLowerCase();
  if (!lane) return '';
  if (!['dev', 'prod', 'meta'].includes(lane)) {
    outputError(`Invalid lane: ${lane}. Expected dev, prod, or meta.`);
  }
  return lane;
}

function severityRank(severity) {
  if (severity === 'error') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function filterIssuesBySeverity(issues, minimumSeverity) {
  const min = minimumSeverity ? severityRank(minimumSeverity) : 0;
  if (!min) return issues.slice();
  return issues.filter((issue) => severityRank(issue.severity) >= min);
}

function resolveSkillWorkflowPath(repoRoot, skillDir, workflowRef) {
  if (!workflowRef) return null;
  const isSibling = workflowRef.startsWith('./') || workflowRef.startsWith('../');
  return isSibling
    ? path.resolve(skillDir, workflowRef)
    : path.resolve(repoRoot, workflowRef);
}

function buildSkillUsageIndex(baseDir, finalSkillsDir) {
  const config = gadConfig.load(baseDir);
  const knownSkills = discoverSkillIds(finalSkillsDir);
  const attributions = collectAttributions(config, baseDir);
  const usageReport = buildUsageReport(attributions, knownSkills);
  return {
    report: usageReport,
    bySkill: new Map((usageReport.bySkill || []).map((entry) => [entry.skill, entry])),
  };
}

function readSkillSource(skillFile) {
  try {
    const raw = fs.readFileSync(skillFile, 'utf8');
    const parsed = parseSkillFrontmatter(raw);
    const bodyStart = parsed.hasFrontmatter ? (parsed.frontmatterEnd + 1) : 0;
    const body = (parsed.rawLines || raw.split(/\r?\n/)).slice(bodyStart).join('\n');
    return { raw, body, frontmatter: parsed.fields || {} };
  } catch {
    return { raw: '', body: '', frontmatter: {} };
  }
}

function skillReferencesId(source, skillId) {
  if (!source || !skillId) return false;
  if (String(source.parent_skill || '').trim() === skillId) return true;
  const refs = extractBodyRefs(source.body || '');
  return refs.some((ref) => ref.kind === 'alias' && ref.ref === `@skills/${skillId}`);
}

function findReferencedSkillIds(skillRecords) {
  const referenced = new Set();
  for (const record of skillRecords) {
    for (const candidate of skillRecords) {
      if (record.id === candidate.id) continue;
      if (skillReferencesId(record.source, candidate.id)) referenced.add(candidate.id);
    }
  }
  return referenced;
}

function listCandidateDirs(repoRoot) {
  const candidatesDir = path.join(repoRoot, '.planning', 'candidates');
  if (!fs.existsSync(candidatesDir)) return [];
  return fs.readdirSync(candidatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function buildEvolutionScan(root, baseDir, repoRoot) {
  const { finalSkillsDir } = resolveSkillRoots(repoRoot);
  const skillRecords = listSkillDirs(finalSkillsDir).map((entry) => ({
    ...entry,
    frontmatter: readSkillFrontmatter(entry.skillFile),
    source: readSkillSource(entry.skillFile),
  }));
  const { report, bySkill } = buildSkillUsageIndex(baseDir, finalSkillsDir);
  const referencedSkillIds = findReferencedSkillIds(skillRecords);
  const existingCandidates = listCandidateDirs(repoRoot);

  const tasks = readTasks(root, baseDir, {});
  const groupedByPhase = new Map();
  for (const task of tasks) {
    const phaseId = String(task.phase || task.id.split('-')[0] || '').trim();
    if (!phaseId) continue;
    const list = groupedByPhase.get(phaseId) || [];
    list.push(task);
    groupedByPhase.set(phaseId, list);
  }
  const phaseSignals = [];
  for (const [phaseId, phaseTasks] of groupedByPhase.entries()) {
    const doneTasks = phaseTasks.filter((task) => task.status === 'done');
    if (doneTasks.length < 2) continue;
    const realSkills = new Set(
      doneTasks
        .flatMap((task) => String(task.skill || '').split(',').map((value) => value.trim()).filter(Boolean))
        .filter((value) => !SENTINEL_SKILL_VALUES.has(value.toLowerCase()))
    );
    if (realSkills.size <= 1) {
      phaseSignals.push({
        id: `phase-${phaseId}-repeated-work`,
        phase: phaseId,
        reason: `${doneTasks.length} done tasks, ${realSkills.size} real attributed skills`,
      });
    }
  }

  const shedCandidates = skillRecords
    .filter((record) => {
      const type = String(record.frontmatter.type || '').trim().toLowerCase();
      if (type === 'meta-framework') return false;
      if (referencedSkillIds.has(record.id)) return false;
      const usage = bySkill.get(record.id);
      return !usage || usage.runs === 0;
    })
    .map((record) => ({
      id: record.id,
      type: record.frontmatter.type || '',
      lane: normalizeSkillLaneValues(record.frontmatter.lane),
      reason: 'unused, unreferenced, and not meta-framework',
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    scannedAt: new Date().toISOString(),
    projectid: root.id,
    candidates: [
      ...existingCandidates.map((id) => ({ id, source: 'existing-candidate-dir' })),
      ...phaseSignals.map((signal) => ({ ...signal, source: 'phase-signal' })),
    ],
    shedCandidates,
    usageSummary: {
      totalRuns: report.totalRuns,
      uniqueSkillsUsed: report.uniqueSkillsUsed,
      unusedSkills: report.unused.length,
      attributedButMissing: report.attributedButMissing.length,
    },
  };
}

function evolutionScanFilePath(root, baseDir) {
  return path.join(baseDir, root.path, root.planningDir, '.evolution-scan.json');
}

function writeEvolutionScan(root, baseDir, repoRoot) {
  if (sideEffectsSuppressed()) return { scan: null, filePath: evolutionScanFilePath(root, baseDir) };
  const scan = buildEvolutionScan(root, baseDir, repoRoot);
  const filePath = evolutionScanFilePath(root, baseDir);
  fs.writeFileSync(filePath, `${JSON.stringify(scan, null, 2)}\n`, 'utf8');
  return { scan, filePath };
}

function readEvolutionScan(root, baseDir) {
  const filePath = evolutionScanFilePath(root, baseDir);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function buildEvolutionSection(root, baseDir) {
  const scan = readEvolutionScan(root, baseDir);
  if (!scan) return null;
  const candidateCount = Array.isArray(scan.candidates) ? scan.candidates.length : 0;
  const shedCount = Array.isArray(scan.shedCandidates) ? scan.shedCandidates.length : 0;
  if (candidateCount === 0 && shedCount === 0) return null;
  const lines = [
    `${candidateCount} candidates surfaced (last scan: ${String(scan.scannedAt || '').slice(0, 16)}Z)`,
    `${shedCount} skills flagged for shedding (dry-run only)`,
    'Run: gad evolution evolve   |   gad evolution shed --dry-run',
  ];
  return {
    title: 'EVOLUTION',
    content: lines.join('\n'),
    scan,
  };
}

// evolution images: bin/commands/evolution-images.cjs
const { createEvolutionImagesCommand } = require("./commands/evolution-images.cjs");
const evolutionImagesCmd = createEvolutionImagesCommand({ splitCsvList, getProtoSkillGlobalDir, listSkillDirs, readSkillFrontmatter });


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
    lane: { type: 'string', description: 'Filter by lane (dev|prod|meta)', default: '' },
    'lint-summary': { type: 'boolean', description: 'Append a non-blocking lint summary for the listed canonical skills', default: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir, finalSkillsDir } = resolveSkillRoots(repoRoot);
    const showCanonical = !args.proto;
    const showProto = !args.canonical;
    const showPaths = Boolean(args.paths);
    const laneFilter = validateSkillLaneFilter(args.lane);
    let listedCanonical = [];
    if (showCanonical) {
      const canonical = listSkillDirs(finalSkillsDir).filter((skill) => skillMatchesLane(readSkillFrontmatter(skill.skillFile), laneFilter));
      listedCanonical = canonical;
      console.log(`Canonical skills (skills/): ${canonical.length}${laneFilter ? `  lane=${laneFilter}` : ''}`);
      for (const s of canonical) {
        const fm = readSkillFrontmatter(s.skillFile);
        console.log(`  ${s.id}${fm.name && fm.name !== s.id ? `  (${fm.name})` : ''}`);
        if (showPaths) {
          console.log(`      SKILL.md: ${s.skillFile}`);
          if (fm.workflow) {
            const resolved = resolveSkillWorkflowPath(repoRoot, s.dir, fm.workflow);
            const exists = fs.existsSync(resolved);
            console.log(`      workflow: ${resolved}${exists ? '' : ' (MISSING)'}`);
          }
        }
      }
      console.log('');
    }
    if (showProto) {
      const proto = listSkillDirs(protoSkillsDir).filter((skill) => skillMatchesLane(readSkillFrontmatter(skill.skillFile), laneFilter));
      console.log(`Proto-skills (.planning/proto-skills/): ${proto.length}${laneFilter ? `  lane=${laneFilter}` : ''}`);
      for (const s of proto) {
        const fm = readSkillFrontmatter(s.skillFile);
        console.log(`  ${s.id}${fm.name && fm.name !== s.id ? `  (${fm.name})` : ''}`);
        if (showPaths) {
          console.log(`      SKILL.md: ${s.skillFile}`);
          if (fm.workflow) {
            const resolved = resolveSkillWorkflowPath(repoRoot, s.dir, fm.workflow);
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
    if (args['lint-summary'] && showCanonical) {
      const lintReports = listedCanonical.map((skill) => lintSkill(skill.skillFile, { gadDir: repoRoot }));
      const lintSummary = summarizeLint(lintReports);
      console.log('');
      console.log(`Lint: ${lintSummary.clean} clean, ${lintSummary.bySeverity.error} errors, ${lintSummary.bySeverity.warning} warnings, ${lintSummary.bySeverity.info} info - run \`gad skill lint\` for detail.`);
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

const skillLint = defineCommand({
  meta: { name: 'lint', description: 'Run the non-blocking skill linter across canonical skills or one named skill' },
  args: {
    id: { type: 'string', description: 'Lint a single canonical skill id', default: '' },
    severity: { type: 'string', description: 'Filter to issues at or above error|warning|info', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { finalSkillsDir } = resolveSkillRoots(repoRoot);
    const minimumSeverity = String(args.severity || '').trim().toLowerCase();
    if (minimumSeverity && !['error', 'warning', 'info'].includes(minimumSeverity)) {
      outputError(`Invalid severity: ${minimumSeverity}. Expected error, warning, or info.`);
    }

    let reports;
    if (args.id) {
      const skillPath = path.join(finalSkillsDir, String(args.id), 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        outputError(`Skill not found: ${args.id}`);
      }
      reports = [lintSkill(skillPath, { gadDir: repoRoot })];
    } else {
      reports = lintAllSkills(finalSkillsDir, { gadDir: repoRoot });
    }

    const filteredReports = reports.map((report) => ({
      ...report,
      issues: filterIssuesBySeverity(report.issues || [], minimumSeverity),
    }));
    const summary = summarizeLint(filteredReports);

    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify({ summary, reports: filteredReports }, null, 2));
      return;
    }

    const issueBuckets = filteredReports.filter((report) => report.issues.length > 0);
    console.log(`Skill lint report - ${summary.totalSkills} skills, ${summary.clean} clean, ${issueBuckets.length} with issues`);
    if (issueBuckets.length > 0) console.log('');
    for (const report of issueBuckets) {
      console.log(`${path.relative(repoRoot, report.skillPath)} (${report.issues.length} issue${report.issues.length === 1 ? '' : 's'})`);
      for (const issue of report.issues) {
        console.log(`  [${issue.severity}] ${issue.code} - ${issue.message}`);
      }
      console.log('');
    }
    console.log(`Summary: ${summary.bySeverity.error} errors, ${summary.bySeverity.warning} warnings, ${summary.bySeverity.info} info`);
    console.log(`Total tokens: ${summary.totalTokens} across ${summary.totalSkills} skills (avg ${summary.averageTokens}/skill)`);
  },
});

const skillTokenAudit = defineCommand({
  meta: { name: 'token-audit', description: 'Audit canonical skill token footprint and highlight the largest skill bundles' },
  args: {
    top: { type: 'string', description: 'How many skills to show (default 10)', default: '10' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { finalSkillsDir } = resolveSkillRoots(repoRoot);
    const topN = Math.max(1, Number.parseInt(String(args.top || '10'), 10) || 10);
    const audits = listSkillDirs(finalSkillsDir).map((skill) => ({
      id: skill.id,
      path: skill.skillFile,
      audit: auditSkillTokens(skill.skillFile, { gadDir: repoRoot }),
    }));
    const summary = {
      totalSkills: audits.length,
      totalTokens: audits.reduce((sum, entry) => sum + (entry.audit.totalTokens || 0), 0),
    };
    summary.averageTokens = summary.totalSkills > 0 ? Math.round(summary.totalTokens / summary.totalSkills) : 0;
    const top = [...audits]
      .sort((a, b) => (b.audit.totalTokens || 0) - (a.audit.totalTokens || 0))
      .slice(0, topN);

    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify({
        summary,
        top: top.map((entry) => ({
          id: entry.id,
          path: path.relative(repoRoot, entry.path),
          totalTokens: entry.audit.totalTokens || 0,
          sections: entry.audit.sections || [],
        })),
      }, null, 2));
      return;
    }

    console.log(`Skill token audit - ${summary.totalSkills} skills, ${summary.totalTokens} total tokens, ${summary.averageTokens} avg`);
    console.log('');
    console.log(`Top ${top.length} bloat:`);
    for (const entry of top) {
      console.log(`  ${(entry.audit.totalTokens || 0).toString().padStart(4, ' ')}  ${path.relative(repoRoot, entry.path)}`);
    }
    const breakdown = top.slice(0, Math.min(3, top.length));
    if (breakdown.length > 0) {
      console.log('');
      console.log(`Per-section breakdown for top ${breakdown.length}:`);
      for (const entry of breakdown) {
        console.log(`  ${entry.id}:`);
        for (const section of entry.audit.sections || []) {
          console.log(`    ${section.name.padEnd(28, ' ')} ~${section.tokens}`);
        }
      }
    }
  },
});

const skillStatus = defineCommand({
  meta: { name: 'status', description: 'Show one skill health card: frontmatter, lint issues, bundle completeness, usage, and token footprint' },
  args: {
    id: { type: 'positional', description: 'Skill id (canonical or proto)', required: true },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir, finalSkillsDir } = resolveSkillRoots(repoRoot);
    const roots = [
      { label: 'canonical', dir: finalSkillsDir },
      { label: 'proto', dir: protoSkillsDir },
    ];
    let hit = null;
    for (const root of roots) {
      const candidate = listSkillDirs(root.dir).find((skill) => skill.id === args.id);
      if (!candidate) continue;
      hit = { ...candidate, origin: root.label, fm: readSkillFrontmatter(candidate.skillFile) };
      break;
    }
    if (!hit) {
      outputError(`Skill not found: ${args.id}`);
    }

    const lintReport = lintSkill(hit.skillFile, { gadDir: repoRoot });
    const workflowPath = hit.fm.workflow ? resolveSkillWorkflowPath(repoRoot, hit.dir, hit.fm.workflow) : null;
    const skillTokenAudit = auditSkillTokens(hit.skillFile, { gadDir: repoRoot });
    const workflowTokenAudit = workflowPath && fs.existsSync(workflowPath)
      ? auditSkillTokens(workflowPath, { gadDir: repoRoot })
      : null;
    const usageIndex = buildSkillUsageIndex(baseDir, finalSkillsDir);
    const usage = usageIndex.bySkill.get(hit.id) || null;
    const bundleChecks = [
      ['SKILL.md', true],
      ['PROVENANCE.md', fs.existsSync(path.join(hit.dir, 'PROVENANCE.md'))],
      ['VALIDATION.md', fs.existsSync(path.join(hit.dir, 'VALIDATION.md'))],
      ['workflow.md', fs.existsSync(path.join(hit.dir, 'workflow.md'))],
      ['COMMAND.md', fs.existsSync(path.join(hit.dir, 'COMMAND.md'))],
      ['references/', fs.existsSync(path.join(hit.dir, 'references'))],
    ];

    console.log(`Skill: ${hit.id} [${hit.origin}]`);
    console.log(`  name:       ${hit.fm.name || hit.id}`);
    console.log(`  lane:       ${normalizeSkillLaneValues(hit.fm.lane).join(', ') || '(none)'}`);
    console.log(`  type:       ${hit.fm.type || '(none)'}`);
    console.log(`  status:     ${hit.fm.status || '(none)'}`);
    console.log(`  parent:     ${hit.fm.parent_skill || '(none)'}`);
    if (workflowPath) {
      console.log(`  workflow:   ${hit.fm.workflow} [${fs.existsSync(workflowPath) ? 'ok' : 'missing'}]`);
    } else {
      console.log('  workflow:   (none)');
    }
    if (workflowTokenAudit) {
      const totalTokens = (skillTokenAudit.totalTokens || 0) + (workflowTokenAudit.totalTokens || 0);
      console.log(`  tokens:     ~${skillTokenAudit.totalTokens || 0} SKILL.md + ~${workflowTokenAudit.totalTokens || 0} workflow (~${totalTokens} total)`);
    } else {
      console.log(`  tokens:     ~${lintReport.tokenEstimate} (SKILL.md)`);
    }
    console.log(`  bundle:     ${bundleChecks.map(([label, ok]) => `${label} ${ok ? '[ok]' : '[missing]'}`).join('  ')}`);
    if (usage) {
      const projects = usage.projects || [];
      const projectSummary = projects.length === 1 ? ` (${projects[0]})` : '';
      console.log(`  usage:      ${usage.runs} done tasks, ${projects.length} project${projects.length === 1 ? '' : 's'}${projectSummary}; last run ${usage.lastUsedAt ? usage.lastUsedAt.slice(0, 10) : 'unknown'}`);
    } else {
      console.log('  usage:      0 done tasks, 0 projects; last run unknown');
    }
    if (hit.fm.canonicalization_rationale) {
      console.log(`  lineage:    ${String(hit.fm.canonicalization_rationale).replace(/\s+/g, ' ').trim()}`);
    }
    console.log('');
    console.log(`Issues${lintReport.issues.length === 0 ? ': (none)' : ` (${lintReport.issues.length}):`}`);
    if (lintReport.issues.length === 0) {
      // keep the empty-state inline with the header
    } else {
      for (const issue of lintReport.issues) {
        console.log(`  [${issue.severity}] ${issue.code} - ${issue.message}`);
      }
    }
    console.log('');
    console.log('Section tokens:');
    for (const section of skillTokenAudit.sections || []) {
      console.log(`  ${section.name.padEnd(34, ' ')} ~${section.tokens}`);
    }
    console.log(`  ${'(total)'.padEnd(34, ' ')} ~${skillTokenAudit.totalTokens || 0}`);
  },
});

// bundle: bin/commands/bundle.cjs (factory replaces bundleExport + copyDirRecursive + bundleCmd)
const { createBundleCommand } = require("./commands/bundle.cjs");
const bundleCmd = createBundleCommand({ readSkillFrontmatter });


const skillShow = defineCommand({
  meta: { name: 'show', description: 'Show a canonical or proto-skill: resolved paths, frontmatter, and (optionally) SKILL.md + workflow body. Decision gad-194, task 42.2-20.' },
  args: {
    id: { type: 'positional', description: 'skill id (e.g. gad-plan-phase) or slug', required: true },
    body: { type: 'boolean', description: 'Also print SKILL.md and workflow file body', default: false },
  },
  run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const { protoSkillsDir, finalSkillsDir } = resolveSkillRoots(repoRoot);

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
      const resolved = resolveSkillWorkflowPath(repoRoot, hit.dir, hit.fm.workflow);
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
        const resolved = resolveSkillWorkflowPath(repoRoot, hit.dir, hit.fm.workflow);
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
    lint: skillLint,
    status: skillStatus,
    'token-audit': skillTokenAudit,
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
const evolutionScan = defineCommand({
  meta: { name: 'scan', description: 'Run the lightweight evolution scan and write .planning/.evolution-scan.json' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
    if (roots.length === 0) return;
    const root = roots[0];
    const repoRoot = path.resolve(__dirname, '..');
    const { scan, filePath } = writeEvolutionScan(root, baseDir, repoRoot);
    const payload = {
      project: root.id,
      file: path.relative(baseDir, filePath),
      candidateCount: scan.candidates.length,
      shedCount: scan.shedCandidates.length,
      scan,
    };
    if (args.json || shouldUseJson()) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(`Evolution scan: ${payload.candidateCount} candidate(s), ${payload.shedCount} shed candidate(s) -> ${payload.file}`);
  },
});

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
  meta: { name: 'shed', description: 'Dry-run or confirm shedding of unused skills; legacy candidate shedding remains available behind --all/--obsolete/<slug>.' },
  args: {
    slug: { type: 'positional', description: 'Candidate slug (omit when using --all or --obsolete)', required: false, default: '' },
    confirm: { type: 'string', description: 'Archive the named canonical skill into .archive/skills/', default: '' },
    projectid: { type: 'string', description: 'Scope scan/readout to one project', default: '' },
    all: { type: 'boolean', description: 'Shed every candidate currently under .planning/candidates/', default: false },
    obsolete: { type: 'boolean', description: 'Shed only candidates flagged obsolete by sprint-window analysis (uses --threshold)', default: false },
    threshold: { type: 'string', description: 'Obsolete cutoff for --obsolete (default 0.65 with embeddings, 0.40 TF-IDF)', default: '' },
    embeddings: { type: 'boolean', description: 'Use embeddings backend for --obsolete (default TF-IDF)', default: false },
    reason: { type: 'string', description: 'Reason recorded in skills/.shed/<slug>', default: 'shed via cli' },
    dryRun: { type: 'boolean', description: 'Print what would be shed without doing it', default: false },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  async run({ args }) {
    const repoRoot = path.resolve(__dirname, '..');
    const useLegacyCandidateFlow = Boolean(args.slug || args.all || args.obsolete);
    if (!useLegacyCandidateFlow) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) return;
      const root = roots[0];
      const scan = readEvolutionScan(root, baseDir) || writeEvolutionScan(root, baseDir, repoRoot).scan;
      const flagged = Array.isArray(scan.shedCandidates) ? scan.shedCandidates : [];

      if (args.confirm) {
        const slug = String(args.confirm).trim();
        const skillDir = path.join(repoRoot, 'skills', slug);
        if (!fs.existsSync(skillDir)) {
          outputError(`Canonical skill not found: ${slug}`);
        }
        const archiveRoot = path.join(repoRoot, '.archive', 'skills');
        const archiveDir = path.join(archiveRoot, `${slug}-${new Date().toISOString().slice(0, 10)}`);
        fs.mkdirSync(archiveRoot, { recursive: true });
        fs.renameSync(skillDir, archiveDir);
        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify({
            project: root.id,
            archived: slug,
            archiveDir: path.relative(repoRoot, archiveDir),
          }, null, 2));
          return;
        }
        console.log(`Shed skill: ${slug}`);
        console.log(`Archive: ${path.relative(repoRoot, archiveDir)}`);
        return;
      }

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify({
          project: root.id,
          dryRun: true,
          count: flagged.length,
          skills: flagged,
        }, null, 2));
        return;
      }

      console.log(`Evolution shed dry-run: ${flagged.length} skill(s) flagged`);
      if (flagged.length === 0) {
        console.log('  none');
        return;
      }
      for (const entry of flagged) {
        console.log(`  ${entry.id}${entry.type ? `  type=${entry.type}` : ''}`);
      }
      console.log('');
      console.log('Confirm one skill at a time:');
      console.log('  gad evolution shed --confirm <slug>');
      return;
    }

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
    scan: evolutionScan,
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

// workflow: bin/commands/workflow.cjs
const { createWorkflowCommand } = require('./commands/workflow.cjs');
const workflowCmd = createWorkflowCommand();

// models: bin/commands/models.cjs
const { createModelsCommand } = require('./commands/models.cjs');
const modelsCmd = createModelsCommand();


// ─── gad graph — planning knowledge-graph generator ────────────────────────
//
// Builds a typed-node, typed-edge graph from .planning/ XML files, skills/,
// and workflows/. Output: .planning/graph.json + .planning/graph.html.
// Structural queries are LLM-free — see `gad query`.

// graphExtractor require hoisted to top imports in sweep E (2026-04-19)
// so command factories can receive it as a dep at module-load time.

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
    fs.writeFileSync(path.join(planDir, 'graph.html'), graphExtractor.generateHtml(graph));
  } catch {
    // Silent — graph rebuild is best-effort, never blocks the primary operation.
  }
}

/**
 * Ensure .planning/graph.{json,html} are fresh — read-side helper for
 * snapshot/startup. Delegates to graphExtractor.loadOrBuildGraph for the
 * actual cache-vs-rebuild decision (it uses STALENESS_SOURCES =
 * TASK-REGISTRY/ROADMAP/DECISIONS mtimes), and writes graph.html alongside
 * when a rebuild happens or when html is missing while json is fresh.
 *
 * Closes 63-graph-task-stale at read points: post-2026-04-19 the graph
 * artifacts are gitignored, so a fresh checkout has no graph until the
 * first snapshot/startup/query rebuilds it.
 *
 * Returns { rebuilt: boolean, reason: string|null }. Silent by default.
 */
function ensureGraphFresh(baseDir, root) {
  try {
    if (!graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path))) return { rebuilt: false, reason: 'disabled' };
    const gadDir = path.resolve(__dirname, '..');
    const result = graphExtractor.loadOrBuildGraph(root, baseDir, { gadDir });
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const htmlPath = path.join(planDir, 'graph.html');
    if (result.rebuilt || !fs.existsSync(htmlPath)) {
      try { fs.writeFileSync(htmlPath, graphExtractor.generateHtml(result.graph)); } catch { /* best-effort */ }
    }
    return { rebuilt: result.rebuilt, reason: result.reason };
  } catch {
    return { rebuilt: false, reason: 'error' };
  }
}

// graph: bin/commands/graph.cjs
const { createGraphCommand } = require('./commands/graph.cjs');
const graphCmd = createGraphCommand({ findRepoRoot, gadConfig, resolveRoots, graphExtractor });

// ─── gad query — structural graph queries ──────────────────────────────────
//
// Query the planning knowledge graph without reading full planning files.
// Accepts natural-language-ish queries or structured flags.
// Runs against .planning/graph.json (generated by `gad graph build`).

// query: bin/commands/query.cjs
const { createQueryCommand } = require("./commands/query.cjs");
const queryCmd = createQueryCommand({ findRepoRoot, gadConfig, resolveRoots, graphExtractor });


// try (gad try): bin/commands/try.cjs
const { createTryCommand } = require('./commands/try.cjs');
const { tryCmd } = createTryCommand();

// generate (AI generation fundamentals): bin/commands/generate.cjs (decision gad-217)
const { createGenerateCommand } = require('./commands/generate.cjs');
const { generateCmd } = createGenerateCommand({ outputError });

// shortcuts (spawn / breed / play): bin/commands/shortcuts.cjs (decision gad-219)
const { createShortcutCommands } = require('./commands/shortcuts.cjs');
const { spawnCmd, breedCmd, playCmd } = createShortcutCommands({
  outputError, evalRun, evalDataAccess, servePreservedGenerationBuildArtifact,
});

// tip: bin/commands/tip.cjs
const { createTipCommand } = require('./commands/tip.cjs');
const tipCmd = createTipCommand({ teachings, findRepoRoot, gadConfig, outputError });

/**
 * `gad next` — cross-project priority hotlist.
 *
 * Priority tiers (top = most urgent):
 *   1. in-progress tasks WITH attribution (agent / skill / runtime set) —
 *      actively claimed work.
 *   2. in-progress tasks WITHOUT attribution — stalled carryovers.
 *   3. first planned task per project, ordered by earliest sprint phase.
 *
 * Scope defaults: use session/cwd scope via resolveRoots, same as `tasks
 * list`. Pass --all to emit every project. --json emits the structured
 * array for tooling.
 */
// next: bin/commands/next.cjs
const { createNextCommand } = require('./commands/next.cjs');
const nextCmd = createNextCommand({
  findRepoRoot, gadConfig, resolveRoots, readTasks, formatId, render,
});

// publish: bin/commands/publish.cjs
const { createPublishCommand } = require('./commands/publish.cjs');
const publishCmd = createPublishCommand();

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
    tasks: tasksCmd,
    'task-checkpoint': taskCheckpoint,
    next: nextCmd,
    decisions: decisionsCmd,
    handoffs: handoffsCmd,
    todos: todosCmd,
    note: noteCmd,
    notes: noteCmd,
    requirements: requirementsCmd,
    errors: errorsCmd,
    blockers: blockersCmd,
    refs: refsCmd,
    pack: packCmd,
    docs: docsCmd,
    planning: planningCmd,
    narrative: narrativeCmd,
    site: siteCmd,
    self: selfCmd,
    'self-eval': selfEvalCmd,
    data: dataCmd,
    env: envCmd,
    runtime: runtimeCmd,
    eval: evalCmd,
    evolution: evolutionCmd,
    skill: skillCmd,
    models: modelsCmd,
    workflow: workflowCmd,
    rounds: roundsCmd,
    verify: verifyCmd,
    snapshot: snapshotCmd,
    start: startCmd,
    dashboard: startCmd,
    subagents: subagentsCmd,
    agents: agentsCmd,
    startup: startupCmd,
    'pause-work': pauseWorkCmd,
    'discovery-test': discoveryTestCmd,
    sprint: sprintCmd,
    dev: devCmd,
    sink: sinkCmd,
    log: logCmd,
    worktree: worktreeCmd,
    health: healthCmd,
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
    tip: tipCmd,
    publish: publishCmd,
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

// `gad phases` / `gad decisions` / `gad todos` with no subcommand default
// to `list` so existing CLI UX is preserved after the groups were added.
(function injectPhasesListDefault() {
  const a = process.argv;
  const i = a.indexOf('phases');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['list', 'add']);
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'list');
    return;
  }
  if (!known.has(first)) return;
})();

(function injectDecisionsListDefault() {
  const a = process.argv;
  const i = a.indexOf('decisions');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['list', 'add']);
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'list');
    return;
  }
  if (!known.has(first)) return;
})();

(function injectTodosListDefault() {
  const a = process.argv;
  const i = a.indexOf('todos');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['list', 'add']);
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'list');
    return;
  }
  if (!known.has(first)) return;
})();

// `gad runtime` defaults to `gad runtime select` for read-only inspection.
(function injectRuntimeSelectDefault() {
  const a = process.argv;
  const i = a.indexOf('runtime');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['check', 'select', 'matrix', 'pipeline', 'launch', 'help']);
  if (first === undefined || first.startsWith('-')) {
    const launchFlag = String(first || '');
    const shouldDefaultToLaunch = launchFlag === '--id'
      || launchFlag.startsWith('--id=')
      || launchFlag === '--same-shell'
      || launchFlag === '--new-shell'
      || launchFlag === '--no-new-shell'
      || launchFlag === '--dry-run';
    a.splice(i + 1, 0, shouldDefaultToLaunch ? 'launch' : 'select');
    return;
  }
  if (!known.has(first)) return;
})();

// `gad publish` with no subcommand defaults to `gad publish list --mine`.
// `gad publish <projectid> ...` (positional) routes to `gad publish set`.
(function injectPublishDefault() {
  const a = process.argv;
  const i = a.indexOf('publish');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['set', 'list', 'help']);
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'list');
    return;
  }
  if (known.has(first)) return;
  a.splice(i + 1, 0, 'set');
})();

// `gad tip` with no subcommand defaults to `gad tip today`.
(function injectTipTodayDefault() {
  const a = process.argv;
  const i = a.indexOf('tip');
  if (i === -1) return;
  const first = a[i + 1];
  const known = new Set(['today', 'random', 'search', 'list', 'categories', 'reindex', 'generate']);
  if (first === undefined || first.startsWith('-')) {
    a.splice(i + 1, 0, 'today');
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

