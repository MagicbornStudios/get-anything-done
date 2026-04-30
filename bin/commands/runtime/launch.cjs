'use strict';

const fs = require('fs');
const path = require('path');
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

/**
 * Write a pre-launch dispatch record to .planning/.gad-log/runtime-launch-<ts>.jsonl
 * so orchestrators can detect silent failures by tailing the log dir.
 */
function writeDispatchLog(logDir, record) {
  if (!logDir) return;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `runtime-launch-${ts}.jsonl`);
    fs.writeFileSync(logFile, JSON.stringify(record) + '\n', 'utf8');
  } catch { /* non-fatal — don't block launch */ }
}

/**
 * Derive the project-scoped log directory.
 * For non-root projects this lands in <projectPath>/.planning/.gad-log/.
 * Falls back to the monorepo-level .planning/.gad-log/ when not available.
 */
function resolveDispatchLogDir(context) {
  try {
    if (context.root && context.baseDir) {
      const projectPath = path.resolve(context.baseDir, context.root.path || '.');
      return path.join(projectPath, '.planning', '.gad-log');
    }
    if (context.baseDir) {
      return path.join(context.baseDir, '.planning', '.gad-log');
    }
  } catch { /* non-fatal */ }
  return null;
}

/**
 * Resolve the CWD for the spawned runtime process.
 * For non-root projects, use the project directory so the agent's
 * cwd-relative assumptions (e.g. reading local .planning/) are correct.
 * Falls back to runtimeRepoRoot when the project path can't be resolved.
 */
function resolveRuntimeCwd(context) {
  try {
    if (context.root && context.baseDir && context.root.path) {
      const projectPath = path.resolve(context.baseDir, context.root.path);
      if (projectPath !== context.runtimeRepoRoot && fs.existsSync(projectPath)) {
        return projectPath;
      }
    }
  } catch { /* non-fatal */ }
  return context.runtimeRepoRoot;
}

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
        // --- Item 1: Reject contradictory flag combinations ---
        const sameShellFlag = Boolean(getRuntimeArg(args, 'same-shell', false));
        const newShellFlag = Boolean(getRuntimeArg(args, 'new-shell', true));
        // --same-shell and --no-new-shell are semantically identical; reject
        // only when the user explicitly sets BOTH --same-shell AND --new-shell.
        // citty exposes 'new-shell' as true by default; we must detect an
        // explicit --new-shell vs the default value. We treat the combination
        // as contradictory only when --same-shell=true AND new-shell is
        // explicitly passed as a truthy raw flag (checked via raw argv).
        const rawArgv = process.argv;
        const explicitNewShell = rawArgv.includes('--new-shell') || rawArgv.includes('--new-shell=true');
        const explicitNoNewShell = rawArgv.includes('--no-new-shell') || rawArgv.includes('--new-shell=false');

        if (sameShellFlag && explicitNewShell) {
          outputError('Contradictory flags: --same-shell and --new-shell are mutually exclusive. Use one or the other.');
          process.exitCode = 1;
          return;
        }

        const explicitId = getRuntimeArg(args, 'id', '');
        const explicitRuntime = getRuntimeArg(args, 'runtime', '');
        const explicitForceRuntime = getRuntimeArg(args, 'force-runtime', '');
        if (explicitId && explicitForceRuntime && normalizeRuntimeLaunchId(explicitId) !== normalizeRuntimeLaunchId(explicitForceRuntime)) {
          outputError(`Contradictory flags: --id ${explicitId} and --force-runtime ${explicitForceRuntime} resolve to different runtimes. Pass only one.`);
          process.exitCode = 1;
          return;
        }
        if (explicitRuntime && explicitForceRuntime && normalizeRuntimeLaunchId(explicitRuntime) !== normalizeRuntimeLaunchId(explicitForceRuntime)) {
          outputError(`Contradictory flags: --runtime ${explicitRuntime} and --force-runtime ${explicitForceRuntime} resolve to different runtimes. Pass only one.`);
          process.exitCode = 1;
          return;
        }

        const context = await resolveGadRuntimeContext({
          projectId: args.projectid,
          sessionId: args.sessionid,
          modeOverride: args.mode,
          forceRuntime: getRuntimeArg(args, 'force-runtime', ''),
          allowRuntimeOverride: Boolean(getRuntimeArg(args, 'allow-runtime-override', false)),
          taskShape: getRuntimeArg(args, 'task-shape', ''),
        });
        const core = context.core;

        const resolvedExplicitId = normalizeRuntimeLaunchId(getRuntimeArg(args, 'id', '') || getRuntimeArg(args, 'runtime', ''));
        const forceRuntime = normalizeRuntimeLaunchId(getRuntimeArg(args, 'force-runtime', ''));
        const selectionRuntimeIds = resolveRuntimeIds(args, core).map((id) => normalizeRuntimeLaunchId(id));
        let selectedRuntime = resolvedExplicitId || forceRuntime || '';
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

        // Resolve effective shell mode (item 1 already handled explicit contradictions above)
        const sameShell = sameShellFlag || explicitNoNewShell;
        const launchInNewShell = sameShell ? false : newShellFlag;

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

        // --- Item 4: Project-scoped CWD instead of monorepo root ---
        const runtimeCwd = resolveRuntimeCwd(context);

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
          cwd: runtimeCwd,
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

        // --- Item 2: Pre-launch dispatch log ---
        const logDir = resolveDispatchLogDir(context);
        const dispatchRecord = {
          event: 'runtime-launch-dispatch',
          ts: new Date().toISOString(),
          projectId: context.projectId,
          sessionId: context.sessionId,
          runtime: selectedRuntime,
          command: launchSpec.command,
          argv: launchArgs,
          cwd: runtimeCwd,
          launchInNewShell,
          sameShell,
          envKeys: Object.keys(process.env).filter((k) => !k.match(/token|secret|key|pass|auth|api/i)),
          callerPid: process.pid,
          callerPpid: (typeof process.ppid === 'number' ? process.ppid : null),
        };
        writeDispatchLog(logDir, dispatchRecord);

        // --- Item 3: Echo resolved argv to stderr ---
        process.stderr.write(
          `[gad runtime launch] dispatch: ${JSON.stringify([launchSpec.command, ...launchArgs])}\n`,
        );

        if (launchInNewShell) {
          if (process.platform !== 'win32') {
            throw new Error('New-shell launch is currently implemented for Windows only. Use --same-shell on this platform.');
          }
          launchRuntimeInNewShellWindows({
            command: launchSpec.command,
            args: launchArgs,
            cwd: runtimeCwd,
            runtimeId: selectedRuntime,
          });
          if (!args.json && !shouldUseJson()) {
            console.log(`Launched ${selectedRuntime} in a new shell window.`);
          }
          return;
        }

        const child = spawnSync(launchSpec.command, launchArgs, {
          cwd: runtimeCwd,
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
