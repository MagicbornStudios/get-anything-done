'use strict';
/**
 * gad runtime - GAD-native runtime substrate command assembler.
 *
 * Runtime command behavior lives in bin/commands/runtime/*.cjs.
 * Shared GAD context hydration lives in lib/runtime-gad-context.cjs.
 */

const { defineCommand } = require('citty');
const { getRuntimeArg } = require('../../lib/runtime-args.cjs');
const {
  createGadRuntimeContextResolver,
  buildRuntimePrompt,
  resolveRuntimeIds,
} = require('../../lib/runtime-gad-context.cjs');
const { createRuntimeCheckCommand } = require('./runtime/check.cjs');
const { createRuntimeSelectCommand } = require('./runtime/select.cjs');
const { createRuntimeMatrixCommand } = require('./runtime/matrix.cjs');
const { createRuntimePipelineCommand } = require('./runtime/pipeline.cjs');
const { createRuntimeLaunchCommand } = require('./runtime/launch.cjs');

function createRuntimeCommand(deps) {
  const resolveGadRuntimeContext = createGadRuntimeContextResolver(deps);
  const commandDeps = {
    resolveGadRuntimeContext,
    buildRuntimePrompt,
    resolveRuntimeIds,
    output: deps.output,
    outputError: deps.outputError,
    shouldUseJson: deps.shouldUseJson,
  };

  return defineCommand({
    meta: {
      name: 'runtime',
      description: 'GAD-native runtime substrate commands (check/select/matrix/pipeline/launch).',
    },
    subCommands: {
      check: createRuntimeCheckCommand(commandDeps),
      select: createRuntimeSelectCommand(commandDeps),
      matrix: createRuntimeMatrixCommand(commandDeps),
      pipeline: createRuntimePipelineCommand(commandDeps),
      launch: createRuntimeLaunchCommand(commandDeps),
    },
  });
}

module.exports = {
  createRuntimeCommand,
  getRuntimeArg,
};

module.exports.register = (ctx) => ({
  runtime: createRuntimeCommand({
    ...ctx.common,
    loadSessions: ctx.services.session.helpers.loadSessions,
    SESSION_STATUS: ctx.services.session.helpers.SESSION_STATUS,
    buildContextRefs: ctx.services.session.helpers.buildContextRefs,
  }),
});
