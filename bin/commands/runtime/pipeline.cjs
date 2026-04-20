'use strict';

const { defineCommand } = require('citty');
const { getRuntimeArg } = require('../../../lib/runtime-args.cjs');
const { runRuntimeScriptJson } = require('../../../lib/runtime-substrate-scripts.cjs');
const {
  toSelectionTrace,
  annotateRuntimeArtifacts,
} = require('../../../lib/runtime-context-helpers.cjs');

function createRuntimePipelineCommand({
  resolveGadRuntimeContext,
  buildRuntimePrompt,
  outputError,
  shouldUseJson,
}) {
  return defineCommand({
    meta: { name: 'pipeline', description: 'Run check -> matrix -> score -> candidates using GAD runtime context.' },
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
      'no-execute': { type: 'boolean', description: 'Skip runtime execution during matrix stage', default: false },
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
        const prompt = buildRuntimePrompt(context.core, context, args.prompt);
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

        const commonCheckArgs = ['--project-id', context.projectId, '--json'];
        if (args.runtime) commonCheckArgs.push('--runtime', String(args.runtime));
        if (args.runtimes) commonCheckArgs.push('--runtimes', String(args.runtimes));
        if (timeoutMs) commonCheckArgs.push('--timeout-ms', String(timeoutMs));
        if (noSave) commonCheckArgs.push('--no-save');

        const check = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-check.mjs', commonCheckArgs);

        const matrixArgs = [
          '--project-id', context.projectId,
          '--task-shape', context.taskShape,
          '--run-mode', String(runMode || 'plan'),
          '--mode', context.effectiveRuntimeConfig.mode,
          '--prompt', prompt,
          '--json',
        ];
        if (args.runtime) matrixArgs.push('--runtime', String(args.runtime));
        if (args.runtimes) matrixArgs.push('--runtimes', String(args.runtimes));
        if (phaseIdArg || context.state.currentPhase) matrixArgs.push('--phase-id', String(phaseIdArg || context.state.currentPhase));
        if (taskIdArg) matrixArgs.push('--task-id', String(taskIdArg));
        if (timeoutMs) matrixArgs.push('--timeout-ms', String(timeoutMs));
        if (expectedFileTouches) matrixArgs.push('--expected-file-touches', String(expectedFileTouches));
        if (noExecute) matrixArgs.push('--no-execute');
        if (noSave) matrixArgs.push('--no-save');
        if (forceRuntime) matrixArgs.push('--force-runtime', String(forceRuntime));
        if (allowRuntimeOverride) matrixArgs.push('--allow-runtime-override');
        if (noShadowLog) matrixArgs.push('--no-shadow-log');

        const matrix = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-matrix.mjs', matrixArgs);
        const selectionTrace = toSelectionTrace(matrix.selection, {
          projectOverrideActive: context.projectOverrideActive,
          forceRuntimeActive: Boolean(forceRuntime),
          forceRuntime,
        });
        const artifactPatch = {
          gadContextProvenance: context.contextProvenance,
          gadSelectionTrace: selectionTrace,
        };
        annotateRuntimeArtifacts(matrix, artifactPatch);
        matrix.selectionTrace = selectionTrace;
        const score = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-score.mjs', ['--project-id', context.projectId, '--json']);
        const candidates = runRuntimeScriptJson(context.runtimeRepoRoot, 'runtime-candidates.mjs', ['--json']);

        const payload = {
          executedAt: new Date().toISOString(),
          context: {
            projectId: context.projectId,
            sessionId: context.sessionId,
            sessionResolved: context.sessionResolved,
            taskShape: context.taskShape,
            mode: context.effectiveRuntimeConfig.mode,
            contextRefCount: context.contextRefs.length,
            contextBlockCount: context.contextBlocks.length,
            handoffArtifacts: context.handoffArtifacts,
            contextProvenance: context.contextProvenance,
            projectOverrideActive: context.projectOverrideActive,
            forceRuntimeActive: Boolean(forceRuntime),
          },
          selectionTrace,
          check,
          matrix,
          score,
          candidates,
        };

        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }

        console.log(`Runtime pipeline complete (project=${context.projectId}, session=${context.sessionId || 'none'})`);
        console.log(`mode=${context.effectiveRuntimeConfig.mode} task-shape=${context.taskShape}`);
        console.log(`configured=${selectionTrace.configuredPrimary || 'none'} computed=${selectionTrace.computedPrimary || 'none'} effective=${selectionTrace.effectivePrimary || 'none'}`);
        console.log(`project-override=${selectionTrace.projectOverrideActive ? 'yes' : 'no'} force-runtime=${selectionTrace.forceRuntimeActive ? 'yes' : 'no'}`);
        const emitted = Array.isArray(candidates.emitted) ? candidates.emitted.length : 0;
        console.log(`candidates-emitted=${emitted}`);
        const runs = Array.isArray(matrix.runs) ? matrix.runs : [];
        for (const run of runs) {
          console.log(`  - ${run.runtime}: status=${run.status} error=${run.normalizedErrorCode || 'none'}`);
        }
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

module.exports = { createRuntimePipelineCommand };
