'use strict';

const { defineCommand } = require('citty');
const { resolveSinkScope, stampSinkCompileNote } = require('./shared.cjs');

function createSinkCompileCommand({ findRepoRoot, gadConfig, resolveRoots, outputError }) {
  return defineCommand({
    meta: { name: 'compile', description: 'Compile .planning/ sources -> docs sink MDX (per-task JSON + XML fallback + decisions + state)' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Compile all projects', default: false },
      only: { type: 'string', description: 'Comma-separated project ids to include (ad-hoc override)', default: '' },
      ignore: { type: 'string', description: 'Comma-separated project ids to skip for this run (in addition to config)', default: '' },
      force: { type: 'boolean', description: 'Overwrite sink MDX even when not tagged generated (use after gad sink diff)', default: false },
      verbose: { type: 'boolean', alias: 'v', description: 'Verbose output', default: false },
    },
    run({ args }) {
      const scope = resolveSinkScope(args, findRepoRoot, gadConfig, resolveRoots, outputError);
      if (!scope || scope.roots.length === 0) return;
      const { baseDir, config, roots, sink } = scope;

      const configIgnore = new Set(config.docs_sink_ignore || []);
      const cliIgnore = new Set((args.ignore || '').split(',').map((s) => s.trim()).filter(Boolean));
      const cliOnly = new Set((args.only || '').split(',').map((s) => s.trim()).filter(Boolean));

      const filteredRoots = roots.filter((root) => {
        if (cliOnly.size > 0) {
          if (cliOnly.has(root.id)) return true;
          if (args.verbose) console.log(`  [skip] ${root.id} (not in --only)`);
          return false;
        }
        if (root.enabled === false) {
          if (args.verbose) console.log(`  [skip] ${root.id} (enabled=false)`);
          return false;
        }
        if (configIgnore.has(root.id)) {
          if (args.verbose) console.log(`  [skip] ${root.id} (docs_sink_ignore)`);
          return false;
        }
        if (cliIgnore.has(root.id)) {
          if (args.verbose) console.log(`  [skip] ${root.id} (--ignore)`);
          return false;
        }
        return true;
      });

      if (filteredRoots.length === 0) {
        console.log('No roots to compile after filtering.');
        return;
      }

      const { compile } = require('../../../lib/docs-compiler.cjs');
      let compiled = 0;
      for (const root of filteredRoots) {
        stampSinkCompileNote(root, baseDir, sink, new Date().toISOString());
        const count = compile(baseDir, root, sink, { force: args.force }) || 0;
        if (count > 0 || args.verbose) console.log(`  OK ${root.id}: ${count} file(s)`);
        compiled += count;
      }
      const forceNote = args.force ? ' (including non-generated sink files)' : '';
      const skippedCount = roots.length - filteredRoots.length;
      const skipNote = skippedCount > 0 ? ` (${skippedCount} skipped)` : '';
      console.log(`\nOK Sink compile: ${compiled} file(s) written to ${sink}${forceNote}${skipNote}`);
    },
  });
}

module.exports = { createSinkCompileCommand };
