'use strict';

const { defineCommand } = require('citty');
const { resolveSinkScope, stampSinkCompileNote } = require('./shared.cjs');

function createSinkCompileCommand({ findRepoRoot, gadConfig, resolveRoots, outputError }) {
  return defineCommand({
    meta: { name: 'compile', description: 'Compile .planning/ sources -> docs sink MDX (per-task JSON + XML fallback + decisions + state)' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Compile all projects', default: false },
      force: { type: 'boolean', description: 'Overwrite sink MDX even when not tagged generated (use after gad sink diff)', default: false },
    },
    run({ args }) {
      const scope = resolveSinkScope(args, findRepoRoot, gadConfig, resolveRoots, outputError);
      if (!scope || scope.roots.length === 0) return;
      const { baseDir, roots, sink } = scope;
      const { compile } = require('../../../lib/docs-compiler.cjs');
      let compiled = 0;
      for (const root of roots) {
        stampSinkCompileNote(root, baseDir, sink, new Date().toISOString());
        const count = compile(baseDir, root, sink, { force: args.force }) || 0;
        if (count > 0) console.log(`  OK ${root.id}: ${count} file(s)`);
        compiled += count;
      }
      const forceNote = args.force ? ' (including non-generated sink files)' : '';
      console.log(`\nOK Sink compile: ${compiled} file(s) written to ${sink}${forceNote}`);
    },
  });
}

module.exports = { createSinkCompileCommand };
