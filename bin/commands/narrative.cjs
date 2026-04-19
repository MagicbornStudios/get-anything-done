'use strict';
/**
 * gad narrative — list / enter. No deps from gad.cjs scope; pulls from
 * lib/narrative.cjs and walks up from cwd for monorepo root.
 */

const { defineCommand } = require('citty');

function createNarrativeCommand() {
  const narrativeListCmd = defineCommand({
    meta: { name: 'list', description: 'List GAD projects that have a narrative/ folder with an active soul.' },
    args: { json: { type: 'boolean', description: 'JSON output', default: false } },
    run({ args }) {
      const { monorepoRoot, listNarratives } = require('../../lib/narrative.cjs');
      const repoRoot = monorepoRoot(process.cwd());
      if (!repoRoot) {
        console.error('No gad-config.toml found walking up from cwd.');
        process.exit(1);
      }
      const rows = listNarratives(repoRoot);
      if (args.json) { console.log(JSON.stringify(rows, null, 2)); return; }
      if (rows.length === 0) { console.log('No projects with a narrative/ folder.'); return; }
      console.log('PROJECT             ACTIVE SOUL        BOOKS  NARRATIVE PATH');
      console.log('──────────────────  ─────────────────  ─────  ──────────────────────');
      for (const r of rows) {
        const p = require('node:path').relative(repoRoot, r.narrativeDir) || r.narrativeDir;
        console.log(
          `${r.projectId.padEnd(18).slice(0, 18)}  ${(r.activeSoul || '(none)').padEnd(17).slice(0, 17)}  ${String(r.bookCount).padStart(5)}  ${p}`,
        );
      }
    },
  });

  const narrativeEnterCmd = defineCommand({
    meta: {
      name: 'enter',
      description: 'Print active soul + book table of contents for a narrative. Explicit entry point — does not auto-load in coding sessions.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id (matches gad-config.toml [[planning.roots]] id).' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const projectId = args.projectid || args._?.[0];
      if (!projectId) {
        console.error('Usage: gad narrative enter --projectid <id>  (or: gad narrative enter <id>)');
        process.exit(1);
      }
      const { monorepoRoot, enterNarrative } = require('../../lib/narrative.cjs');
      const repoRoot = monorepoRoot(process.cwd());
      if (!repoRoot) {
        console.error('No gad-config.toml found walking up from cwd.');
        process.exit(1);
      }
      const result = enterNarrative(repoRoot, projectId);
      if (!result.ok) {
        console.error(`Cannot enter narrative for "${projectId}": ${result.reason}`);
        process.exit(1);
      }
      if (args.json) { console.log(JSON.stringify(result, null, 2)); return; }
      const path = require('node:path');
      console.log(`── NARRATIVE: ${result.projectId} — soul: ${result.activeSoul} ──`);
      console.log('');
      console.log(result.soulBody);
      if (result.books.length > 0) {
        console.log('');
        console.log('── BOOKS ─────────────────────────────────────────────');
        for (const b of result.books) {
          const rel = path.relative(repoRoot, path.resolve(result.narrativeDir, b.path));
          console.log(`  ${String(b.order).padStart(2)}. ${b.title}`);
          console.log(`      ${rel}`);
        }
      }
    },
  });

  return defineCommand({
    meta: {
      name: 'narrative',
      description: 'Enter a GAD project narrative — books, souls, in-world docs. Explicit only; not auto-read by coding agents.',
    },
    subCommands: { list: narrativeListCmd, enter: narrativeEnterCmd },
  });
}

module.exports = { createNarrativeCommand };
