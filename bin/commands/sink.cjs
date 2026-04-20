'use strict';

const { defineCommand } = require('citty');
const { createSinkStatusCommand } = require('./sink/status.cjs');
const { createSinkDiffCommand } = require('./sink/diff.cjs');
const { createSinkCompileCommand } = require('./sink/compile.cjs');
const { createSinkSyncCommand } = require('./sink/sync.cjs');
const { createSinkDecompileCommand } = require('./sink/decompile.cjs');
const { createSinkValidateCommand } = require('./sink/validate.cjs');

function createSinkCommand(deps) {
  return defineCommand({
    meta: { name: 'sink', description: 'Manage docs sink - sync, compile, decompile, status, validate' },
    subCommands: {
      status: createSinkStatusCommand(deps),
      diff: createSinkDiffCommand(deps),
      compile: createSinkCompileCommand(deps),
      sync: createSinkSyncCommand(deps),
      decompile: createSinkDecompileCommand(deps),
      validate: createSinkValidateCommand(deps),
    },
  });
}

module.exports = { createSinkCommand };
module.exports.register = (ctx) => ({
  sink: createSinkCommand(ctx.common),
});
