'use strict';

const { defineCommand } = require('citty');
const { getRuntimeArg } = require('../../../lib/runtime-args.cjs');
const { toSelectionTrace } = require('../../../lib/runtime-context-helpers.cjs');

function createRuntimeSelectCommand({
  resolveGadRuntimeContext,
  buildRuntimePrompt,
  resolveRuntimeIds,
  outputError,
  shouldUseJson,
}) {
  return defineCommand({
    meta: { name: 'select', description: 'Read-only guarded runtime selection with computed vs effective decision output.' },
    args: {
      projectid: { type: 'string', description: 'Project id (GAD planning root)', default: '' },
      sessionid: { type: 'string', description: 'Session id for context hydration', default: '' },
      runtime: { type: 'string', description: 'Single runtime id to consider', default: '' },
      runtimes: { type: 'string', description: 'Comma-separated runtime ids to consider', default: '' },
      prompt: { type: 'string', description: 'Task prompt override', default: '' },
      'task-shape': { type: 'string', description: 'Task shape category', default: '' },
      mode: { type: 'string', description: 'Substrate rollout mode override (off|shadow|assist|active)', default: '' },
      'run-mode': { type: 'string', description: 'Execution mode (plan|implement|analyze|repair|eval)', default: 'plan' },
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
        const noShadowLog = !Boolean(getRuntimeArg(args, 'shadow-log', true))
          || Boolean(getRuntimeArg(args, 'no-shadow-log', false));
        if (noShadowLog) {
          context.effectiveRuntimeConfig.log_shadow_decisions = false;
        }
        const core = context.core;
        const runtimeIds = resolveRuntimeIds(args, core);
        const prompt = buildRuntimePrompt(core, context, args.prompt);
        const estimatedTokensIn = Math.ceil(String(prompt || '').length / 4);

        const healthStatuses = {};
        for (const runtime of runtimeIds) {
          healthStatuses[runtime] = core.runtimeHealthReport(runtime, {
            smoke: false,
            timeoutMs: 25000,
          });
        }
        const authStatuses = core.authStatusByRuntime(runtimeIds);
        const installed = Object.fromEntries(
          runtimeIds.map((runtime) => [
            runtime,
            {
              installed: Boolean(healthStatuses[runtime]?.installed),
              executablePath: healthStatuses[runtime]?.executablePath ?? null,
              version: healthStatuses[runtime]?.version ?? null,
              issues: [...(healthStatuses[runtime]?.issues || [])],
            },
          ]),
        );

        const decision = core.selectRuntimeWithGuards({
          runtimeIds,
          taskShape: context.taskShape,
          estimatedTokensIn,
          requiresHeadless: true,
          requiresJsonOutput: true,
          requiresShell: false,
          requiresWrite: false,
          authStatuses,
          healthStatuses,
          installed,
          promotedSkills: context.promotedSkills,
          effectiveConfig: context.effectiveRuntimeConfig,
          forceRuntime: getRuntimeArg(args, 'force-runtime', '') || null,
        });
        const selectionTrace = toSelectionTrace(decision, {
          projectOverrideActive: context.projectOverrideActive,
          forceRuntimeActive: Boolean(getRuntimeArg(args, 'force-runtime', '')),
          forceRuntime: getRuntimeArg(args, 'force-runtime', ''),
        });
        if (decision.mode === 'shadow' && !context.effectiveRuntimeConfig.log_shadow_decisions) {
          selectionTrace.computedPrimary = null;
        }

        const payload = {
          projectId: context.projectId,
          sessionId: context.sessionId,
          mode: decision.mode,
          configuredPrimary: decision.configuredPrimary || null,
          computedPrimary: decision.mode === 'shadow' && !context.effectiveRuntimeConfig.log_shadow_decisions
            ? null
            : decision.computed.primary,
          effectivePrimary: decision.effective.primary,
          fallbackChain: decision.effective.fallbackChain,
          reasoning: decision.effective.reasoning,
          appliedSkills: decision.effective.appliedSkills,
          suppressedSkills: decision.suppressedSkills,
          suppressedReason: decision.suppressedReason,
          forceRuntime: getRuntimeArg(args, 'force-runtime', '') || null,
          routingOverrideSuppressed: decision.routingOverrideSuppressed,
          primaryRuntimeFixed: decision.primaryRuntimeFixed,
          taskShape: context.taskShape,
          runMode: getRuntimeArg(args, 'run-mode', 'plan') || 'plan',
          promotedSkillCount: context.promotedSkills.length,
          handoffArtifacts: context.handoffArtifacts,
          contextProvenance: context.contextProvenance,
          selectionTrace,
          projectOverrideActive: context.projectOverrideActive,
          forceRuntimeActive: selectionTrace.forceRuntimeActive,
          computed: decision.mode === 'shadow' && !context.effectiveRuntimeConfig.log_shadow_decisions
            ? null
            : decision.computed,
          effective: decision.effective,
        };

        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }

        console.log('Runtime selection (GAD)');
        console.log(`project=${payload.projectId} session=${payload.sessionId || 'none'} mode=${payload.mode}`);
        console.log(`configured=${payload.configuredPrimary || 'none'} computed=${payload.computedPrimary || 'none'} effective=${payload.effectivePrimary || 'none'}`);
        console.log(`fallback=${payload.fallbackChain.join(', ') || '(none)'} suppressed-reason=${payload.suppressedReason || 'none'}`);
        console.log(`project-override=${payload.projectOverrideActive ? 'yes' : 'no'} force-runtime=${payload.forceRuntimeActive ? 'yes' : 'no'}`);
        if (payload.forceRuntime) console.log(`force-runtime=${payload.forceRuntime}`);
        if (payload.reasoning.length > 0) {
          console.log('\nreasoning:');
          for (const line of payload.reasoning) console.log(`  - ${line}`);
        }
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

module.exports = { createRuntimeSelectCommand };
