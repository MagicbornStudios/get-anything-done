'use strict';
/**
 * `gad projects …` and `gad workspace …` (deprecated alias) command family,
 * plus `gad ls` shortcut.
 *
 * Subcommands: list, init, audit, create, edit, archive, sync, add, ignore.
 *
 * Required deps: findRepoRoot, gadConfig, resolveTomlPath, fs, path,
 *   output, outputError, shouldUseJson, readState, evalDataAccess.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createProjectsCommands(deps) {
  const {
    findRepoRoot,
    gadConfig,
    resolveTomlPath,
    output,
    shouldUseJson,
    readState,
    evalDataAccess,
  } = deps;

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
    toml = toml.replace(/\[\[planning\.roots\]\][\s\S]*?(?=\[\[|\[(?!planning\.roots)|$)/g, '').trimEnd();
    const rootsSection = roots.map((r) => [
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

  function crawlPlanningDirs(baseDir, ignore) {
    const results = [];
    const ignoreRe = ignore.map((p) => {
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
        if (ignoreRe.some((re) => re.test(childRel))) continue;
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

  function listProjects(baseDir, config) {
    const rows = config.roots.map((root) => {
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

  const projectsSync = defineCommand({
    meta: { name: 'sync', description: 'Crawl repo for .planning/ dirs and sync gad-config.toml roots' },
    args: {
      yes: { type: 'boolean', alias: 'y', description: 'Apply changes without prompting', default: false },
    },
    async run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);

      const found = crawlPlanningDirs(baseDir, config.ignore || []);

      const existingPaths = new Set(config.roots.map((r) => normalizePath(r.path)));
      const newPaths = found.filter((p) => !existingPaths.has(normalizePath(p)));
      const missingPaths = config.roots.filter((r) => {
        const planDir = path.join(baseDir, r.path, r.planningDir);
        return !fs.existsSync(planDir);
      });

      if (newPaths.length === 0 && missingPaths.length === 0) {
        console.log(`✓ Projects up to date — ${config.roots.length} roots registered`);
        return;
      }

      console.log('\nProjects sync\n');
      for (const r of config.roots) {
        const missing = missingPaths.find((m) => m.id === r.id);
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
        console.log('Run with --yes to apply changes.');
        return;
      }

      const updatedRoots = config.roots.filter((r) => !missingPaths.find((m) => m.id === r.id));
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

      const existing = config.roots.find((r) => normalizePath(r.path) === normalizePath(addPath));
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

  const projectsList = defineCommand({
    meta: { name: 'list', description: 'List all registered projects' },
    run() {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      listProjects(baseDir, config);
    },
  });

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
      name: { type: 'string', description: 'Project display name (default: folder name)', default: '' },
      projectid: { type: 'string', description: 'Project id (default: slug of --name)', default: '' },
      path: { type: 'string', description: 'Project path (default: cwd)', default: '' },
      format: { type: 'string', description: 'Scaffold format: xml (default) or md (legacy)', default: 'xml' },
      force: { type: 'boolean', description: 'Overwrite existing files', default: false },
    },
    run({ args }) {
      // Walk up from the target project path, not from the CLI's cwd (task 44-13).
      const projectPath = path.resolve(args.path || process.cwd());
      const baseDir = findRepoRoot(projectPath);
      const config = gadConfig.load(baseDir);
      const projectName = args.name || path.basename(projectPath);
      const projectId = (args.projectid || projectName).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const planDir = path.join(projectPath, '.planning');
      const format = (args.format || 'xml').toLowerCase();

      if (format !== 'xml' && format !== 'md') {
        console.error(`✗ Unknown --format "${args.format}". Expected xml or md.`);
        process.exitCode = 1;
        return;
      }

      fs.mkdirSync(planDir, { recursive: true });

      const targets = format === 'xml'
        ? INIT_XML_FILES.slice()
        : ['STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md', 'PROJECT.md', 'TASK-REGISTRY.xml', 'DECISIONS.xml', 'ERRORS-AND-ATTEMPTS.xml'];

      const collisions = targets.filter((f) => fs.existsSync(path.join(planDir, f)));
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
        const templateDir = path.join(__dirname, '..', '..', 'templates');
        const mdStarters = [
          ['state.md', 'STATE.md'],
          ['roadmap.md', 'ROADMAP.md'],
          ['requirements.md', 'REQUIREMENTS.md'],
          ['project.md', 'PROJECT.md'],
        ];
        for (const [tmpl, destName] of mdStarters) {
          const dest = path.join(planDir, destName);
          const src = path.join(templateDir, tmpl);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
          } else {
            fs.writeFileSync(dest, `# ${destName.replace('.md', '')}\n\nProject: ${projectName}\n`);
          }
          written.push(destName);
        }
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

      const relPath = normalizePath(path.relative(baseDir, projectPath) || '.');
      if (!config.roots.find((r) => normalizePath(r.path) === relPath)) {
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

  const REQUIRED_FILES_BY_FORMAT = {
    xml: ['STATE.xml', 'ROADMAP.xml'],
    md: ['STATE.md', 'ROADMAP.md'],
  };
  const RECOMMENDED_FILES = ['DECISIONS.xml', 'DECISIONS.md', 'AGENTS.md', 'REQUIREMENTS.xml', 'REQUIREMENTS.md'];

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
    ['gad.json', 'renamed to species.json in phase 43 / task 42.4-14'],
    ['PROJECT.md', 'legacy markdown scaffold; use PROJECT.xml (reserved) or leave absent'],
    ['STATE.md', 'use STATE.xml (canonical XML shape)'],
    ['ROADMAP.md', 'use ROADMAP.xml (canonical XML shape)'],
    ['DECISIONS.md', 'use DECISIONS.xml (canonical XML shape)'],
    ['REQUIREMENTS.md', 'use REQUIREMENTS.xml (canonical XML shape)'],
    ['config.json', 'superseded by repo-root gad-config.toml in phase 41'],
    ['REPOPLANNER-TO-GAD-MIGRATION-GAPS.md', 'one-shot migration note, safe to archive'],
  ];
  const CANONICAL_LEGACY_DIRS = [
    ['skills', 'project-local skill staging is deprecated — use .planning/proto-skills/ per decision gad-183'],
  ];

  function computeCanonicalShape(planDir) {
    if (!fs.existsSync(planDir)) {
      return { minimumPresent: [], minimumMissing: CANONICAL_MINIMUM_FILES.slice(), optionalPresent: [], legacyPresent: [] };
    }
    const entries = fs.readdirSync(planDir, { withFileTypes: true });
    const files = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
    const dirs = new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));

    const minimumPresent = CANONICAL_MINIMUM_FILES.filter((f) => files.has(f));
    const minimumMissing = CANONICAL_MINIMUM_FILES.filter((f) => !files.has(f));
    const optionalPresent = CANONICAL_OPTIONAL_FILES.filter((f) => files.has(f));

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
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const sink = config.docs_sink;
      let roots = config.roots;
      if (args.project) roots = roots.filter((r) => r.id === args.project);

      const { isGenerated } = require('../../lib/docs-compiler.cjs');
      const results = [];

      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        const checks = [];

        const dirExists = fs.existsSync(planDir);
        checks.push({ check: 'planning_dir_exists', pass: dirExists, detail: dirExists ? planDir : `missing: ${planDir}` });
        if (!dirExists) { results.push({ project: root.id, checks }); continue; }

        const filesPresent = fs.readdirSync(planDir);
        const hasXml = REQUIRED_FILES_BY_FORMAT.xml.every((f) => filesPresent.includes(f));
        const hasMd = REQUIRED_FILES_BY_FORMAT.md.every((f) => filesPresent.includes(f));
        const hasRequired = hasXml || hasMd;
        const detectedFormat = hasXml ? 'xml' : hasMd ? 'md' : 'unknown';
        checks.push({ check: 'required_files', pass: hasRequired, detail: hasRequired ? `format=${detectedFormat}` : `missing STATE+ROADMAP (checked xml and md)` });

        const missingRec = RECOMMENDED_FILES.filter((f) => !filesPresent.includes(f));
        const hasRec = missingRec.length < RECOMMENDED_FILES.length;
        checks.push({ check: 'recommended_files', pass: hasRec, detail: hasRec ? `present` : `none of: ${RECOMMENDED_FILES.join(', ')}` });

        if (sink) {
          const sinkPlanDir = path.join(baseDir, sink, root.id, 'planning');
          const sinkExists = fs.existsSync(sinkPlanDir);
          if (!sinkExists) {
            checks.push({ check: 'sink_exists', pass: false, detail: `no sink dir: ${sink}/${root.id}/planning/` });
          } else {
            const sinkFiles = fs.readdirSync(sinkPlanDir).filter((f) => f.endsWith('.mdx'));
            const generatedCount = sinkFiles.filter((f) => isGenerated(path.join(sinkPlanDir, f))).length;
            const humanCount = sinkFiles.length - generatedCount;
            checks.push({ check: 'sink_exists', pass: true, detail: `${sinkFiles.length} mdx (${humanCount} human, ${generatedCount} generated)` });

            const stale = [];
            for (const srcName of filesPresent.filter((f) => /\.(xml|md)$/.test(f))) {
              const srcPath = path.join(planDir, srcName);
              const sinkName = srcName.replace(/\.(xml|md)$/, '.mdx').toLowerCase();
              const sinkPath = path.join(sinkPlanDir, sinkName);
              if (fs.existsSync(sinkPath)) {
                const srcMtime = fs.statSync(srcPath).mtimeMs;
                const sinkMtime = fs.statSync(sinkPath).mtimeMs;
                if (srcMtime > sinkMtime && isGenerated(sinkPath)) stale.push(srcName);
              }
            }
            checks.push({ check: 'sink_fresh', pass: stale.length === 0, detail: stale.length === 0 ? 'all generated files current' : `stale: ${stale.join(', ')}` });
          }
        }

        // 5. Canonical planning-root shape (task 42.4-09, decision gad-185).
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
            : `legacy: ${shape.legacyPresent.map((l) => `${l.name} (${l.reason})`).join('; ')}`,
        });

        results.push({ project: root.id, format: detectedFormat, checks, shape });
      }

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      const rows = [];
      for (const r of results) {
        for (const c of r.checks) {
          rows.push({ project: r.project, check: c.check, pass: c.pass ? '✓' : '✗', detail: c.detail });
        }
      }
      output(rows, { title: `Projects Audit (${results.length} projects)` });

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
          console.log(`    legacy:   ${m.legacyPresent.map((l) => l.name).join(', ')}`);
        }
      }

      const failed = results.flatMap((r) => r.checks).filter((c) => !c.pass).length;
      console.log(failed === 0 ? '\n✓ All checks passed.' : `\n${failed} check(s) failed.`);
    },
  });

  const projectsCreate = defineCommand({
    meta: { name: 'create', description: 'Create a new eval project' },
    args: {
      id: { type: 'string', description: 'Project id (kebab-case)', required: true },
      name: { type: 'string', description: 'Display name', default: '' },
      description: { type: 'string', description: 'Project description', default: '' },
      domain: { type: 'string', description: 'Domain (game, site, cli, etc.)', default: '' },
      techStack: { type: 'string', description: 'Tech stack (kaplay, next.js, etc.)', default: '' },
      root: { type: 'string', description: 'Target eval root id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
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
    meta: { name: 'edit', description: "Update an existing eval project's metadata" },
    args: {
      id: { type: 'string', description: 'Project id', required: true },
      name: { type: 'string', description: 'Display name', default: '' },
      description: { type: 'string', description: 'Description', default: '' },
      domain: { type: 'string', description: 'Domain', default: '' },
      techStack: { type: 'string', description: 'Tech stack', default: '' },
      tagline: { type: 'string', description: 'Tagline', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
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
      id: { type: 'string', description: 'Project id', required: true },
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

  return { projectsCmd, workspaceCmd, lsCmd };
}

module.exports = { createProjectsCommands };
