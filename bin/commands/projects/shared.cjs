'use strict';

const fs = require('fs');
const path = require('path');

function findTomlPath(baseDir, resolveTomlPath) {
  const resolved = resolveTomlPath(baseDir);
  if (resolved) return resolved;
  return path.join(baseDir, '.planning', 'gad-config.toml');
}

function normalizePath(p) {
  return p.replace(/\\/g, '/').replace(/\/$/, '') || '.';
}

function writeRootsToToml(baseDir, roots, config, deps) {
  const tomlPath = findTomlPath(baseDir, deps.resolveTomlPath);
  if (!fs.existsSync(tomlPath)) {
    const lines = ['[planning]', `sprintSize = ${config.sprintSize || 5}`, ''];
    lines.push('[features]');
    lines.push('# Graph-backed queries for targeted lookups (~12.9x token savings).');
    lines.push('# Set to false to fall back to raw XML reads.');
    lines.push('useGraphQuery = true');
    lines.push('');
    for (const root of roots) {
      lines.push('[[planning.roots]]');
      lines.push(`id = "${root.id}"`);
      lines.push(`path = "${root.path}"`);
      lines.push(`planningDir = "${root.planningDir}"`);
      lines.push(`discover = ${root.discover ? 'true' : 'false'}`);
      lines.push('');
    }
    fs.writeFileSync(tomlPath, lines.join('\n'));
    try { deps.gadConfig.writeCompatJson(baseDir, { ...config, roots }); } catch {}
    return;
  }

  let toml = fs.readFileSync(tomlPath, 'utf8');
  toml = toml.replace(/\[\[planning\.roots\]\][\s\S]*?(?=\[\[|\[(?!planning\.roots)|$)/g, '').trimEnd();
  const rootsSection = roots.map((root) => [
    '',
    '[[planning.roots]]',
    `id = "${root.id}"`,
    `path = "${root.path}"`,
    `planningDir = "${root.planningDir}"`,
    `discover = ${root.discover ? 'true' : 'false'}`,
  ].join('\n')).join('\n');

  fs.writeFileSync(tomlPath, `${toml}\n${rootsSection}\n`);
  try { deps.gadConfig.writeCompatJson(baseDir, { ...config, roots }); } catch {}
}

function appendIgnoreToToml(baseDir, pattern, deps) {
  const tomlPath = findTomlPath(baseDir, deps.resolveTomlPath);
  if (!fs.existsSync(tomlPath)) return;
  let toml = fs.readFileSync(tomlPath, 'utf8');
  if (/ignore\s*=\s*\[/.test(toml)) {
    toml = toml.replace(/(ignore\s*=\s*\[[\s\S]*?)(\])/, `$1  "${pattern}",\n$2`);
  } else {
    toml += `\nignore = ["${pattern}"]\n`;
  }
  fs.writeFileSync(tomlPath, toml);
  try {
    const nextConfig = deps.gadConfig.load(baseDir);
    deps.gadConfig.writeCompatJson(baseDir, nextConfig);
  } catch {}
}

function crawlPlanningDirs(baseDir, ignore) {
  const results = [];
  const ignoreRe = ignore.map((pattern) => {
    const escaped = pattern
      .replace(/\*\*/g, '(.*)')
      .replace(/\*/g, '([^/]*)')
      .replace(/\?/g, '[^/]');
    return new RegExp(escaped);
  });

  function crawl(dir, rel) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (ignoreRe.some((re) => re.test(childRel))) continue;
      if (entry.name === '.planning') {
        results.push(rel || '.');
        continue;
      }
      crawl(path.join(dir, entry.name), childRel);
    }
  }

  crawl(baseDir, '');
  return results;
}

function listProjects(baseDir, config, readState, output) {
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
    return {
      minimumPresent: [],
      minimumMissing: CANONICAL_MINIMUM_FILES.slice(),
      optionalPresent: [],
      legacyPresent: [],
    };
  }

  const entries = fs.readdirSync(planDir, { withFileTypes: true });
  const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const dirs = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));

  const minimumPresent = CANONICAL_MINIMUM_FILES.filter((file) => files.has(file));
  const minimumMissing = CANONICAL_MINIMUM_FILES.filter((file) => !files.has(file));
  const optionalPresent = CANONICAL_OPTIONAL_FILES.filter((file) => files.has(file));

  const legacyPresent = [];
  for (const [name, reason] of CANONICAL_LEGACY_FILES) {
    if (files.has(name)) legacyPresent.push({ name, kind: 'file', reason });
  }
  for (const [name, reason] of CANONICAL_LEGACY_DIRS) {
    if (dirs.has(name)) legacyPresent.push({ name, kind: 'dir', reason });
  }

  return { minimumPresent, minimumMissing, optionalPresent, legacyPresent };
}

module.exports = {
  appendIgnoreToToml,
  CANONICAL_MINIMUM_FILES,
  computeCanonicalShape,
  crawlPlanningDirs,
  findTomlPath,
  INIT_XML_FILES,
  INIT_XML_TEMPLATES,
  listProjects,
  normalizePath,
  REQUIRED_FILES_BY_FORMAT,
  RECOMMENDED_FILES,
  writeRootsToToml,
};
