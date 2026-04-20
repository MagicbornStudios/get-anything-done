'use strict';

const { defineCommand } = require('citty');
const { resolveSinkScope } = require('./shared.cjs');

function createSinkDiffCommand({ findRepoRoot, gadConfig, resolveRoots, outputError }) {
  return defineCommand({
    meta: { name: 'diff', description: 'Show what sink compile would change vs MDX on disk (compare before compile --force)' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Diff all projects', default: false },
    },
    run({ args }) {
      const scope = resolveSinkScope(args, findRepoRoot, gadConfig, resolveRoots, outputError);
      if (!scope || scope.roots.length === 0) return;
      const { baseDir, roots, sink } = scope;
      const { diffSink } = require('../../../lib/docs-compiler.cjs');
      let totalChanged = 0;
      let totalForce = 0;
      for (const root of roots) {
        const { chunks, changed, needsForce } = diffSink(baseDir, root, sink);
        totalChanged += changed;
        totalForce += needsForce;
        if (chunks.length) {
          console.log(`\n-- ${root.id} --`);
          console.log(chunks.join('\n'));
        }
      }
      if (totalChanged === 0) { console.log(`\nOK Sink diff: no content changes (sink matches compile output - ${sink})`); return; }
      console.log(`\n${totalChanged} file(s) differ from compiled output.`);
      if (totalForce > 0) console.log(`${totalForce} of those need \`gad sink compile --force\` to overwrite (not generated on disk).`);
      console.log('Review the output above, then run `gad sink compile` or `gad sink compile --force` as needed.');
      process.exit(1);
    },
  });
}

module.exports = { createSinkDiffCommand };
