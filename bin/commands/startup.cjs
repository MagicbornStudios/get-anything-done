'use strict';
/**
 * gad startup — print the GAD session-start contract and run snapshot.
 *
 * Required deps (object passed to createStartupCommand):
 *   findRepoRoot, gadConfig, render,
 *   sideEffectsSuppressed, resolveSideEffectsMode, NO_SIDE_EFFECTS_FLAG,
 *   getPackagedExecutablePath, isPackagedExecutableRuntime,
 *   detectRuntimeIdentity, buildHandoffsSection, printSection, ensureGraphFresh,
 *   readState, writeEvolutionScan, maybeGenerateDailyTip,
 *   getLastActiveProjectid, setLastActiveProjectid,
 *   sessionHelpers: { sessionsDir, generateSessionId, SESSION_STATUS, buildContextRefs, writeSession },
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

const STARTUP_PRIMARY_EXECUTABLE_ENV = 'GAD_STARTUP_PRIMARY_EXECUTABLE';

let _deps = null;
function deps() {
  if (!_deps) throw new Error('startup.cjs: createStartupCommand() must be called first');
  return _deps;
}

function runStartupSnapshot(projectId, sessionArg = [], extraArgs = []) {
  const { isPackagedExecutableRuntime, getPackagedExecutablePath, sideEffectsSuppressed } = deps();
  const { spawnSync } = require('child_process');
  const packagedRuntime = isPackagedExecutableRuntime();
  const command = packagedRuntime
    ? (process.env[STARTUP_PRIMARY_EXECUTABLE_ENV] || getPackagedExecutablePath())
    : process.execPath;
  // require.main.filename gives the entry point (gad.cjs) when running unpackaged.
  const entryFilename = require.main && require.main.filename ? require.main.filename : path.resolve(__dirname, '..', 'gad.cjs');
  const commandArgs = packagedRuntime
    ? ['snapshot', '--projectid', projectId, ...sessionArg, ...extraArgs]
    : [entryFilename, 'snapshot', '--projectid', projectId, ...sessionArg, ...extraArgs];
  const env = sideEffectsSuppressed()
    ? { ...process.env, GAD_NO_SIDE_EFFECTS_ACTIVE: '1' }
    : process.env;
  return spawnSync(command, commandArgs, { stdio: 'inherit', env });
}

function buildStartupCmd() {
  const {
    findRepoRoot, gadConfig, render,
    sideEffectsSuppressed, resolveSideEffectsMode, NO_SIDE_EFFECTS_FLAG,
    detectRuntimeIdentity, buildHandoffsSection, printSection, ensureGraphFresh,
    readState, writeEvolutionScan, maybeGenerateDailyTip,
    getLastActiveProjectid, setLastActiveProjectid,
    sessionHelpers,
  } = deps();
  const { sessionsDir, generateSessionId, SESSION_STATUS, buildContextRefs, writeSession } = sessionHelpers;

  return defineCommand({
    meta: { name: 'startup', description: 'Print the GAD session-start contract. Prefer `gad snapshot --projectid <id>` — snapshot is the canonical orientation command per decision 2026-04-20 D6 (phase-63 task 63-14 tracks the unification). `startup` remains as an alias.' },
    args: {
      projectid: { type: 'string', description: 'Project id to snapshot against (default: first root)', default: '' },
      'no-side-effects': { type: 'boolean', description: 'Read-only startup: suppress .planning/ writes, user-setting stamps, and session creation.', default: false },
    },
    run({ args }) {
      const lines = [
        'GAD session startup — one command gets you full context.',
        '',
        '  gad snapshot --projectid <id>      # full context dump, ~6-7k tokens',
        '',
        '  NOTE: `gad snapshot` is the canonical orientation command (D6, 2026-04-20).',
        '        `gad startup` is an alias kept for one release.',
        '',
        'What snapshot gives you:',
        '  - STATE.xml (current phase, next-action, references)',
        '  - ROADMAP in-sprint phases',
        '  - Open + recently-done tasks in sprint window',
        '  - Recent decisions (last 30)',
        '  - EQUIPPED SKILLS (top 5 by relevance, with workflow pointers)',
        '  - DOCS-MAP + file references',
        '',
        'After reading snapshot output:',
        '  1. Act on the <next-action> line in STATE.xml — this is what to do next.',
        '  2. Browse EQUIPPED SKILLS for skills relevant to the current sprint.',
        '     Use `gad skill show <id>` to inspect any skill end-to-end.',
        '  3. Use `gad skill list --paths` for the full skill inventory with paths.',
        '',
        'Cross-session continuity:',
        '  - Decisions live in .planning/DECISIONS.xml — query with `gad decisions`.',
        '  - Task attribution is on TASK-REGISTRY.xml entries (skill= attribute).',
        '  - Re-run snapshot after auto-compact to re-hydrate.',
        '',
        'Rehydration cost note (decision gad-195, 2026-04-15):',
        '  Snapshot is ~6-7k tokens. Running it every turn wastes cache. Run it',
        '  once at session start and at clean phase boundaries. Between those',
        '  points, trust the planning doc edits you made — they are durable.',
        '',
        'Common project ids on this repo:',
      ];
      const startupBaseDir = findRepoRoot();
      let startupConfig = null;
      try {
        startupConfig = gadConfig.load(startupBaseDir);
        for (const root of startupConfig.roots || []) {
          lines.push(`  - ${root.id}`);
        }
      } catch {
        lines.push('  (run `gad projects list` to see available project ids)');
      }
      lines.push('');
      lines.push('Single most important command: `gad snapshot --projectid <id>`.');
      lines.push('Everything else is optional until you have that context.');
      const sideEffectsMode = resolveSideEffectsMode();
      if (sideEffectsMode.enabled) {
        lines.push('');
        lines.push(`Side effects suppressed: ${sideEffectsMode.reasons.join(', ')}`);
      }
      console.log(lines.join('\n'));

      // HANDOFFS FOR YOU — surface open handoffs matching the detected
      // runtime so this session can auto-pick up work waiting for it.
      try {
        const detectedRuntime = detectRuntimeIdentity().id;
        const handoffSection = buildHandoffsSection({
          baseDir: startupBaseDir,
          runtime: detectedRuntime && detectedRuntime !== 'unknown' ? detectedRuntime : undefined,
          mineFirst: !!detectedRuntime && detectedRuntime !== 'unknown',
          limit: 5,
        });
        if (handoffSection) {
          console.log('');
          printSection(handoffSection);
          if (detectedRuntime && detectedRuntime !== 'unknown') {
            console.log(`Auto-claim the best match for your runtime: \`gad handoffs claim-next --runtime ${detectedRuntime}\``);
          } else {
            console.log('Runtime not auto-detected — pass `--runtime <id>` to `gad handoffs claim-next` to pick up.');
          }
        }
      } catch { /* non-fatal — snapshot still runs without handoffs section */ }

      // DAILY SUBAGENTS — surface today's pending subagent dispatches.
      try {
        const { listTodaysRuns } = require('../../lib/subagent-dispatch.cjs');
        const runs = listTodaysRuns({ baseDir: startupBaseDir });
        const pending = runs.filter((r) => r.status !== 'completed');
        if (pending.length > 0) {
          const envFlag = String(process.env.GAD_DAILY_AUTOSPAWN || '').toLowerCase();
          let autoSpawn = true;
          if (envFlag === 'off' || envFlag === 'false' || envFlag === '0') {
            autoSpawn = false;
          } else {
            try {
              const cfg = startupConfig || (gadConfig && gadConfig.load ? gadConfig.load(startupBaseDir) : null);
              if (cfg && cfg.subagents && cfg.subagents.autoSpawn === false) autoSpawn = false;
            } catch { /* noop */ }
          }

          console.log('');
          console.log(`-- DAILY SUBAGENTS PENDING (${pending.length}) ${'-'.repeat(Math.max(0, 38 - String(pending.length).length))}`);
          const rows = pending.map((r) => ({
            project: r.projectId,
            task: r.taskId || '-',
            status: r.status,
            prompt: r.promptPath ? path.relative(startupBaseDir, path.join(startupBaseDir, r.promptPath)) : '-',
          }));
          console.log(render(rows, { format: 'table', headers: ['project', 'task', 'status', 'prompt'] }));
          console.log('');
          if (autoSpawn) {
            console.log('AUTO-SPAWN (default-on): spawn each subagent NOW via your runtime\'s Agent / subprocess-spawn mechanism.');
            console.log('Model recommendation: Haiku for mechanical tasks, Sonnet for implementation (see tip multi-agent-offload-cheaper-01).');
            console.log('After the subagent commits:');
          } else {
            console.log('AUTO-SPAWN DISABLED (config). Orchestrator: spawn manually when ready, then:');
          }
          for (const p of pending) {
            const taskFlag = p.taskId ? ` --task-id ${p.taskId}` : '';
            console.log(`  gad subagents mark-completed --projectid ${p.projectId}${taskFlag} --commit <sha>`);
          }
          if (autoSpawn) {
            console.log('');
            console.log('Opt out: set `[subagents] autoSpawn = false` in gad-config.toml, or env GAD_DAILY_AUTOSPAWN=off.');
          }
          console.log('');
        }
      } catch { /* non-fatal — startup still runs without the daily-subagents section */ }

      let resolvedProjectid = String(args.projectid || '').trim();
      let resolvedSource = resolvedProjectid ? 'arg' : '';
      if (!resolvedProjectid) {
        try {
          const lastActiveProjectid = String(getLastActiveProjectid() || '').trim();
          const knownIds = new Set((startupConfig && startupConfig.roots ? startupConfig.roots : []).map((root) => root.id));
          if (lastActiveProjectid && knownIds.has(lastActiveProjectid)) {
            resolvedProjectid = lastActiveProjectid;
            resolvedSource = 'user-settings';
          }
        } catch { /* non-fatal */ }
      }
      if (!resolvedProjectid && startupConfig && Array.isArray(startupConfig.roots) && startupConfig.roots.length > 0) {
        resolvedProjectid = startupConfig.roots[0].id;
        resolvedSource = 'first-root';
      }

      if (resolvedProjectid) {
        console.log('');
        if (resolvedSource === 'user-settings') {
          console.log(`Resolved projectid from user settings: ${resolvedProjectid}`);
        } else if (resolvedSource === 'first-root') {
          console.log(`Resolved projectid from first configured root: ${resolvedProjectid}`);
        }
        try {
          if (!sideEffectsSuppressed()) {
            if (!startupConfig) startupConfig = gadConfig.load(startupBaseDir);
            const startupRoot = (startupConfig.roots || []).find(r => r.id === resolvedProjectid);
            if (startupRoot) {
              const r = ensureGraphFresh(startupBaseDir, startupRoot);
              if (r.rebuilt) console.log(`Graph cache rebuilt (${r.reason})`);
            }
          }
        } catch { /* non-fatal */ }
        let sessionArg = [];
        try {
          if (!sideEffectsSuppressed()) {
            if (!startupConfig) startupConfig = gadConfig.load(startupBaseDir);
            const startupRoots = startupConfig.roots.filter(r => r.id === resolvedProjectid);
            if (startupRoots.length > 0) {
              const startupRoot = startupRoots[0];
              const sDir = sessionsDir(startupBaseDir, startupRoot);
              fs.mkdirSync(sDir, { recursive: true });
              const state = readState(startupRoot, startupBaseDir);
              const newSession = {
                id: generateSessionId(),
                projectId: startupRoot.id,
                contextMode: 'loaded',
                position: { phase: state.currentPhase || null, plan: null, task: null },
                status: SESSION_STATUS.ACTIVE,
                refs: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                _root: startupRoot,
                _file: path.join(sDir, `${generateSessionId()}.json`),
              };
              newSession._file = path.join(sDir, `${newSession.id}.json`);
              newSession.refs = buildContextRefs(startupRoot, startupBaseDir, newSession);
              writeSession(newSession);
              sessionArg = ['--session', newSession.id];
              console.log(`Session created: ${newSession.id}`);
            }
          }
        } catch { /* non-fatal — snapshot still works without session */ }

        if (!sideEffectsSuppressed()) {
          try { maybeGenerateDailyTip(); } catch { /* non-fatal */ }
        }

        console.log(`Running snapshot now for projectid=${resolvedProjectid}...`);
        console.log('');
        try {
          if (!sideEffectsSuppressed() && startupConfig && Array.isArray(startupConfig.roots)) {
            const startupRoot = startupConfig.roots.find((candidate) => candidate.id === resolvedProjectid);
            if (startupRoot) writeEvolutionScan(startupRoot, startupBaseDir, path.resolve(__dirname, '..', '..'));
          }
        } catch { /* non-fatal */ }
        const result = runStartupSnapshot(
          resolvedProjectid,
          sessionArg,
          sideEffectsSuppressed() ? [NO_SIDE_EFFECTS_FLAG] : [],
        );
        const exitCode = result.status || (result.error ? 1 : 0);
        if (exitCode === 0 && !sideEffectsSuppressed()) {
          try { setLastActiveProjectid(resolvedProjectid); } catch { /* non-fatal */ }
        }
        process.exit(exitCode);
      }
    },
  });
}

function createStartupCommand(injected) {
  _deps = injected;
  return buildStartupCmd();
}

module.exports = {
  createStartupCommand,
};

module.exports.register = (ctx) => ({
  startup: createStartupCommand({
    ...ctx.common,
    sessionHelpers: {
      sessionsDir: ctx.services.session.sessionsDir,
      generateSessionId: ctx.services.session.generateSessionId,
      SESSION_STATUS: ctx.services.session.helpers.SESSION_STATUS,
      buildContextRefs: ctx.services.session.helpers.buildContextRefs,
      writeSession: ctx.services.session.writeSession,
    },
  }),
});
