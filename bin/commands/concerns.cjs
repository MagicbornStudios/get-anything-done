'use strict';
/**
 * gad concerns — code-VCS landmark CLI (Phase 155).
 *
 * Subcommands:
 *   build  — scan project tree for // @concern markers, write
 *            <planningDir>/concerns.json sidecar manifest
 *   list   — show all concerns + their primary file
 *   show <id>  — show full record for one concern
 *   lint   — print violations (duplicate ids, multiple concerns/file)
 *   add <id> --file <path>  — insert a // @concern marker at top of file
 *
 * The comment is the source of truth (// @concern stripe.checkout).
 * Sidecar manifest is a derived index — rebuild any time the tree
 * changes via gad concerns build.
 */

const fs = require('node:fs');
const path = require('node:path');
const { defineCommand } = require('citty');
const { buildManifest, scanProject } = require('../../lib/concerns/scan.cjs');

function resolveProjectInfo(deps) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  const projects = (config.roots || []).map((r) => ({
    projectId: r.id,
    rootPath: path.resolve(baseDir, r.path || '.'),
    planningDir: r.planningDir || '.planning',
  }));
  return { baseDir, config, projects };
}

function loadManifest(planningDir) {
  const p = path.join(planningDir, 'concerns.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

function createConcernsCommand(deps) {
  const buildCmd = defineCommand({
    meta: { name: 'build', description: 'Scan project for @concern markers, write sidecar manifest at .planning/concerns.json' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project (default all)', default: '' },
    },
    run({ args }) {
      const { baseDir, projects } = resolveProjectInfo(deps);
      const targets = args.projectid
        ? projects.filter((p) => p.projectId === args.projectid)
        : projects;
      if (targets.length === 0) { deps.outputError('No matching projects.'); process.exit(1); return; }

      let totalConcerns = 0, totalViolations = 0;
      for (const project of targets) {
        const planningDir = path.join(project.rootPath, project.planningDir);
        if (!fs.existsSync(planningDir)) continue;
        try {
          const result = buildManifest({ rootPath: project.rootPath, planningDir });
          const c = result.manifest.concern_count;
          const v = result.manifest.violations.length;
          const f = result.manifest.file_count;
          console.log(`[concerns] ${project.projectId}: ${c} concerns from ${f.with_concerns}/${f.scanned} files (${v} violations)`);
          if (v > 0) console.log(`  → ${path.relative(baseDir, result.out_path)}`);
          totalConcerns += c;
          totalViolations += v;
        } catch (e) {
          deps.outputError(`scan failed for ${project.projectId}: ${e.message}`);
        }
      }
      console.log(`\n[concerns] total ${totalConcerns} concerns, ${totalViolations} violations across ${targets.length} project(s)`);
    },
  });

  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List all known concerns and their primary file' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', required: true },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { baseDir, projects } = resolveProjectInfo(deps);
      const project = projects.find((p) => p.projectId === args.projectid);
      if (!project) { deps.outputError(`No project: ${args.projectid}`); process.exit(1); return; }
      const planningDir = path.join(project.rootPath, project.planningDir);
      const manifest = loadManifest(planningDir);
      if (!manifest) { deps.outputError(`No concerns.json. Run \`gad concerns build --projectid ${args.projectid}\` first.`); return; }
      if (args.json) { console.log(JSON.stringify(manifest, null, 2)); return; }
      const ids = Object.keys(manifest.concerns).sort();
      console.log(`${ids.length} concern(s) in ${project.projectId}:`);
      for (const id of ids) {
        const locs = manifest.concerns[id];
        const primary = locs[0];
        const summary = primary.summary ? `  — ${primary.summary}` : '';
        console.log(`  ${id.padEnd(36)} ${primary.file}:${primary.line}${summary}`);
      }
    },
  });

  const showCmd = defineCommand({
    meta: { name: 'show', description: 'Show full record for one concern id' },
    args: {
      id: { type: 'positional', description: 'Concern id (e.g. stripe.checkout)', required: true },
      projectid: { type: 'string', description: 'Project id', required: true },
    },
    run({ args }) {
      const { projects } = resolveProjectInfo(deps);
      const project = projects.find((p) => p.projectId === args.projectid);
      if (!project) { deps.outputError(`No project: ${args.projectid}`); process.exit(1); return; }
      const manifest = loadManifest(path.join(project.rootPath, project.planningDir));
      if (!manifest) { deps.outputError('No manifest. Run `gad concerns build` first.'); return; }
      const record = manifest.concerns[args.id];
      if (!record) { deps.outputError(`Concern not found: ${args.id}`); return; }
      console.log(`\n${args.id}`);
      for (const loc of record) {
        console.log(`  ${loc.file}:${loc.line}${loc.summary ? '  — ' + loc.summary : ''}`);
      }
      if (record.length > 1) console.log(`\n[!] duplicate id — ${record.length} files claim this concern`);
    },
  });

  const lintCmd = defineCommand({
    meta: { name: 'lint', description: 'Print one-file-per-concern violations and duplicate-id collisions' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { baseDir, projects } = resolveProjectInfo(deps);
      const targets = args.projectid
        ? projects.filter((p) => p.projectId === args.projectid)
        : projects;
      const all = [];
      for (const project of targets) {
        const m = loadManifest(path.join(project.rootPath, project.planningDir));
        if (!m) continue;
        for (const v of (m.violations || [])) {
          all.push({ project: project.projectId, ...v });
        }
      }
      if (args.json) { console.log(JSON.stringify(all, null, 2)); return; }
      if (all.length === 0) { console.log('No concern violations across scanned roots.'); return; }
      console.log(`${all.length} violation(s):`);
      for (const v of all) {
        if (v.kind === 'duplicate_concern_id') {
          console.log(`  [${v.project}] DUP   ${v.id}  (${v.locations.length} files)`);
          for (const l of v.locations) console.log(`         ${l.file}:${l.line}`);
        } else if (v.kind === 'multiple_concerns_in_file') {
          console.log(`  [${v.project}] MULTI ${v.file}  (${v.ids.join(', ')})`);
        }
      }
    },
  });

  const addCmd = defineCommand({
    meta: { name: 'add', description: 'Insert a // @concern marker at top of a file' },
    args: {
      id: { type: 'positional', description: 'Concern id (dot-separated, e.g. stripe.checkout)', required: true },
      file: { type: 'string', description: 'Target file path', required: true },
      summary: { type: 'string', description: 'Optional summary text', default: '' },
    },
    run({ args }) {
      const filePath = path.resolve(args.file);
      if (!fs.existsSync(filePath)) { deps.outputError(`File not found: ${args.file}`); process.exit(1); return; }
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes(`@concern ${args.id}`)) {
        console.log(`@concern ${args.id} already present in ${args.file}`);
        return;
      }
      const ext = path.extname(filePath);
      const commentChar = (ext === '.py' || ext === '.sh') ? '#' : '//';
      const marker = args.summary
        ? `${commentChar} @concern ${args.id} -- ${args.summary}\n`
        : `${commentChar} @concern ${args.id}\n`;
      // Insert after shebang or "use strict" if present, else top
      const lines = content.split(/\r?\n/);
      let insertAt = 0;
      if (lines[0] && (lines[0].startsWith('#!') || lines[0].startsWith("'use strict'") || lines[0].startsWith('"use strict"'))) {
        insertAt = 1;
        if (lines[1] === '' || (lines[1] && lines[1].trim() === '')) insertAt = 2;
      }
      const out = [...lines.slice(0, insertAt), marker.trimEnd(), ...lines.slice(insertAt)].join('\n');
      fs.writeFileSync(filePath, out);
      console.log(`Added @concern ${args.id} to ${args.file}`);
    },
  });

  return defineCommand({
    meta: {
      name: 'concerns',
      description: 'Code-VCS — stable @concern landmarks (Phase 155). Build manifest, list, show, lint, add markers.',
    },
    subCommands: {
      build: buildCmd,
      list: listCmd,
      show: showCmd,
      lint: lintCmd,
      add: addCmd,
    },
  });
}

module.exports = { createConcernsCommand };
module.exports.register = (ctx) => {
  const cmd = createConcernsCommand(ctx.common);
  return { concerns: cmd };
};
