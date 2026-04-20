'use strict';

const { defineCommand } = require('citty');
const { resolveSinkScope, stampSinkCompileNote } = require('./shared.cjs');

function createSinkSyncCommand({ findRepoRoot, gadConfig, resolveRoots, outputError }) {
  return defineCommand({
    meta: { name: 'sync', description: 'Sync all planning files to sink (compile all, non-destructive)' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Sync all projects (default when no session)', default: false },
      force: { type: 'boolean', description: 'Overwrite sink MDX even when not tagged generated (use after gad sink diff)', default: false },
    },
    run({ args }) {
      const scopeArgs = { ...args, all: args.all || !args.projectid };
      const scope = resolveSinkScope(scopeArgs, findRepoRoot, gadConfig, resolveRoots, outputError);
      if (!scope) return;
      const { baseDir, roots, sink } = scope;
      const { compile } = require('../../../lib/docs-compiler.cjs');
      let compiled = 0;
      for (const root of roots) {
        stampSinkCompileNote(root, baseDir, sink, new Date().toISOString());
        const count = compile(baseDir, root, sink, { force: args.force }) || 0;
        console.log(`  ${count > 0 ? 'OK' : '-'} ${root.id}: ${count} file(s) written`);
        compiled += count;
      }
      const forceNote = args.force ? ' (including non-generated sink files)' : '';
      console.log(`\nOK Sync complete: ${compiled} file(s) updated in ${sink}${forceNote}`);
    },
  });
}

module.exports = { createSinkSyncCommand };
