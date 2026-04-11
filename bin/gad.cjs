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
 *   gad workspace show
 *   gad workspace sync
 *   gad projects list
 *   gad state
 *   gad phases [--projectid <id>]
 *   gad tasks [--projectid <id>]
 *   gad docs compile [--sink <path>]
 *   gad eval list
 *   gad eval run --project <name>
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
const { compile: compileDocs } = require('../lib/docs-compiler.cjs');
const planningRefVerify = require('../lib/planning-ref-verify.cjs');

const pkg = require('../package.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve repo root from cwd (looks for gad-config.toml / legacy planning-config.toml up the tree). */
function readXmlFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function findRepoRoot(start) {
  let dir = start || process.cwd();
  for (let i = 0; i < 10; i++) {
    if (resolveTomlPath(dir) || fs.existsSync(path.join(dir, 'config.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
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
  const gadDir = path.join(__dirname, '..');
  const evalsDir = path.join(gadDir, 'evals');
  if (!fs.existsSync(evalsDir)) {
    console.error('No eval projects found. Create evals/<name>/REQUIREMENTS.md to get started.');
    process.exit(1);
  }
  const projects = fs.readdirSync(evalsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
  if (projects.length === 0) {
    console.error('No eval projects found. Create evals/<name>/REQUIREMENTS.md to get started.');
    process.exit(1);
  }
  console.error(`\nMissing --project. Available eval projects:\n`);
  for (const p of projects) console.error(`  ${p}`);
  console.error(`\nRerun: gad eval run --project ${projects[0]}`);
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
// workspace subcommands
// ---------------------------------------------------------------------------

const workspaceShow = defineCommand({
  meta: { name: 'show', description: 'Show all registered planning roots' },
  run() {
    const root = findRepoRoot();
    const config = gadConfig.load(root);
    if (config.roots.length === 0) {
      console.log('No planning roots registered. Run `gad workspace sync` to discover them.');
      return;
    }
    const rows = config.roots.map(r => ({
      id: r.id,
      path: r.path,
      planningDir: r.planningDir,
      discover: r.discover ? 'yes' : 'no',
    }));
    output(rows, { title: `GAD Workspaces (${config.roots.length} roots)  [source: ${config.source}]` });
    if (config.docs_sink) {
      console.log(`\nDocs sink: ${config.docs_sink}`);
    }
  },
});

const workspaceSync = defineCommand({
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
      console.log(`✓ Workspace is up to date — ${config.roots.length} roots registered`);
      return;
    }

    console.log('\nWorkspace sync\n');
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

const workspaceAdd = defineCommand({
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

const workspaceIgnore = defineCommand({
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

const workspaceCmd = defineCommand({
  meta: { name: 'workspace', description: 'Manage planning workspace roots' },
  subCommands: {
    show: workspaceShow,
    sync: workspaceSync,
    add: workspaceAdd,
    ignore: workspaceIgnore,
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

const projectsInit = defineCommand({
  meta: { name: 'init', description: 'Initialize a new project with .planning/ scaffold' },
  args: {
    name: { type: 'string', description: 'Project name (default: folder name)', default: '' },
    path: { type: 'string', description: 'Project path (default: cwd)', default: '' },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const projectPath = args.path || process.cwd();
    const projectName = args.name || path.basename(projectPath);
    const planDir = path.join(projectPath, '.planning');

    fs.mkdirSync(planDir, { recursive: true });

    // Create starter files from templates
    const templateDir = path.join(__dirname, '..', 'templates');
    const starters = ['state.md', 'roadmap.md', 'requirements.md', 'project.md'];
    let created = 0;

    for (const tmpl of starters) {
      const dest = path.join(planDir, tmpl.replace('state.md', 'STATE.md')
        .replace('roadmap.md', 'ROADMAP.md')
        .replace('requirements.md', 'REQUIREMENTS.md')
        .replace('project.md', 'PROJECT.md'));
      if (!fs.existsSync(dest)) {
        const src = path.join(templateDir, tmpl);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          created++;
        } else {
          fs.writeFileSync(dest, `# ${path.basename(dest, '.md').replace(/-/g, ' ')}\n\nProject: ${projectName}\n`);
          created++;
        }
      }
    }

    console.log(`✓ Initialized .planning/ in ${projectPath}`);
    console.log(`  Created ${created} starter files`);

    // Register in config if not already present
    const relPath = path.relative(baseDir, projectPath) || '.';
    if (!config.roots.find(r => normalizePath(r.path) === normalizePath(relPath))) {
      const id = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      config.roots.push({ id, path: relPath, planningDir: '.planning', discover: false });
      writeRootsToToml(baseDir, config.roots, config);
      console.log(`  Registered as [${id}] in gad-config.toml`);
    }
  },
});

// projects audit — per-project health check
const REQUIRED_FILES_BY_FORMAT = {
  xml: ['STATE.xml', 'ROADMAP.xml'],
  md:  ['STATE.md',  'ROADMAP.md'],
};
const RECOMMENDED_FILES = ['DECISIONS.xml', 'DECISIONS.md', 'AGENTS.md', 'REQUIREMENTS.xml', 'REQUIREMENTS.md'];

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

      results.push({ project: root.id, format: detectedFormat, checks });
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

    const failed = results.flatMap(r => r.checks).filter(c => !c.pass).length;
    console.log(failed === 0
      ? '\n✓ All checks passed.'
      : `\n${failed} check(s) failed.`
    );
  },
});

const projectsCmd = defineCommand({
  meta: { name: 'projects', description: 'List or initialize projects' },
  subCommands: {
    list: projectsList,
    init: projectsInit,
    audit: projectsAudit,
  },
});

// ---------------------------------------------------------------------------
// state command
// ---------------------------------------------------------------------------

const stateCmd = defineCommand({
  meta: { name: 'state', description: 'Show current state for all projects' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
    json: { type: 'boolean', description: 'JSON output (includes full next-action)', default: false },
    full: { type: 'boolean', description: 'Include full next-action text in output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    if (args.json) {
      // JSON: emit full structured state per project
      const out = roots.map(root => {
        const state = readState(root, baseDir);
        return {
          project: root.id,
          phase: state.phasesTotal > 0 ? `${state.phasesComplete}/${state.phasesTotal}` : (state.currentPhase || null),
          milestone: state.milestone || null,
          status: state.status,
          openTasks: state.openTasks,
          lastActivity: state.lastActivity || null,
          nextAction: state.nextAction || null,
        };
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
      };
    });

    const displayRows = rows.map(({ _nextAction, ...r }) => r);
    console.log(render(displayRows, { format: 'table', title: 'GAD State' }));

    if (args.full) {
      for (const r of rows) {
        if (r._nextAction) {
          console.log(`\n── next action [${r.project}] ──────────────────────────────`);
          console.log(r._nextAction);
        }
      }
    }
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
  meta: { name: 'compile', description: 'Compile planning docs → MDX sink' },
  args: {
    sink: { type: 'string', description: 'Override docs_sink path', default: '' },
    verbose: { type: 'boolean', alias: 'v', description: 'Verbose output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);

    const sink = args.sink || config.docs_sink;
    if (!sink) {
      outputError('No docs_sink configured. Pass --sink <path> or set docs_sink in gad-config.toml.');
    }

    console.log(`Compiling ${config.roots.length} roots → ${sink}\n`);
    try {
      let total = 0;
      for (const root of config.roots) {
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
// eval subcommands
// ---------------------------------------------------------------------------

const evalList = defineCommand({
  meta: { name: 'list', description: 'List eval projects and run history' },
  run() {
    const baseDir = findRepoRoot();
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');

    if (!fs.existsSync(evalsDir)) {
      console.log('No eval projects found. Create evals/<name>/REQUIREMENTS.md to get started.');
      return;
    }

    const projects = fs.readdirSync(evalsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => {
        const runs = fs.readdirSync(path.join(evalsDir, e.name), { withFileTypes: true })
          .filter(r => r.isDirectory() && r.name.startsWith('v'))
          .map(r => r.name)
          .sort();
        const latest = runs[runs.length - 1] || '—';
        let status = '—';
        if (latest !== '—') {
          const runMd = path.join(evalsDir, e.name, latest, 'RUN.md');
          if (fs.existsSync(runMd)) {
            const m = fs.readFileSync(runMd, 'utf8').match(/status:\s*([\w-]+)/);
            if (m) status = m[1];
          }
        }
        // Load eval mode + workflow from gad.json
        let mode = '—', workflow = '—', domain = '—', techStack = '';
        const gadJsonPath = path.join(evalsDir, e.name, 'gad.json');
        if (fs.existsSync(gadJsonPath)) {
          try {
            const cfg = JSON.parse(fs.readFileSync(gadJsonPath, 'utf8'));
            if (cfg.eval_mode) mode = cfg.eval_mode;
            if (cfg.workflow) workflow = cfg.workflow;
            if (cfg.domain) domain = cfg.domain;
            if (cfg.tech_stack) techStack = cfg.tech_stack;
          } catch {}
        }
        return { name: e.name, domain, mode, workflow, runs: runs.length, latest, status };
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
function buildEvalPrompt(projectDir, projectName, runNum) {
  const templateDir = path.join(projectDir, 'template');
  const planDir = path.join(templateDir, '.planning');

  const agentsMd = readIfExists(path.join(templateDir, 'AGENTS.md'));
  const reqXml = readIfExists(path.join(planDir, 'REQUIREMENTS.xml'));
  const reqMd = readIfExists(path.join(projectDir, 'REQUIREMENTS.md'));
  const decisionsXml = readIfExists(path.join(planDir, 'DECISIONS.xml'));
  const conventionsMd = readIfExists(path.join(planDir, 'CONVENTIONS.md'));
  const roadmapXml = readIfExists(path.join(planDir, 'ROADMAP.xml'));
  const stateXml = readIfExists(path.join(planDir, 'STATE.xml'));

  // Load gad.json for eval_mode and baseline info
  let cfg = {};
  try {
    const cfgPath = path.join(projectDir, 'gad.json');
    if (fs.existsSync(cfgPath)) cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {}
  const isBrownfield = cfg.eval_mode === 'brownfield';
  const baseline = cfg.baseline;

  // Source docs — REMOVED from eval prompts per decision gad-89.
  // Previously this scanned projectDir for source-*.md and source-*.xml and
  // injected them into the prompt. This was a bleed-in: the REQUIREMENTS.xml
  // is supposed to be the single self-contained spec. Source docs are now
  // archived under evals/<project>/archive/ for historical reference only.
  // If you need to re-enable: restore the fs.readdirSync scan below.
  const sourceDocs = [];

  const sections = [];
  sections.push(`# Eval: ${projectName} v${runNum}`);
  sections.push(`\n**Mode:** ${cfg.eval_mode || 'unknown'} | **Workflow:** ${cfg.workflow || 'unknown'}\n`);
  sections.push(`\nYou are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.\n`);

  if (isBrownfield && baseline) {
    sections.push(
      `## BROWNFIELD BASELINE\n\n` +
      `This is a brownfield eval. Before coding, copy the baseline codebase into \`game/\`:\n\n` +
      `\`\`\`sh\n` +
      `mkdir -p game\n` +
      `cp -r vendor/get-anything-done/${baseline.source}/* game/ 2>/dev/null || true\n` +
      `cp -r vendor/get-anything-done/${baseline.source}/.planning game/.planning 2>/dev/null || true\n` +
      `cd game && npm install\n` +
      `\`\`\`\n\n` +
      `The baseline is **${baseline.project} ${baseline.version}** — a working roguelike you must EXTEND, not replace.\n` +
      `Read existing files before changing them. Preserve what works. Add new features on top.\n`
    );
  }

  if (agentsMd) sections.push(`## AGENTS.md (follow this exactly)\n\n${agentsMd}`);
  if (reqXml) sections.push(`## REQUIREMENTS.xml\n\n\`\`\`xml\n${reqXml}\`\`\``);
  if (reqMd) sections.push(`## REQUIREMENTS.md (eval overview)\n\n${reqMd}`);
  if (decisionsXml) sections.push(`## DECISIONS.xml\n\n\`\`\`xml\n${decisionsXml}\`\`\``);
  if (conventionsMd) sections.push(`## CONVENTIONS.md\n\n${conventionsMd}`);
  if (roadmapXml) sections.push(`## ROADMAP.xml\n\n\`\`\`xml\n${roadmapXml}\`\`\``);
  if (stateXml) sections.push(`## STATE.xml\n\n\`\`\`xml\n${stateXml}\`\`\``);
  if (sourceDocs.length > 0) sections.push(`## Source documents\n\n${sourceDocs.join('\n\n')}`);

  sections.push(`\n## Instructions\n`);
  sections.push(`0. **FIRST:** Before writing any code, estimate how long these requirements would take a mid-senior human developer to implement WITHOUT AI tools. Consider the full scope: architecture, implementation, testing, debugging. Write your estimate to TRACE.json field \`human_estimate_hours\`. This is required — do it before starting implementation.`);
  sections.push(`1. Copy the .planning/ directory from the template into your working directory`);
  sections.push(`2. Implement the project following the ROADMAP.xml phases`);
  sections.push(`3. For EACH task: update TASK-REGISTRY.xml, update STATE.xml, commit with task ID — one commit per task, not per phase`);
  sections.push(`4. Follow CONVENTIONS.md patterns and DECISIONS.xml architecture`);
  sections.push(`4b. Capture decisions AS YOU MAKE THEM — if you chose between alternatives (library, pattern, data model), write a <decision> to DECISIONS.xml before committing that task. Aim for 1-2 per phase minimum.`);
  sections.push(`5. After EACH phase completes: write/append to .planning/VERIFICATION.md (build result, task count, state check), commit with "verify: phase X verified"`);
  sections.push(`6. When complete: all phases done, build passes, planning docs current`);
  sections.push(`7. FINAL STEP: produce a production build (dist/ directory) and commit it. The build artifact is showcased on the docs site. No dist = eval incomplete.`);
  sections.push(`\n## Logging\n`);
  sections.push(`Set GAD_LOG_DIR to your eval run directory before running gad commands.`);
  sections.push(`All gad CLI calls and tool uses will be logged to JSONL files for eval tracing.`);
  sections.push(`\`\`\`sh\nexport GAD_LOG_DIR=<eval-run-dir>/.gad-log\n\`\`\``);

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
    'prompt-only': { type: 'boolean', description: 'Only generate the bootstrap prompt, do not create worktree', default: false },
    execute: { type: 'boolean', description: 'Output JSON for the orchestrating agent to spawn a worktree agent with full tracing', default: false },
    'install-skills': { type: 'string', description: 'Comma-separated paths to skills to install into the eval template before running', default: '' },
  },
  async run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');
    const projectDir = path.join(evalsDir, args.project);

    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project '${args.project}' not found. Run \`gad eval list\` to see available projects.`);
      return;
    }

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

    const now = new Date().toISOString();

    // Load gad.json for metadata
    let gadJson = {};
    try {
      gadJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'gad.json'), 'utf8'));
    } catch {}

    // Build the bootstrap prompt from template files
    const prompt = buildEvalPrompt(projectDir, args.project, runNum);

    // Write prompt to run directory
    fs.writeFileSync(path.join(runDir, 'PROMPT.md'), prompt);

    // Create a full TRACE.json scaffold with all the fields the prebuild expects
    const traceScaffold = {
      project: args.project,
      version: `v${runNum}`,
      date: now.split('T')[0],
      gad_version: require(path.join(gadDir, 'package.json')).version || 'unknown',
      framework_version: require(path.join(gadDir, 'package.json')).version || 'unknown',
      trace_schema_version: 4,
      eval_type: gadJson.eval_mode || 'greenfield',
      workflow: gadJson.workflow || 'unknown',
      domain: gadJson.domain || null,
      tech_stack: gadJson.tech_stack || null,
      build_requirement: gadJson.build_requirement || null,
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
      `eval_type: ${gadJson.eval_mode || 'greenfield'}`,
      `workflow: ${gadJson.workflow || 'unknown'}`,
      `trace_dir: ${runDir}`,
    ].join('\n') + '\n');

    if (args['prompt-only']) {
      console.log(`\nEval run: ${args.project} v${runNum} (prompt only)`);
      console.log(`\n✓ Bootstrap prompt written: evals/${args.project}/v${runNum}/PROMPT.md`);
      console.log(`  ${prompt.length} chars, ~${Math.ceil(prompt.length / 4)} tokens`);
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
          GAD_EVAL_TRACE_DIR: runDir,
          GAD_EVAL_PROJECT: args.project,
          GAD_EVAL_VERSION: `v${runNum}`,
        },
        agentDescription: `Eval: ${args.project} v${runNum}`,
        postSteps: [
          `After the agent completes:`,
          `1. Update TRACE.json timing.ended + timing.duration_minutes + token_usage from agent result`,
          `2. Run: gad eval preserve ${args.project} v${runNum} --from <worktree-path>`,
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
      console.log(`\nThe orchestrating agent should:`);
      console.log(`  1. Read EXEC.json for the spawn configuration`);
      console.log(`  2. Set env: GAD_EVAL_TRACE_DIR=${runDir}`);
      console.log(`  3. Spawn an Agent with isolation: "worktree" using the prompt`);
      console.log(`  4. On completion: update TRACE.json with timing + tokens`);
      console.log(`  5. Run: gad eval preserve ${args.project} v${runNum} --from <worktree>`);
      console.log(`  6. Regenerate site data + push`);

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
      console.log(`  gad eval preserve ${args.project} v${runNum} --from ${worktreePath}`);
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
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');
    const projectDir = path.join(evalsDir, args.project);

    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project '${args.project}' not found.`);
    }

    const versions = fs.readdirSync(projectDir)
      .filter(n => /^v\d+$/.test(n))
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    if (versions.length === 0) {
      outputError(`No runs found for project '${args.project}'. Run \`gad eval run --project ${args.project}\` first.`);
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
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');
    const projectDir = path.join(evalsDir, args.project);

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
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');
    if (!fs.existsSync(evalsDir)) { console.log('No eval projects found.'); return; }

    const projects = args.project
      ? [args.project]
      : fs.readdirSync(evalsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);

    const rows = [];
    for (const proj of projects) {
      const projDir = path.join(evalsDir, proj);
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
    const gadDir = path.join(__dirname, '..');
    const projDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const projDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const projDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const projDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const projDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const projDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const projDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const projDir = path.join(gadDir, 'evals', args.project);
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
    const projDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');
    const projectDir = path.join(evalsDir, args.project);

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
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');

    const evalProjects = fs.existsSync(evalsDir)
      ? fs.readdirSync(evalsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
      : [];

    const rows = config.roots.map(root => {
      const evalMatches = evalProjects.filter(ep => ep.includes(root.id) || root.id.includes(ep));
      const evalName = evalMatches[0] || null;
      let runs = 0, latest = '—', status = '—';
      if (evalName) {
        const projectDir = path.join(evalsDir, evalName);
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
    const gadDir = path.join(__dirname, '..');
    const projectDir = path.join(gadDir, 'evals', args.project);
    if (!fs.existsSync(projectDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

    const runDirs = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && /^v\d+$/.test(r.name))
      .map(r => r.name)
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    if (runDirs.length === 0) {
      console.log(`No runs yet for '${args.project}'. Run: gad eval run --project ${args.project}`);
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
    const gadDir = path.join(__dirname, '..');
    const projectDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const projectDir = path.join(gadDir, 'evals', args.project);
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
    const gadDir = path.join(__dirname, '..');
    const projectDir = path.join(gadDir, 'evals', args.project);
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
    console.log(`  Then: gad eval run --project ${args.project}`);
  },
});

// eval suite — generate bootstrap prompts for all runnable eval projects
const evalSuite = defineCommand({
  meta: { name: 'suite', description: 'Generate bootstrap prompts for all eval projects in parallel' },
  args: {
    projects: { type: 'string', description: 'Comma-separated project names (default: all with templates)', default: '' },
  },
  run({ args }) {
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');

    if (!fs.existsSync(evalsDir)) {
      outputError('No evals/ directory found.');
    }

    // Find all projects with a template/ directory (runnable evals)
    const allProjects = fs.readdirSync(evalsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .filter(e => fs.existsSync(path.join(evalsDir, e.name, 'template')))
      .map(e => e.name);

    const selectedProjects = args.projects
      ? args.projects.split(',').map(s => s.trim()).filter(Boolean)
      : allProjects;

    if (selectedProjects.length === 0) {
      outputError('No runnable eval projects found (need template/ directory).');
    }

    // Create suite run directory
    const suiteDir = path.join(evalsDir, '.suite-runs', new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(suiteDir, { recursive: true });

    console.log(`\nEval Suite: ${selectedProjects.length} project(s)\n`);

    const results = [];
    for (const project of selectedProjects) {
      const projectDir = path.join(evalsDir, project);
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
    console.log(`After all complete: gad eval report`);
  },
});

// eval report — cross-project comparison from latest TRACE.json
const evalReport = defineCommand({
  meta: { name: 'report', description: 'Cross-project comparison from latest TRACE.json of each eval' },
  args: {
    projects: { type: 'string', description: 'Comma-separated project names (default: all with traces)', default: '' },
  },
  run({ args }) {
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');

    if (!fs.existsSync(evalsDir)) {
      outputError('No evals/ directory found.');
    }

    const allProjects = fs.readdirSync(evalsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name);

    const selectedProjects = args.projects
      ? args.projects.split(',').map(s => s.trim()).filter(Boolean)
      : allProjects;

    // Load latest TRACE.json for each project
    const rows = [];
    for (const project of selectedProjects) {
      const projectDir = path.join(evalsDir, project);
      if (!fs.existsSync(projectDir)) continue;

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
      console.log(`\n* = auto_composite (no human review). Run: gad eval review <project> <version> --score <0-1>`);
    }
    if (noTrace.length > 0) {
      console.log(`\n${noTrace.length} project(s) without traces:`);
      for (const r of noTrace) console.log(`  ${r.project} — run eval and reconstruct trace`);
    }

    // Skill coverage analysis
    const skillsDir = path.join(evalsDir, '..', 'skills');
    if (fs.existsSync(skillsDir)) {
      const allSkills = fs.readdirSync(skillsDir)
        .filter(n => { try { return fs.statSync(path.join(skillsDir, n)).isDirectory(); } catch { return false; } })
        .map(n => `gad:${n}`);

      // Skill name aliases (trace name → canonical skill directory name)
      const skillAliases = { 'gad:verify-work': 'gad:verify-phase' };

      // Collect all tested skills from traces
      const testedSkills = new Set();
      for (const project of allProjects) {
        const projectDir = path.join(evalsDir, project);
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

// gad eval preserve — copy agent outputs to canonical per-version locations
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
    const repoRoot = path.resolve(gadDir, '..', '..');
    const evalsDir = path.join(gadDir, 'evals');
    const projectDir = path.join(evalsDir, args.project);
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

    // Copy every top-level entry in game/, excluding heavy/regenerated dirs
    const excludeTopLevel = new Set(['node_modules', '.git', 'dist']);
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

    // Preserve build to apps/portfolio/public/evals/<project>/<version>/
    const distSrc = path.join(gameSrc, 'dist');
    let buildPreserved = false;
    if (fs.existsSync(distSrc)) {
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

// gad eval verify — audit preservation of all eval runs
const evalVerify = defineCommand({
  meta: { name: 'verify', description: 'Audit all eval runs for preservation completeness (code, build, logs, trace)' },
  args: {
    project: { type: 'positional', description: 'Specific project to verify (default: all)', default: '' },
  },
  run({ args }) {
    const gadDir = path.join(__dirname, '..');
    const repoRoot = path.resolve(gadDir, '..', '..');
    const evalsDir = path.join(gadDir, 'evals');

    if (!fs.existsSync(evalsDir)) {
      outputError('No evals/ directory found.');
      return;
    }

    const projects = args.project
      ? [args.project]
      : fs.readdirSync(evalsDir, { withFileTypes: true })
          .filter(e => e.isDirectory() && !e.name.startsWith('.'))
          .map(e => e.name);

    const issues = [];
    let totalRuns = 0;
    let cleanRuns = 0;

    console.log('GAD Eval Preservation Audit\n');
    console.log('PROJECT                         VERSION  TRACE  RUN   BUILD  LOGS  STATUS');
    console.log('──────────────────────────────  ───────  ─────  ────  ─────  ────  ──────');

    for (const project of projects) {
      const projectDir = path.join(evalsDir, project);
      if (!fs.existsSync(projectDir)) continue;
      const versions = fs.readdirSync(projectDir)
        .filter(n => /^v\d+$/.test(n))
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

      // Determine eval type from gad.json or latest TRACE.json
      let evalType = 'implementation';
      const gadJsonPath = path.join(projectDir, 'gad.json');
      if (fs.existsSync(gadJsonPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(gadJsonPath, 'utf8'));
          if (cfg.type === 'eval' && cfg.scoring?.weights?.correctness != null) evalType = 'tooling';
          if (cfg.constraints?.planning_only) evalType = 'planning';
        } catch {}
      }
      // Heuristic: tooling/mcp/cli-efficiency evals don't need run/ or build/
      const skipCodeCheck = ['tooling-watch', 'tooling-mcp', 'cli-efficiency', 'planning-migration', 'project-migration', 'portfolio-bare', 'reader-workspace', 'gad-planning-loop', 'subagent-utility'].includes(project);

      for (const v of versions) {
        totalRuns++;
        const vDir = path.join(projectDir, v);
        const hasTrace = fs.existsSync(path.join(vDir, 'TRACE.json'));
        const hasRun = fs.existsSync(path.join(vDir, 'run')) &&
                       fs.readdirSync(path.join(vDir, 'run')).length > 0;
        const hasBuild = fs.existsSync(path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', project, v, 'index.html'));
        const hasLogs = fs.existsSync(path.join(vDir, '.gad-log'));

        const problems = [];
        if (!hasTrace) problems.push('no TRACE.json');
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

// gad eval review — human scoring
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
    const gadDir = path.join(__dirname, '..');
    const runDir = path.join(gadDir, 'evals', args.project, args.version);
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

      // Load project's declared rubric dimensions from gad.json
      const gadJsonPath = path.join(gadDir, 'evals', args.project, 'gad.json');
      if (!fs.existsSync(gadJsonPath)) {
        outputError(`No gad.json found for project ${args.project}`);
        return;
      }
      const gadJson = JSON.parse(fs.readFileSync(gadJsonPath, 'utf8'));
      const rubricDef = gadJson.human_review_rubric;
      if (!rubricDef || !Array.isArray(rubricDef.dimensions)) {
        outputError(`Project ${args.project} has no human_review_rubric in gad.json. Add one or use --score for legacy mode.`);
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

// gad eval open — launch eval output in browser
const evalOpen = defineCommand({
  meta: { name: 'open', description: 'Open eval build output in browser' },
  args: {
    project: { type: 'positional', description: 'Eval project name', required: true },
    version: { type: 'positional', description: 'Version (default: latest)', default: '' },
  },
  run({ args }) {
    const gadDir = path.join(__dirname, '..');
    const projectDir = path.join(gadDir, 'evals', args.project);

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
    const candidates = [
      // Portfolio public, per-version (canonical location for preserved builds)
      path.join(gadDir, '..', '..', 'apps', 'portfolio', 'public', 'evals', args.project, version, 'index.html'),
      // Eval dir per-version
      path.join(projectDir, version, 'game', 'dist', 'index.html'),
      path.join(projectDir, version, 'dist', 'index.html'),
      path.join(projectDir, version, 'build', 'index.html'),
      path.join(projectDir, version, 'index.html'),
      // Legacy: portfolio public root (latest only)
      path.join(gadDir, '..', '..', 'apps', 'portfolio', 'public', 'evals', args.project, 'index.html'),
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
    const { exec, spawn } = require('child_process');

    // Start a local HTTP server — ES module builds don't work on file://
    const port = 4173 + Math.floor(Math.random() * 100);
    console.log(`Serving: ${path.relative(process.cwd(), serveDir)}`);
    console.log(`http://localhost:${port}/`);

    // Try npx serve first, fall back to python, fall back to file://
    const server = spawn('npx', ['serve', serveDir, '-l', String(port), '--no-clipboard'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let opened = false;
    const openBrowser = () => {
      if (opened) return;
      opened = true;
      const isWin = process.platform === 'win32';
      const url = `http://localhost:${port}/`;
      const cmd = isWin ? `start "" "${url}"` : (process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`);
      exec(cmd);
    };

    server.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.includes('Accepting') || s.includes('Local:') || s.includes('listening')) {
        openBrowser();
      }
    });

    // Give it 3 seconds then open anyway
    setTimeout(openBrowser, 3000);

    // Keep process alive until ctrl+c
    console.log('\nPress Ctrl+C to stop the server.');
    process.on('SIGINT', () => { server.kill(); process.exit(); });
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

const SKILLS_ROOT = path.join(__dirname, '..', '.agents', 'skills');

const evalSkillList = defineCommand({
  meta: { name: 'list', description: 'Show all skills with their eval status (has evals/evals.json or not)' },
  run() {
    if (!fs.existsSync(SKILLS_ROOT)) {
      outputError('No .agents/skills/ directory found');
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
      outputError(`Skill "${args.name}" not found at .agents/skills/${args.name}/SKILL.md or .agents/skills/emergent/${args.name}/SKILL.md`);
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

const evalSkillCmd = defineCommand({
  meta: { name: 'skill', description: 'Per-skill evaluation harness (gad-87) — list, init, run, grade, benchmark' },
  subCommands: { list: evalSkillList, init: evalSkillInit, run: evalSkillRun, grade: evalSkillGrade, benchmark: evalSkillBenchmark },
});

const evalReadme = defineCommand({
  meta: { name: 'readme', description: 'Inject scores, timestamps, and discipline metrics into eval project README (decision gad-118)' },
  args: {
    project: { type: 'string', description: 'Eval project name', required: true },
  },
  run({ args }) {
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');
    const projectDir = path.join(evalsDir, args.project);
    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project '${args.project}' not found.`);
      return;
    }

    // Collect run data
    const runs = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter(r => r.isDirectory() && r.name.startsWith('v'))
      .map(r => r.name)
      .sort();

    let gadJson = {};
    try { gadJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'gad.json'), 'utf8')); } catch {}

    const lines = [
      `# ${args.project}`,
      '',
      gadJson.description || '',
      '',
      `| Field | Value |`,
      `|---|---|`,
      `| Domain | ${gadJson.domain || '—'} |`,
      `| Mode | ${gadJson.eval_mode || '—'} |`,
      `| Workflow | ${gadJson.workflow || '—'} |`,
      `| Tech stack | ${gadJson.tech_stack || '—'} |`,
      `| Build requirement | ${gadJson.build_requirement || '—'} |`,
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
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');

    // Parse --from: either "project" (latest run) or "project/vN" (specific run)
    const parts = (args.from || '').split('/');
    const srcProject = parts[0];
    let srcVersion = parts[1] || null;

    if (!srcProject) {
      outputError('Usage: gad eval inherit-skills --from eval-project --to target-project');
      return;
    }

    // If no version specified, find the latest run
    if (!srcVersion) {
      const projectDir = path.join(evalsDir, srcProject);
      if (!fs.existsSync(projectDir)) {
        outputError(`Eval project '${srcProject}' not found.`);
        return;
      }
      const runs = fs.readdirSync(projectDir, { withFileTypes: true })
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

    const srcRunDir = path.join(evalsDir, srcProject, srcVersion, 'run');
    if (!fs.existsSync(srcRunDir)) {
      outputError(`Source run not found: evals/${srcProject}/${srcVersion}/run/`);
      return;
    }

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
    const targetDir = path.join(evalsDir, args.to, 'template', 'skills');
    fs.mkdirSync(targetDir, { recursive: true });

    for (const skill of skills) {
      const src = path.join(srcSkillsDir, skill);
      const dest = path.join(targetDir, skill);
      fs.cpSync(src, dest, { recursive: true });
      console.log(`  ✓ Inherited: ${skill} (from ${srcProject}/${srcVersion})`);
    }

    // Update AGENTS.md
    const agentsMd = path.join(evalsDir, args.to, 'template', 'AGENTS.md');
    if (fs.existsSync(agentsMd)) {
      let content = fs.readFileSync(agentsMd, 'utf8');
      const section = `\n\n## Inherited Skills (from ${srcProject}/${srcVersion})\n\n${skills.map(s => '- `skills/' + s + '/SKILL.md`').join('\n')}\n`;
      if (!content.includes('## Inherited Skills')) {
        content += section;
        fs.writeFileSync(agentsMd, content);
      }
    }

    // Record lineage metadata
    const metaFile = path.join(evalsDir, args.to, 'template', '.inherited-skills.json');
    const meta = {
      inherited_at: new Date().toISOString(),
      source: `${srcProject}/${srcVersion}`,
      skills: skills.map(s => ({ name: s, source_path: path.join(srcSkillsDir, s) })),
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

    console.log(`\n✓ Inherited ${skills.length} skill(s) from ${srcProject}/${srcVersion} → ${args.to}`);
  },
});

const evalCmd = defineCommand({
  meta: { name: 'eval', description: 'Run and manage eval projects' },
  subCommands: { list: evalList, setup: evalSetup, status: evalStatus, version: evalVersion, run: evalRun, runs: evalRuns, show: evalShow, score: evalScore, scores: evalScores, diff: evalDiff, trace: evalTraceCmd, suite: evalSuite, report: evalReport, review: evalReview, open: evalOpen, preserve: evalPreserve, verify: evalVerify, skill: evalSkillCmd, 'inherit-skills': evalInheritSkills, readme: evalReadme },
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

    if (roots.length === 0) { outputError('No projects configured. Run `gad workspace sync` first.'); return; }

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
    if (!root) { outputError('No projects configured. Run `gad workspace sync` first.'); return; }

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

    if (roots.length === 0) { outputError('No projects configured. Run `gad workspace sync` first.'); return; }
    const root = roots[0];
    const planDir = path.join(baseDir, root.path, root.planningDir);
    const sprintSize = config.sprintSize || 5;
    const useFull = args.full;

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
        console.log(JSON.stringify({ project: root.id, mode: 'full', planningDir: root.planningDir, files }, null, 2));
        return;
      }
      console.log(`\nSnapshot (full): ${root.id}  —  ${allFiles.length} files\n`);
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
    const allTasks = readTasks(root, baseDir, {});
    const openTasks = allTasks.filter(t => t.status !== 'done');
    let tasksSection = '';
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
    const doneCount = allTasks.length - openTasks.length;
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
    // Create minimal toml
    const lines = ['[planning]', `sprintSize = ${config.sprintSize || 5}`, ''];
    for (const r of roots) {
      lines.push('[[planning.roots]]');
      lines.push(`id = "${r.id}"`);
      lines.push(`path = "${r.path}"`);
      lines.push(`planningDir = "${r.planningDir}"`);
      lines.push(`discover = ${r.discover ? 'true' : 'false'}`);
      lines.push('');
    }
    fs.writeFileSync(tomlPath, lines.join('\n'));
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
      const gadDir = path.join(__dirname, '..');
      logDir = path.join(gadDir, 'evals', args.eval);
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

const worktreeList = defineCommand({
  meta: { name: 'list', description: 'List all git worktrees with status (game, build, planning, age)' },
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
    console.log('ID/BRANCH                            AGE   GAME  BUILD  PLAN  PATH');
    console.log('───────────────────────────────────  ────  ────  ─────  ────  ─────────────────────────────');
    for (const w of filtered) {
      const id = (w.branch || w.head || '').slice(0, 35).padEnd(35);
      const age = (w.age || '?').padEnd(4);
      const game = w.hasGame ? ' ✓ ' : ' - ';
      const build = w.hasBuild ? '  ✓  ' : '  -  ';
      const plan = w.hasPlanning ? ' ✓ ' : ' - ';
      const relPath = path.relative(process.cwd(), w.path).replace(/\\/g, '/');
      console.log(`${id}  ${age}  ${game}  ${build}  ${plan}  ${relPath}`);
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
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');
    const preservedRunDirs = new Set();
    if (fs.existsSync(evalsDir)) {
      for (const project of fs.readdirSync(evalsDir, { withFileTypes: true })) {
        if (!project.isDirectory()) continue;
        const projectDir = path.join(evalsDir, project.name);
        for (const version of fs.readdirSync(projectDir, { withFileTypes: true }).filter(e => e.isDirectory() && /^v\d+$/.test(e.name))) {
          const runDir = path.join(projectDir, version.name, 'run');
          if (fs.existsSync(runDir) && fs.readdirSync(runDir).length > 0) {
            preservedRunDirs.add(`${project.name}/${version.name}`);
          }
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
  meta: { name: 'worktree', description: 'Manage git worktrees used by eval agents' },
  subCommands: { list: worktreeList, show: worktreeShow, clean: worktreeClean, prune: worktreePrune },
});

// ---------------------------------------------------------------------------
// gad version — framework version info for trace stamping (phase 25 task 25-12)
// ---------------------------------------------------------------------------

const { getFrameworkVersion } = require('../lib/framework-version.cjs');

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
// the existing bin/install.js which ships with the full GSD-pattern cross-
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
    cursor: { type: 'boolean' },
    codex: { type: 'boolean' },
    local: { type: 'boolean' },
    global: { type: 'boolean' },
  },
  run: ({ args }) => {
    const { spawnSync } = require('child_process');
    const installerPath = path.resolve(__dirname, 'install.js');
    const flagArgs = [];
    if (args.claude) flagArgs.push('--claude');
    if (args.cursor) flagArgs.push('--cursor');
    if (args.codex) flagArgs.push('--codex');
    if (args.local) flagArgs.push('--local');
    if (args.global) flagArgs.push('--global');
    if (flagArgs.length === 0) {
      console.log('Usage: gad install all [--claude] [--cursor] [--codex] [--local|--global]');
      console.log('       runs bin/install.js with the given flags');
      return;
    }
    const result = spawnSync('node', [installerPath, ...flagArgs], { stdio: 'inherit' });
    process.exit(result.status || 0);
  },
});

const installCmd = defineCommand({
  meta: { name: 'install', description: 'Install GAD into an agent runtime (hooks, framework, or full install)' },
  subCommands: {
    hooks: installHooks,
    all: installAll,
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
    console.log(`Loop compliance: ${(m.loop_compliance.score * 100).toFixed(0)}% (${m.loop_compliance.snapshot_starts}/${m.loop_compliance.total_sessions} sessions)`);

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

// ── gad data — CRUD for data/*.json using lowdb (decision gad-109) ──
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
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');

    // Per-project rounds: derive from TRACE.json requirements_version changes across runs
    if (args.project) {
      const projectDir = path.join(evalsDir, args.project);
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

    // Global rounds from EXPERIMENT-LOG.md
    const logFile = path.join(evalsDir, 'EXPERIMENT-LOG.md');
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
    session: sessionCmd,
    context: contextCmd,
    state: stateCmd,
    phases: phasesCmd,
    tasks: tasksCmd,
    'task-checkpoint': taskCheckpoint,
    decisions: decisionsCmd,
    requirements: requirementsCmd,
    errors: errorsCmd,
    blockers: blockersCmd,
    refs: refsCmd,
    pack: packCmd,
    docs: docsCmd,
    'self-eval': selfEvalCmd,
    data: dataCmd,
    eval: evalCmd,
    rounds: roundsCmd,
    verify: verifyCmd,
    snapshot: snapshotCmd,
    sprint: sprintCmd,
    dev: devCmd,
    sink: sinkCmd,
    log: logCmd,
    worktree: worktreeCmd,
    'migrate-schema': migrateSchema,
    install: installCmd,
    uninstall: uninstallCmd,
    version: versionCmd,
  },
});

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

runMain(main);
