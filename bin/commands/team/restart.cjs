'use strict';
/**
 * gad team restart — graceful stop + respawn a single worker.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { appendJsonl } = require('../../../lib/team/io.cjs');
const { readConfig } = require('../../../lib/team/config.cjs');
const { readStatus } = require('../../../lib/team/status.cjs');
const { spawnWorker } = require('../../../lib/team/spawn.cjs');
const { stopFlagPath, supervisorLog, workerDir } = require('../../../lib/team/paths.cjs');

function createRestartCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  function resolveTeamBaseDir(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return repoRoot;
    return path.join(repoRoot, root.path);
  }

  return defineCommand({
    meta: { name: 'restart', description: 'Stop a worker (stop.flag + wait) and respawn it with the same id.' },
    args: {
      projectid: { type: 'string', description: 'Target project id (resolves .planning/team/ path)', default: '' },
      'worker-id': { type: 'string', required: true },
      'wait-ms': { type: 'string', default: '10000' },
    },
    async run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const id = String(args['worker-id']);
      if (!readConfig(baseDir)) { outputError('No team configured.'); process.exit(1); }
      if (!fs.existsSync(workerDir(baseDir, id))) { outputError(`Unknown worker: ${id}`); process.exit(1); }

      fs.writeFileSync(stopFlagPath(baseDir, id), new Date().toISOString());
      appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'restart-stop', worker_id: id });
      console.log(`stop.flag written for ${id}, waiting...`);
      const waitMs = Number.parseInt(String(args['wait-ms']), 10) || 10000;
      const deadline = Date.now() + waitMs;
      while (Date.now() < deadline) {
        const s = readStatus(baseDir, id);
        if (s && s.state === 'STOPPED') break;
        await new Promise(r => setTimeout(r, 300));
      }
      const gadBinary = path.resolve(__dirname, '..', '..', 'gad.cjs');
      const pid = spawnWorker(baseDir, id, gadBinary);
      appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'restart-spawn', worker_id: id, pid });
      console.log(`Respawned ${id} pid=${pid}`);
    },
  });
}

module.exports = { createRestartCommand };
