'use strict';

const { spawnSync } = require('child_process');
const { defineCommand } = require('citty');
const {
  getRuntimeArg,
  resolveRuntimeLaunchExtraArgs,
} = require('../../../lib/runtime-args.cjs');
const {
  normalizeRuntimeLaunchId,
  buildInteractiveRuntimeLaunchSpec,
  launchRuntimeInNewShellWindows,
} = require('../../../lib/runtime-launch.cjs');
const { toSelectionTrace } = require('../../../lib/runtime-context-helpers.cjs');

function createRuntimeLaunchCommand({
  resolveGadRuntimeContext,
  resolveRuntimeIds,
  outputError,
  shouldUseJson,
}) {
  return defineCommand({
    meta: {
      name: 'launch',
      description: 'Launch an interactive runtime CLI (new shell by default) using GAD project/session context.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id (GAD planning root)', default: '' },
      sessionid: { type: 'string', description: 'Session id for context hydration', default: '' },
      id: { type: 'string', description: 'Runtime id alias (claude, codex, gemini, opencode)', default: '' },
      runtime: { type: 'string', description: 'Runtime id (claude-code, codex-cli, gemini-cli, opencode)', default: '' },
      runtimes: { type: 'string', description: 'Comma-separated runtimes to consider when --id/--runtime omitted', default: '' },
      'task-shape': { type: 'string', description: 'Task shape category', default: '' },
      mode: { type: 'string', description: 'Substrate rollout mode override (off|shadow|assist|active)', default: '' },
      'force-runtime': { type: 'string', description: 'Bypass selector and force a runtime', default: '' },
      'allow-runtime-override': { type: 'boolean', description: 'Allow routing overrides for this invocation', default: false },
      'new-shell': { type: 'boolean', description: 'Launch in a new shell window', default: true },
      'same-shell': { type: 'boolean', description: 'Launch in the current shell (blocks until runtime exits)', default: false },
      'skip-health-check': { type: 'boolean', description: 'Skip runtime executable/auth health probes before launch', default: false },
      'launch-args': { type: 'string', description: 'Extra args passed to the launched runtime command (supports simple quoted strings)', default: '' },
      'launch-args-json': { type: 'string', description: 'JSON array of extra args passed to the launched runtime command (overrides --launch-args)', default: '' },
      'dry-run': { type: 'boolean', description: 'Resolve runtime and launch command but do not execute', default: false },
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

        const explicitId = normalizeRuntimeLaunchId(getRuntimeArg(args, 'id', '') || getRuntimeArg(args, 'runtime', ''));
        const forceRuntime = normalizeRuntimeLaunchId(getRuntimeArg(args, 'force-runtime', ''));
        const selectionRuntimeIds = resolveRuntimeIds(args, core).map((id) => normalizeRuntimeLaunchId(id));
        let selectedRuntime = explicitId || forceRuntime || '';
        let selectionTrace = null;

        if (!selectedRuntime) {
          const runtimeIds = Array.from(new Set(selectionRuntimeIds.filter(Boolean)));
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
            estimatedTokensIn: 0,
            requiresHeadless: false,
            requiresJsonOutput: false,
            requiresShell: true,
            requiresWrite: true,
            authStatuses,
            healthStatuses,
            installed,
            promotedSkills: context.promotedSkills,
            effectiveConfig: context.effectiveRuntimeConfig,
            forceRuntime: forceRuntime || null,
          });
          selectionTrace = toSelectionTrace(decision, {
            projectOverrideActive: context.projectOverrideActive,
            forceRuntimeActive: Boolean(forceRuntime),
            forceRuntime,
          });
          selectedRuntime = normalizeRuntimeLaunchId(decision.effective?.primary || decision.computed?.primary || '');
        }

        if (!selectedRuntime) {
          throw new Error('Could not resolve a runtime to launch. Pass --id <runtime> to force one.');
        }

        const launchSpec = buildInteractiveRuntimeLaunchSpec(selectedRuntime, context.runtimeRepoRoot);
        const extraRuntimeArgs = resolveRuntimeLaunchExtraArgs(args);
        const launchArgs = [...(launchSpec.args || []), ...extraRuntimeArgs];
        const sameShell = Boolean(getRuntimeArg(args, 'same-shell', false));
        const launchInNewShell = sameShell ? false : Boolean(getRuntimeArg(args, 'new-shell', true));
        const dryRun = Boolean(getRuntimeArg(args, 'dry-run', false));
        const skipHealthCheck = Boolean(getRuntimeArg(args, 'skip-health-check', false)) || dryRun;
        const auth = core.authStatusByRuntime([selectedRuntime])[selectedRuntime];
        let health = {
          installed: null,
          version: null,
          executablePath: null,
          supportsWorkspaceWrite: null,
          supportsHeadless: null,
          supportsJsonOutput: null,
          issues: [],
          warnings: [],
        };
        if (!skipHealthCheck) {
          health = core.runtimeHealthReport(selectedRuntime, { smoke: false, timeoutMs: 25000 });
          if (!health.installed) {
            throw new Error(`Runtime ${selectedRuntime} is not installed or not on PATH. ${health.issues.join(' | ')}`);
          }
        }

        const payload = {
          projectId: context.projectId,
          sessionId: context.sessionId,
          taskShape: context.taskShape,
          runtime: selectedRuntime,
          launchInNewShell,
          sameShell,
          dryRun,
          command: launchSpec.command,
          args: launchArgs,
          cwd: context.runtimeRepoRoot,
          extraArgs: extraRuntimeArgs,
          healthCheckSkipped: skipHealthCheck,
          health: {
            installed: health.installed,
            version: health.version,
            executablePath: health.executablePath,
            supportsWorkspaceWrite: health.supportsWorkspaceWrite,
            supportsHeadless: health.supportsHeadless,
            supportsJsonOutput: health.supportsJsonOutput,
            issues: health.issues,
            warnings: health.warnings,
          },
          auth: auth || null,
          contextProvenance: context.contextProvenance,
          selectionTrace,
        };

        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify(payload, null, 2));
          if (dryRun) return;
        }

        if (dryRun) {
          console.log(`Runtime launch dry-run: ${selectedRuntime}`);
          console.log(`command=${launchSpec.command} ${(launchArgs || []).join(' ')}`.trim());
          return;
        }

        if (launchInNewShell) {
          if (process.platform !== 'win32') {
            throw new Error('New-shell launch is currently implemented for Windows only. Use --same-shell on this platform.');
          }
          launchRuntimeInNewShellWindows({
            command: launchSpec.command,
            args: launchArgs,
            cwd: context.runtimeRepoRoot,
            runtimeId: selectedRuntime,
          });
          if (!args.json && !shouldUseJson()) {
            console.log(`Launched ${selectedRuntime} in a new shell window.`);
          }
          return;
        }

        const child = spawnSync(launchSpec.command, launchArgs, {
          cwd: context.runtimeRepoRoot,
          env: process.env,
          stdio: 'inherit',
          shell: false,
        });
        if (child.error) throw child.error;
        if (child.status !== 0) {
          throw new Error(`${selectedRuntime} exited with status ${child.status}.`);
        }
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

module.exports = { createRuntimeLaunchCommand };
