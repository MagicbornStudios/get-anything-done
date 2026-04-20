'use strict';
/**
 * gad team work — worker loop entry point.
 * Thin: delegates to lib/team/worker-loop.cjs::runWorker.
 * Spawned by `gad team start` as a detached subprocess; can also be run
 * foreground for debugging.
 */

const fs = require('fs');
const { defineCommand } = require('citty');
const { readConfig } = require('../../../lib/team/config.cjs');
const { workerDir } = require('../../../lib/team/paths.cjs');
const { runWorker } = require('../../../lib/team/worker-loop.cjs');

function createWorkCommand(deps) {
  const { findRepoRoot, outputError } = deps;
  return defineCommand({
    meta: { name: 'work', description: 'Worker loop entry. Typically spawned by `gad team start` as a detached subprocess; can be run foreground for debugging.' },
    args: { 'worker-id': { type: 'string', required: true } },
    async run({ args }) {
      const baseDir = findRepoRoot();
      const id = String(args['worker-id']);
      if (!readConfig(baseDir)) { outputError('No team configured. Run `gad team start` first.'); process.exit(1); }
      if (!fs.existsSync(workerDir(baseDir, id))) { outputError(`Worker dir missing: ${id}`); process.exit(1); }
      await runWorker(baseDir, id);
    },
  });
}

module.exports = { createWorkCommand };
