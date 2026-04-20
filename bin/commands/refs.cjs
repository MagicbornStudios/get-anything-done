'use strict';
/**
 * gad refs — list / verify / migrate / watch.
 * Bare `gad refs` runs the same list as `gad refs list`.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots,
 *   render, shouldUseJson,
 *   readDecisions, readRequirements, readPhases, readDocFlow, readDocsMap,
 *   planningRefVerify
 */

const fs = require('fs');
const { defineCommand } = require('citty');

function createRefsCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots,
    render, shouldUseJson,
    readDecisions, readRequirements, readPhases, readDocFlow, readDocsMap,
    planningRefVerify, outputError,
  } = deps;

  function runRefsList(args) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots(args, baseDir, config.roots);
    if (roots.length === 0) return;

    const rows = [];
    for (const root of roots) {
      if (!args.source || args.source === 'decisions') {
        const decisions = readDecisions(root, baseDir);
        for (const d of decisions) {
          for (const ref of d.references) {
            rows.push({ project: root.id, source: 'decisions', via: d.id, path: ref });
          }
        }
      }
      if (!args.source || args.source === 'requirements') {
        const reqs = readRequirements(root, baseDir);
        for (const r of reqs) {
          if (r.docPath) {
            rows.push({ project: root.id, source: 'requirements', via: r.kind, path: r.docPath });
          }
        }
      }
      if (!args.source || args.source === 'phases') {
        const phases = readPhases(root, baseDir);
        for (const p of phases) {
          if (p.plans) {
            rows.push({ project: root.id, source: 'phases', via: `phase-${p.id}`, path: p.plans });
          }
        }
        const docFlow = readDocFlow(root, baseDir);
        for (const d of docFlow) {
          rows.push({ project: root.id, source: 'doc-flow', via: 'roadmap', path: d.name });
        }
      }
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
    run({ args }) { runRefsList(args); },
  });

  const refsVerifyCmd = defineCommand({
    meta: { name: 'verify', description: 'Verify <file path> and <reference> paths in planning XML exist on disk (refactor safety)' },
    args: { json: { type: 'boolean', description: 'JSON output', default: false } },
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
    meta: { name: 'migrate', description: 'Replace a path string with another across all planning XML (use after renames; like multi-file find-replace)' },
    args: {
      from: { type: 'string', description: 'Old path substring (forward slashes, e.g. src/old/Module.tsx)', default: '' },
      to: { type: 'string', description: 'New path substring', default: '' },
      apply: { type: 'boolean', description: 'Write files (default: dry-run only)', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const from = (args.from || '').trim();
      const to = (args.to || '').trim();
      if (!from) { outputError('Missing --from <path>'); return; }
      const { changedFiles, replacements } = planningRefVerify.migratePathStringsInPlanningXml(
        baseDir,
        from.replace(/\\/g, '/'),
        to.replace(/\\/g, '/'),
        { dryRun: !args.apply },
      );
      if (replacements === 0) { console.log('No occurrences found in planning XML.'); return; }
      console.log(
        args.apply
          ? `Updated ${replacements} occurrence(s) in ${changedFiles.length} file(s).`
          : `Dry-run: would replace ${replacements} occurrence(s) in ${changedFiles.length} file(s). Re-run with --apply to write.`,
      );
      for (const f of changedFiles) console.log(`  ${f}`);
      if (!args.apply) console.log('\nTip: review the diff, then: gad refs migrate --from ... --to ... --apply');
    },
  });

  const refsWatchCmd = defineCommand({
    meta: { name: 'watch', description: 'Re-run refs verify when planning XML changes (debounced; keeps terminal open)' },
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
          for (const row of result.missing) console.error(`  ${row.path} ← ${row.file}`);
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
        const watcher = fs.watch(baseDir, { recursive: true }, (event, filename) => {
          if (!filename) return;
          const n = filename.replace(/\\/g, '/');
          if (!n.includes('.planning/') || !n.endsWith('.xml')) return;
          schedule(event);
        });
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

  return defineCommand({
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
}

module.exports = { createRefsCommand };
module.exports.register = (ctx) => ({ refs: createRefsCommand(ctx.common) });
