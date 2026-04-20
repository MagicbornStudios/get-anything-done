'use strict';

const { defineCommand } = require('citty');
const { createHealthDiskCommand } = require('./health/disk.cjs');
const { createHealthPruneCommand } = require('./health/prune.cjs');
const { createHealthCachesCommand } = require('./health/caches.cjs');

function createHealthCommand(deps) {
  return defineCommand({
    meta: { name: 'health', description: 'Machine health surface - disk pressure, stale-worktree prune, cache enumeration (63-health-cli)' },
    subCommands: {
      disk: createHealthDiskCommand(deps),
      prune: createHealthPruneCommand(deps),
      caches: createHealthCachesCommand(deps),
    },
  });
}

module.exports = { createHealthCommand };
module.exports.register = (ctx) => ({
  health: createHealthCommand(ctx.common),
});
