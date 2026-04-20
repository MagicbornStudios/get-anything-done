'use strict';
/**
 * gad team stop — write stop.flag for target worker(s).
 * Workers exit after their current tick finishes (no mid-subprocess kill).
 */

const fs = require('fs');
const { defineCommand } = require('citty');
const { appendJsonl } = require('../../../lib/team/io.cjs');
const { listWorkerIds } = require('../../../lib/team/status.cjs');
const { stopFlagPath, supervisorLog } = require('../../../lib/team/paths.cjs');

function createStopCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  function resolveTeamBaseDir(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return repoRoot;
    return require('path').join(repoRoot, root.path);
  }

  return defineCommand({
    meta: { name: 'stop', description: 'Signal worker(s) to exit via stop.flag after current iteration.' },
    args: {
      projectid: { type: 'string', description: 'Target project id (resolves .planning/team/ path)', default: '' },
      'worker-id': { type: 'string', default: '' },
      all: { type: 'boolean', default: false },
    },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const ids = args.all ? listWorkerIds(baseDir) : (args['worker-id'] ? [String(args['worker-id'])] : []);
      if (ids.length === 0) { outputError('Pass --worker-id <id> or --all.'); process.exit(1); }
      for (const id of ids) {
        fs.writeFileSync(stopFlagPath(baseDir, id), new Date().toISOString());
        appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'stop-signal', worker_id: id });
        console.log(`stop.flag written for ${id}`);
      }
    },
  });
}

module.exports = { createStopCommand };
