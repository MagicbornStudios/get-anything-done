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
 */

const { defineCommand, runMain, createMain } = require('citty');
const path = require('path');
const fs = require('fs');

const gadConfig = require('./gad-config.cjs');
const { render, shouldUseJson } = require('../lib/table.cjs');
const { readState } = require('../lib/state-reader.cjs');
const { readPhases } = require('../lib/roadmap-reader.cjs');
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

const projectsList = defineCommand({
  meta: { name: 'list', description: 'List all registered projects' },
  run() {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);

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

const projectsCmd = defineCommand({
  meta: { name: 'projects', description: 'List or initialize projects' },
  subCommands: {
    list: projectsList,
    init: projectsInit,
  },
});

// ---------------------------------------------------------------------------
// state command
// ---------------------------------------------------------------------------

const stateCmd = defineCommand({
  meta: { name: 'state', description: 'Show current state for all projects' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);

    let roots = config.roots;
    if (args.projectid) {
      roots = roots.filter(r => r.id === args.projectid);
      if (roots.length === 0) outputError(`Project not found: ${args.projectid}`);
    }

    const rows = roots.map(root => {
      const state = readState(root, baseDir);
      return {
        project: root.id,
        phase: state.phasesTotal > 0 ? `${state.phasesComplete}/${state.phasesTotal}` : (state.currentPhase || '—'),
        milestone: state.milestone || '—',
        status: state.status,
        'open tasks': state.openTasks > 0 ? String(state.openTasks) : '—',
        'last activity': state.lastActivity || '—',
      };
    });

    const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
    console.log(render(rows, { format: fmt, title: 'GAD State' }));
  },
});

// ---------------------------------------------------------------------------
// phases command
// ---------------------------------------------------------------------------

const phasesCmd = defineCommand({
  meta: { name: 'phases', description: 'List phases from ROADMAP.md' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);

    let roots = config.roots;
    if (args.projectid) {
      roots = roots.filter(r => r.id === args.projectid);
      if (roots.length === 0) outputError(`Project not found: ${args.projectid}`);
    }

    const rows = [];
    for (const root of roots) {
      const phases = readPhases(root, baseDir);
      if (phases.length === 0) continue;
      for (const phase of phases) {
        rows.push({
          project: root.id,
          id: phase.id,
          status: phase.status,
          title: phase.title.length > 60 ? phase.title.slice(0, 57) + '...' : phase.title,
        });
      }
    }

    if (rows.length === 0) {
      console.log('No phases found. Create ROADMAP.md files in your .planning/ directories.');
      return;
    }

    const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
    console.log(render(rows, { format: fmt, title: `Phases (${rows.length})` }));
  },
});

// ---------------------------------------------------------------------------
// tasks command (read-only — CRUD via slash commands)
// ---------------------------------------------------------------------------

const tasksCmd = defineCommand({
  meta: { name: 'tasks', description: 'Show open tasks from STATE.md' },
  args: {
    projectid: { type: 'string', description: 'Scope to one project', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);

    let roots = config.roots;
    if (args.projectid) {
      roots = roots.filter(r => r.id === args.projectid);
      if (roots.length === 0) outputError(`Project not found: ${args.projectid}`);
    }

    const rows = [];
    for (const root of roots) {
      const state = readState(root, baseDir);
      const stateFile = path.join(baseDir, root.path, root.planningDir, 'STATE.md');
      if (!fs.existsSync(stateFile)) continue;

      const content = fs.readFileSync(stateFile, 'utf8');
      // Extract task table rows: | task-id | description | status |
      const tableRe = /\|\s*([^\|]+)\s*\|\s*([^\|]+)\s*\|\s*([^\|]+)\s*\|/g;
      let m;
      let inTaskTable = false;
      for (const line of content.split('\n')) {
        if (/task|status/i.test(line) && line.includes('|')) inTaskTable = true;
        if (inTaskTable && line.trim().startsWith('|') && !line.includes('---')) {
          const cols = line.split('|').map(c => c.trim()).filter(Boolean);
          if (cols.length >= 2 && !cols[0].toLowerCase().includes('task') && !cols[0].toLowerCase().includes('id')) {
            const status = cols[2] || cols[1] || '';
            if (!status.toLowerCase().includes('done') && !status.toLowerCase().includes('complete')) {
              rows.push({
                project: root.id,
                id: cols[0],
                description: (cols[1] || '').slice(0, 50),
                status: status.slice(0, 20),
              });
            }
          }
        }
        if (inTaskTable && line.trim() === '') inTaskTable = false;
      }
    }

    if (rows.length === 0) {
      console.log('No open tasks found.');
      return;
    }

    const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
    console.log(render(rows, { format: fmt, title: `Open Tasks (${rows.length})` }));
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
      const { compiled, warnings } = compileDocs(config, { sink, baseDir, verbose: args.verbose });
      for (const w of warnings) {
        console.warn(`  ⚠ ${w}`);
      }
      console.log(`\n✓ Compiled ${compiled} files`);
    } catch (e) {
      outputError(e.message);
    }
  },
});

const docsCmd = defineCommand({
  meta: { name: 'docs', description: 'Compile or watch planning docs' },
  subCommands: { compile: docsCompile },
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
    project: { type: 'string', description: 'Eval project name', required: true },
    baseline: { type: 'string', description: 'Git baseline (default: HEAD)', default: 'HEAD' },
  },
  async run({ args }) {
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
    project: { type: 'string', description: 'Eval project name', required: true },
    version: { type: 'string', description: 'Version to score (default: latest)', default: '' },
  },
  run({ args }) {
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
    v1: { type: 'positional', description: 'First version (e.g. v1)', required: true },
    v2: { type: 'positional', description: 'Second version (e.g. v2)', required: true },
    project: { type: 'string', description: 'Eval project name', required: true },
  },
  run({ args }) {
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

const evalCmd = defineCommand({
  meta: { name: 'eval', description: 'Run and manage eval projects' },
  subCommands: { list: evalList, run: evalRun, score: evalScore, diff: evalDiff },
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
// Root command
// ---------------------------------------------------------------------------

const main = defineCommand({
  meta: {
    name: 'gad',
    description: 'Planning CLI for get-anything-done',
    version: pkg.version,
  },
  subCommands: {
    workspace: workspaceCmd,
    projects: projectsCmd,
    state: stateCmd,
    phases: phasesCmd,
    tasks: tasksCmd,
    docs: docsCmd,
    eval: evalCmd,
    'migrate-schema': migrateSchema,
  },
});

runMain(main);
