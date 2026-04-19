'use strict';
/**
 * gad sink — manage docs sink (sync, compile, decompile, status, validate)
 *
 * Required deps: findRepoRoot, gadConfig, resolveRoots, outputError, output, stampSinkCompileNote
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

const SINK_SOURCE_MAP = [
  { srcs: ['STATE.xml', 'STATE.md'],                 sink: 'state.mdx' },
  { srcs: ['ROADMAP.xml', 'ROADMAP.md'],             sink: 'roadmap.mdx' },
  { srcs: ['DECISIONS.xml', 'DECISIONS.md'],         sink: 'decisions.mdx' },
  { srcs: ['TASK-REGISTRY.xml', 'TASK-REGISTRY.md'], sink: 'task-registry.mdx' },
  { srcs: ['REQUIREMENTS.xml', 'REQUIREMENTS.md'],   sink: 'requirements.mdx' },
  { srcs: ['ERRORS-AND-ATTEMPTS.xml'],               sink: 'errors-and-attempts.mdx' },
  { srcs: ['BLOCKERS.xml'],                          sink: 'blockers.mdx' },
];

function createSinkCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError, output, stampSinkCompileNote } = deps;

  function getSink(config) {
    if (!config.docs_sink) {
      outputError('No docs_sink configured in gad-config.toml. Add: docs_sink = "apps/portfolio/content/docs"');
      return null;
    }
    return config.docs_sink;
  }

  const status = defineCommand({
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
          const srcFile = srcs.find(s => fs.existsSync(path.join(planDir, s)));
          if (!srcFile) continue;
          const srcPath  = path.join(planDir, srcFile);
          const destPath = path.join(baseDir, sink, root.id, 'planning', sinkName);
          const { isGenerated } = require('../../lib/docs-compiler.cjs');
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

  const diff = defineCommand({
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

      const { diffSink } = require('../../lib/docs-compiler.cjs');
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
      if (totalChanged === 0) { console.log(`\n✓ Sink diff: no content changes (sink matches compile output — ${sink})`); return; }
      console.log(`\n${totalChanged} file(s) differ from compiled output.`);
      if (totalForce > 0) console.log(`${totalForce} of those need \`gad sink compile --force\` to overwrite (not generated on disk).`);
      console.log('Review the output above, then run `gad sink compile` or `gad sink compile --force` as needed.');
      process.exit(1);
    },
  });

  const compile = defineCommand({
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

      const { compile: compileDocs2 } = require('../../lib/docs-compiler.cjs');
      let compiled = 0;
      for (const root of roots) {
        stampSinkCompileNote(root, baseDir, sink, new Date().toISOString());
        const n = compileDocs2(baseDir, root, sink, { force: args.force }) || 0;
        if (n > 0) console.log(`  ✓ ${root.id}: ${n} file(s)`);
        compiled += n;
      }
      const forceNote = args.force ? ' (including non-generated sink files)' : '';
      console.log(`\n✓ Sink compile: ${compiled} file(s) written to ${sink}${forceNote}`);
    },
  });

  const sync = defineCommand({
    meta: { name: 'sync', description: 'Sync all planning files to sink (compile all, non-destructive)' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Sync all projects (default when no session)', default: false },
      force: { type: 'boolean', description: 'Overwrite sink MDX even when not tagged generated (use after gad sink diff)', default: false },
    },
    run({ args }) {
      args.all = args.all || !args.projectid;
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const sink = getSink(config); if (!sink) return;
      const roots = resolveRoots(args, baseDir, config.roots);

      const { compile: compileDocs2 } = require('../../lib/docs-compiler.cjs');
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

  const decompile = defineCommand({
    meta: { name: 'decompile', description: 'Ensure .planning/ dirs exist for all projects; create stubs for missing source files' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Decompile all projects', default: false },
    },
    run({ args }) {
      args.all = args.all || !args.projectid;
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const sink = getSink(config); if (!sink) return;
      const roots = resolveRoots(args, baseDir, config.roots);

      const { decompile } = require('../../lib/docs-compiler.cjs');
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

  const validate = defineCommand({
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

  return defineCommand({
    meta: { name: 'sink', description: 'Manage docs sink — sync, compile, decompile, status, validate' },
    subCommands: { status, diff, compile, sync, decompile, validate },
  });
}

module.exports = { createSinkCommand };
