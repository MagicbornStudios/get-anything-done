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
 */

const { defineCommand, runMain, createMain } = require('citty');
const path = require('path');
const fs = require('fs');

const gadConfig = require('./gad-config.cjs');
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

const pkg = require('../package.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve repo root from cwd (looks for planning-config.toml up the tree). */
function findRepoRoot(start) {
  let dir = start || process.cwd();
  for (let i = 0; i < 10; i++) {
    if (
      fs.existsSync(path.join(dir, 'planning-config.toml')) ||
      fs.existsSync(path.join(dir, '.planning', 'planning-config.toml')) ||
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

function output(rows, opts = {}) {
  const fmt = shouldUseJson() ? 'json' : (opts.format || 'table');
  console.log(render(rows, { ...opts, format: fmt }));
}

function outputError(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

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
  meta: { name: 'sync', description: 'Crawl repo for .planning/ dirs and sync planning-config.toml' },
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
    console.log(`✓ planning-config.toml updated — ${updatedRoots.length} roots registered`);
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
    const templateDir = path.join(__dirname, '..', 'get-shit-done', 'templates');
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
      console.log(`  Registered as [${id}] in planning-config.toml`);
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
      // Table: truncate summary for readability
      const tableRows = rows.map(r => ({
        project: r.project,
        id: r.id,
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
// refs command — aggregate all file references across planning files
// ---------------------------------------------------------------------------

const refsCmd = defineCommand({
  meta: { name: 'refs', description: 'List all file references across planning files (decisions, requirements, phases)' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
    source: { type: 'string', description: 'Filter by source: decisions|requirements|phases|docs-map', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
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
          id: t.id,
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
      outputError('No docs_sink configured. Pass --sink <path> or set docs_sink in planning-config.toml.');
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
      console.log('No docs found. Create DOCS-MAP.xml or add docs.projects to planning-config.toml.');
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
      .filter(e => e.isDirectory())
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
            const m = fs.readFileSync(runMd, 'utf8').match(/status:\s*(\w+)/);
            if (m) status = m[1];
          }
        }
        return { name: e.name, runs: runs.length, latest, status };
      });

    output(projects, { title: 'GAD Eval Projects' });
    console.log(`\n${projects.length} project(s), ${projects.reduce((s, p) => s + p.runs, 0)} total runs`);
  },
});

const evalRun = defineCommand({
  meta: { name: 'run', description: 'Run eval project in isolated git worktree' },
  args: {
    project: { type: 'string', description: 'Eval project name', default: '' },
    baseline: { type: 'string', description: 'Git baseline (default: HEAD)', default: 'HEAD' },
  },
  async run({ args }) {
    if (!args.project) { listEvalProjectsHint(); return; }
    const { execSync } = require('child_process');
    const gadDir = path.join(__dirname, '..');
    const evalsDir = path.join(gadDir, 'evals');
    const projectDir = path.join(evalsDir, args.project);

    if (!fs.existsSync(projectDir)) {
      outputError(`Eval project '${args.project}' not found. Run \`gad eval list\` to see available projects.`);
    }

    // Next run number
    const runs = fs.existsSync(projectDir)
      ? fs.readdirSync(projectDir).filter(n => /^v\d+$/.test(n)).map(n => parseInt(n.slice(1), 10))
      : [];
    const runNum = runs.length > 0 ? Math.max(...runs) + 1 : 1;
    const runDir = path.join(projectDir, `v${runNum}`);
    fs.mkdirSync(runDir, { recursive: true });

    // Create worktree
    const worktreePath = path.join(require('os').tmpdir(), `gad-eval-${args.project}-${Date.now()}`);
    const now = new Date().toISOString();

    // Write RUN.md
    fs.writeFileSync(path.join(runDir, 'RUN.md'), [
      `# Eval Run v${runNum}`,
      '',
      `project: ${args.project}`,
      `baseline: ${args.baseline}`,
      `started: ${now}`,
      `status: running`,
    ].join('\n') + '\n');

    console.log(`\nEval run: ${args.project} v${runNum}`);
    console.log(`Baseline: ${args.baseline}`);

    try {
      execSync(`git worktree add "${worktreePath}" "${args.baseline}"`, { stdio: 'pipe' });
      console.log(`✓ Worktree created: ${worktreePath}`);

      // Stub: agent invocation
      fs.writeFileSync(path.join(runDir, 'eval-output.txt'),
        `STUB: eval run for ${args.project} v${runNum} at ${now}\n`);
      console.log(`  (stub) Agent run completed`);

    } finally {
      try {
        execSync(`git worktree remove --force "${worktreePath}"`, { stdio: 'pipe' });
        console.log(`✓ Worktree removed`);
      } catch {}
    }

    // Update RUN.md with result
    const endTime = new Date().toISOString();
    const runMd = fs.readFileSync(path.join(runDir, 'RUN.md'), 'utf8');
    fs.writeFileSync(path.join(runDir, 'RUN.md'),
      runMd.replace('status: running', `status: completed\nended: ${endTime}`));

    console.log(`\n✓ Eval run complete`);
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

    const trace = {
      eval: args.project,
      version: `v${nextVersion}`,
      date: new Date().toISOString().split('T')[0],
      gad_version: require('../package.json').version || '1.0.0',
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

    // Composite
    const s = trace.scores;
    if (s.cli_efficiency != null && s.skill_accuracy != null && s.planning_quality != null && s.time_efficiency != null) {
      s.composite = (s.cli_efficiency * 0.25) + (s.skill_accuracy * 0.25) + (s.planning_quality * 0.30) + (s.time_efficiency * 0.20);
    }

    fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
    console.log(`\n✓ Trace finalized: evals/${args.project}/${runs[0].name}/TRACE.json`);
    console.log(`\n  Duration:         ${trace.timing.duration_minutes} min`);
    console.log(`  Phases completed: ${trace.timing.phases_completed}`);
    console.log(`  Tasks completed:  ${trace.timing.tasks_completed}`);
    console.log(`  CLI efficiency:   ${s.cli_efficiency?.toFixed(3) ?? '—'}`);
    console.log(`  Skill accuracy:   ${s.skill_accuracy?.toFixed(3) ?? '—'}`);
    console.log(`  Planning quality: ${s.planning_quality?.toFixed(3) ?? '—'}`);
    console.log(`  Time efficiency:  ${s.time_efficiency?.toFixed(3) ?? '—'}`);
    console.log(`  Composite:        ${s.composite?.toFixed(3) ?? '—'}`);
  },
});

const evalTraceCmd = defineCommand({
  meta: { name: 'trace', description: 'Inspect and compare eval traces (TRACE.json)' },
  subCommands: { list: evalTraceList, show: evalTraceShow, diff: evalTraceDiff, report: evalTraceReport, write: evalTraceWrite, init: evalTraceInit, 'log-cmd': evalTraceLogCmd, 'log-skill': evalTraceLogSkill, finalize: evalTraceFinalize },
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
            const m = fs.readFileSync(runMd, 'utf8').match(/status:\s*(\w+)/);
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
        const mv = content.match(/status:\s*(\w+)/); if (mv) status = mv[1];
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

const evalCmd = defineCommand({
  meta: { name: 'eval', description: 'Run and manage eval projects' },
  subCommands: { list: evalList, setup: evalSetup, status: evalStatus, version: evalVersion, run: evalRun, runs: evalRuns, show: evalShow, score: evalScore, scores: evalScores, diff: evalDiff, trace: evalTraceCmd },
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
        console.error(`Project not found: ${args.project}`);
        console.error(`Available: ${config.roots.map(r => r.id).join(', ')}`);
        process.exit(1);
      }
    }

    if (roots.length === 0) { outputError('No projects configured. Run `gad workspace sync` first.'); return; }
    const root = roots[0];
    const planDir = path.join(baseDir, root.path, root.planningDir);

    // Collect all planning files — named files first, then phases/, then rest
    const PRIORITY = ['AGENTS.md', 'STATE.md', 'STATE.xml', 'ROADMAP.md', 'ROADMAP.xml',
      'REQUIREMENTS.md', 'REQUIREMENTS.xml', 'DECISIONS.xml', 'TASK-REGISTRY.xml',
      'session.md', 'ERRORS-AND-ATTEMPTS.xml'];

    const allFiles = [];
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

    // Sort: priority files first, then phases/, then alphabetical
    allFiles.sort((a, b) => {
      const aBase = path.basename(a);
      const bBase = path.basename(b);
      const aIdx = PRIORITY.indexOf(aBase);
      const bIdx = PRIORITY.indexOf(bBase);
      if (aIdx !== -1 && bIdx === -1) return -1;
      if (bIdx !== -1 && aIdx === -1) return 1;
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      return a.localeCompare(b);
    });

    if (args.json || shouldUseJson()) {
      const files = allFiles.map(rel => {
        let content = null;
        try { content = fs.readFileSync(path.join(planDir, rel), 'utf8'); } catch { /* skip */ }
        return { path: `${root.planningDir}/${rel}`, content };
      });
      console.log(JSON.stringify({ project: root.id, planningDir: root.planningDir, files }, null, 2));
      return;
    }

    console.log(`\nSnapshot: ${root.id}  (${root.planningDir})  —  ${allFiles.length} files\n`);
    for (const rel of allFiles) {
      const filePath = path.join(planDir, rel);
      console.log(`${'═'.repeat(70)}`);
      console.log(`## ${root.planningDir}/${rel}`);
      console.log(`${'═'.repeat(70)}`);
      try {
        console.log(fs.readFileSync(filePath, 'utf8'));
      } catch {
        console.log(`(unreadable)`);
      }
      console.log('');
    }
    console.log(`═══ end snapshot (${allFiles.length} files) ═══`);
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
  const root = path.join(baseDir, 'planning-config.toml');
  const nested = path.join(baseDir, '.planning', 'planning-config.toml');
  if (fs.existsSync(root)) return root;
  if (fs.existsSync(nested)) return nested;
  return nested; // Default to .planning/ location
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
//   gad sink status     — diff between planning state and docs sink
//   gad sink compile    — write planning state → docs MDX (manual trigger)
//   gad sink decompile  — pull docs MDX → planning state (reverse)
//   gad sink validate   — check all sink mappings are well-formed

function getSink(config) {
  if (!config.docs_sink) {
    outputError('No docs_sink configured in planning-config.toml. Add: docs_sink = "apps/portfolio/content/docs"');
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
    if (needSync > 0) console.log(`\n${needSync} file(s) need sync. Run \`gad sink compile\` to update.`);
    else console.log('\n✓ All generated sink files are up to date.');
    if (humanAuthored > 0) console.log(`${humanAuthored} human-authored sink file(s) — not managed by compile.`);
  },
});

const sinkCompile = defineCommand({
  meta: { name: 'compile', description: 'Compile .planning/ XML files → docs sink MDX' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Compile all projects', default: false },
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
      const n = compileDocs2(baseDir, root, sink) || 0;
      if (n > 0) console.log(`  ✓ ${root.id}: ${n} file(s)`);
      compiled += n;
    }
    console.log(`\n✓ Sink compile: ${compiled} file(s) written to ${sink}`);
  },
});

const sinkSync = defineCommand({
  meta: { name: 'sync', description: 'Sync all planning files to sink (compile all, non-destructive)' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    all: { type: 'boolean', description: 'Sync all projects (default when no session)', default: false },
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
      const n = compileDocs2(baseDir, root, sink) || 0;
      console.log(`  ${n > 0 ? '✓' : '–'} ${root.id}: ${n} file(s) written`);
      compiled += n;
    }
    console.log(`\n✓ Sync complete: ${compiled} file(s) updated in ${sink}`);
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
  subCommands: { status: sinkStatus, compile: sinkCompile, sync: sinkSync, decompile: sinkDecompile, validate: sinkValidate },
});

// ---------------------------------------------------------------------------
// Root command
// ---------------------------------------------------------------------------

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
    decisions: decisionsCmd,
    requirements: requirementsCmd,
    errors: errorsCmd,
    blockers: blockersCmd,
    refs: refsCmd,
    pack: packCmd,
    docs: docsCmd,
    eval: evalCmd,
    snapshot: snapshotCmd,
    sink: sinkCmd,
    'migrate-schema': migrateSchema,
  },
});

runMain(main);
