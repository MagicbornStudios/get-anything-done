'use strict';

const { defineCommand } = require('citty');
const { getRuntimeArg } = require('../../../lib/runtime-args.cjs');
const { runRuntimeScriptJson } = require('../../../lib/runtime-substrate-scripts.cjs');
const {
  toSelectionTrace,
  annotateRuntimeArtifacts,
} = require('../../../lib/runtime-context-helpers.cjs');

function createRuntimeMatrixCommand({
  resolveGadRuntimeContext,
  buildRuntimePrompt,
  output,
  outputError,
  shouldUseJson,
}) {
  return defineCommand({
    meta: { name: 'matrix', description: 'Run runtime matrix through GAD project/session context and snapshot-aware prompt assembly.' },
    args: {
      projectid: { type: 'string', description: 'Project id (GAD planning root)', default: '' },
      sessionid: { type: 'string', description: 'Session id for context hydration', default: '' },
      runtime: { type: 'string', description: 'Single runtime id', default: '' },
      runtimes: { type: 'string', description: 'Comma-separated runtime ids', default: '' },
      prompt: { type: 'string', description: 'Prompt override', default: '' },
      'task-shape': { type: 'string', description: 'Task shape category', default: '' },
      mode: { type: 'string', description: 'Substrate rollout mode override (off|shadow|assist|active)', default: '' },
      'run-mode': { type: 'string', description: 'Execution mode', default: 'plan' },
      'phase-id': { type: 'string', description: 'Phase id override', default: '' },
      'task-id': { type: 'string', description: 'Task id override', default: '' },
      'timeout-ms': { type: 'string', description: 'Execution timeout in milliseconds', default: '60000' },
      'expected-file-touches': { type: 'string', description: 'Expected file touch count', default: '0' },
      'no-execute': { type: 'boolean', description: 'Skip runtime execution (selection + health only)', default: false },
      'no-save': { type: 'boolean', description: 'Do not persist traces/matrix artifacts', default: false },
      'force-runtime': { type: 'string', description: 'Bypass selector and force a runtime', default: '' },
      'allow-runtime-override': { type: 'boolean', description: 'Allow routing overrides for this invocation', default: false },
      'shadow-log': { type: 'boolean', description: 'Include computed decision payload when mode=shadow (disable with --no-shadow-log)', default: true },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      try {
        const context = await resolveGadRuntimeContext({
          projectId: args.projectid,
          sessionId: args.sessionid,
          modeOverride: args.mode,
          forceRuntime: getRuntimeArg(args, 'force-runtime', ''),
          allowRuntimeOverride: Boolean(getRuntimeArg(args, 'allow-runtime-override', false)),
          taskShape: getRuntimeArg(args, 'task-shape', ''),
        });
        const core = context.core;
        const prompt = buildRuntimePrompt(core, context, args.prompt);
        const runMode = getRuntimeArg(args, 'run-mode', 'plan');
        const phaseIdArg = getRuntimeArg(args, 'phase-id', '');
        const taskIdArg = getRuntimeArg(args, 'task-id', '');
        const timeoutMs = getRuntimeArg(args, 'timeout-ms', '60000');
        const expectedFileTouches = getRuntimeArg(args, 'expected-file-touches', '0');
        const noExecute = Boolean(getRuntimeArg(args, 'no-execute', false));
        const noSave = Boolean(getRuntimeArg(args, 'no-save', false));
        const forceRuntime = getRuntimeArg(args, 'force-runtime', '');
        const allowRuntimeOverride = Boolean(getRuntimeArg(args, 'allow-runtime-override', false));
        const noShadowLog = !Boolean(getRuntimeArg(args, 'shadow-log', true))
          || Boolean(getRuntimeArg(args, 'no-shadow-log', false));

        const scriptArgs = [
          '--project-id', context.projectId,
          '--task-shape', context.taskShape,
          '--run-mode', String(runMode || 'plan'),
          '--mode', context.effectiveRuntimeConfig.mode,
          '--prompt', prompt,
          '--json',
        ];
        if (args.runtime) scriptArgs.push('--runtime', String(args.runtime));
        if (args.runtimes) scriptArgs.push('--runtimes', String(args.runtimes));
        if (phaseIdArg || context.state.currentPhase) scriptArgs.push('--phase-id', String(phaseIdArg || context.state.currentPhase));
        if (taskIdArg) scriptArgs.push('--task-id', String(taskIdArg));
        if (timeoutMs) scriptArgs.push('--timeout-ms', String(timeoutMs));
        if (expectedFileTouches) scriptArgs.push('--expected-file-touches', String(expectedFileTouches));
        if (noExecute) scriptArgs.push('--no-execute');
        if (noSave) scriptArgs.push('--no-save');
        if (forceRuntime) scriptArgs.push('--force-runtime', String(forceRuntime));
        if (allowRuntimeOverride) scriptArgs.push('--allow-runtime-override');
        if (noShadowLog) scriptArgs.push('--no-shadow-log');

        const payload = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-matrix.mjs', scriptArgs);
        const selectionTrace = toSelectionTrace(payload.selection, {
          projectOverrideActive: context.projectOverrideActive,
          forceRuntimeActive: Boolean(forceRuntime),
          forceRuntime,
        });
        const artifactPatch = {
          gadContextProvenance: context.contextProvenance,
          gadSelectionTrace: selectionTrace,
        };
        annotateRuntimeArtifacts(payload, artifactPatch);
        payload.selectionTrace = selectionTrace;
        payload.gadContext = {
          projectId: context.projectId,
          sessionId: context.sessionId,
          sessionResolved: context.sessionResolved,
          contextRefCount: context.contextRefs.length,
          contextBlockCount: context.contextBlocks.length,
          handoffArtifacts: context.handoffArtifacts,
          contextProvenance: context.contextProvenance,
          projectOverrideActive: context.projectOverrideActive,
          forceRuntimeActive: Boolean(forceRuntime),
        };

        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }

        console.log(`Runtime matrix complete (project=${context.projectId}, session=${context.sessionId || 'none'})`);
        console.log(`mode=${payload.substrateMode || context.effectiveRuntimeConfig.mode} runMode=${payload.runMode || args['run-mode']}`);
        console.log(`configured=${selectionTrace.configuredPrimary || 'none'} computed=${selectionTrace.computedPrimary || 'none'} effective=${selectionTrace.effectivePrimary || 'none'}`);
        console.log(`fallback=${selectionTrace.fallbackChain.join(', ') || '(none)'} suppressed-reason=${selectionTrace.suppressedReason || 'none'}`);
        const rows = (payload.runs || []).map((run) => ({
          runtime: run.runtime,
          status: run.status,
          error: run.normalizedErrorCode || 'none',
          durationMs: run.durationMs,
        }));
        output(rows, { title: 'Runtime matrix results', format: 'table' });
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

module.exports = { createRuntimeMatrixCommand };
