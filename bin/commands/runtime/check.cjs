'use strict';

const { defineCommand } = require('citty');
const { getRuntimeArg } = require('../../../lib/runtime-args.cjs');
const { runRuntimeScriptJson } = require('../../../lib/runtime-substrate-scripts.cjs');

function createRuntimeCheckCommand({ resolveGadRuntimeContext, output, outputError, shouldUseJson }) {
  return defineCommand({
    meta: { name: 'check', description: 'Run runtime health checks through GAD project/session context.' },
    args: {
      projectid: { type: 'string', description: 'Project id (GAD planning root)', default: '' },
      sessionid: { type: 'string', description: 'Session id for context hydration', default: '' },
      runtime: { type: 'string', description: 'Single runtime id to check', default: '' },
      runtimes: { type: 'string', description: 'Comma-separated runtime ids to check', default: '' },
      smoke: { type: 'boolean', description: 'Run smoke prompt checks when supported', default: false },
      'timeout-ms': { type: 'string', description: 'Probe timeout in milliseconds', default: '60000' },
      'no-save': { type: 'boolean', description: 'Do not persist runtime health artifacts', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      try {
        const context = await resolveGadRuntimeContext({
          projectId: args.projectid,
          sessionId: args.sessionid,
        });
        const scriptArgs = ['--project-id', context.projectId, '--json'];
        if (args.runtime) scriptArgs.push('--runtime', String(args.runtime));
        if (args.runtimes) scriptArgs.push('--runtimes', String(args.runtimes));
        if (args.smoke) scriptArgs.push('--smoke');
        const timeoutMs = getRuntimeArg(args, 'timeout-ms', '60000');
        const noSave = Boolean(getRuntimeArg(args, 'no-save', false));
        if (timeoutMs) scriptArgs.push('--timeout-ms', String(timeoutMs));
        if (noSave) scriptArgs.push('--no-save');

        const payload = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-check.mjs', scriptArgs);
        payload.gadContext = {
          projectId: context.projectId,
          sessionId: context.sessionId,
          sessionResolved: context.sessionResolved,
          handoffArtifacts: context.handoffArtifacts,
          contextProvenance: context.contextProvenance,
        };

        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }

        console.log(`Runtime check complete for project=${context.projectId} session=${context.sessionId || 'none'}`);
        const rows = (payload.runtimes || []).map((entry) => ({
          runtime: entry.runtime,
          installed: entry.installed,
          auth: entry.authConfigured,
          headless: entry.supportsHeadless,
          json: entry.supportsJsonOutput,
        }));
        output(rows, { title: 'Runtime health (GAD)', format: 'table' });
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

module.exports = { createRuntimeCheckCommand };
