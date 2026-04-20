'use strict';

const { defineCommand } = require('citty');
const { path, resolveSinkScope } = require('./shared.cjs');

function createSinkDecompileCommand({ findRepoRoot, gadConfig, resolveRoots, outputError }) {
  return defineCommand({
    meta: { name: 'decompile', description: 'Ensure .planning/ dirs exist for all projects; create stubs for missing source files' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Decompile all projects', default: false },
    },
    run({ args }) {
      const scopeArgs = { ...args, all: args.all || !args.projectid };
      const scope = resolveSinkScope(scopeArgs, findRepoRoot, gadConfig, resolveRoots, outputError);
      if (!scope) return;
      const { baseDir, roots, sink } = scope;
      const { decompile } = require('../../../lib/docs-compiler.cjs');
      let total = 0;
      for (const root of roots) {
        const count = decompile(baseDir, root, sink);
        const planDir = path.join(baseDir, root.path, root.planningDir);
        if (count > 0) console.log(`  OK ${root.id}: ${count} stub(s) created in ${planDir}`);
        else console.log(`  - ${root.id}: dir ensured, no new stubs needed`);
        total += count;
      }
      console.log('\nOK Decompile: ' + total + ' stub file(s) created. Run `gad sink compile` to populate the sink.');
    },
  });
}

module.exports = { createSinkDecompileCommand };
