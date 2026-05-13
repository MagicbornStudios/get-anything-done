'use strict';

const { defineCommand } = require('citty');

/**
 * gad delta-train — continuous delta-training loop (phase 147).
 */
function createDeltaTrainCommand() {
  return defineCommand({
    meta: {
      name: 'delta-train',
      description: 'Continuous delta-training loop management (phase 147).',
    },
    subCommands: {
      tick: () => require('./delta-train/tick.cjs'),
      daemon: () => require('./delta-train/daemon.cjs'),
      status: () => require('./delta-train/status.cjs'),
      history: () => require('./delta-train/history.cjs'),
      stop: () => require('./delta-train/stop.cjs'),
      report: () => require('./delta-train/report.cjs'),
    },
  });
}

module.exports = { createDeltaTrainCommand };
module.exports.register = () => ({ 'delta-train': createDeltaTrainCommand() });
