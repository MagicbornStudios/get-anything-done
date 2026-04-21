'use strict';
/**
 * gad startup — print the GAD session-start contract and run snapshot.
 *
 * Thin orchestrator. All behaviour lives in lib/startup/*.cjs, composable
 * and reusable by `gad snapshot`, `gad dashboard`, and future entry points.
 *
 * Required deps (object passed to createStartupCommand):
 *   findRepoRoot, gadConfig, render,
 *   sideEffectsSuppressed, resolveSideEffectsMode, NO_SIDE_EFFECTS_FLAG,
 *   isPackagedExecutableRuntime, getPackagedExecutablePath,
 *   detectRuntimeIdentity, buildHandoffsSection, printSection,
 *   ensureGraphFresh, readState, writeEvolutionScan, maybeGenerateDailyTip,
 *   getLastActiveProjectid, setLastActiveProjectid,
 *   sessionHelpers: { sessionsDir, generateSessionId, SESSION_STATUS, buildContextRefs, writeSession }
 */

const path = require('path');
const { defineCommand } = require('citty');

const { printContract } = require('../../lib/startup/contract.cjs');
const { printHandoffsSection } = require('../../lib/startup/handoffs-section.cjs');
const { printDailySubagents } = require('../../lib/startup/subagents-section.cjs');
const { resolveProjectId, announceResolution } = require('../../lib/startup/resolve-projectid.cjs');
const { bootstrapSession } = require('../../lib/startup/session-bootstrap.cjs');
const { spawnSnapshot } = require('../../lib/startup/snapshot-reentry.cjs');

let _deps = null;
function deps() {
  if (!_deps) throw new Error('startup.cjs: createStartupCommand() must be called first');
  return _deps;
}

function buildStartupCmd() {
  const {
    findRepoRoot, gadConfig, render,
    sideEffectsSuppressed, resolveSideEffectsMode, NO_SIDE_EFFECTS_FLAG,
    isPackagedExecutableRuntime, getPackagedExecutablePath,
    detectRuntimeIdentity, buildHandoffsSection, printSection, ensureGraphFresh,
    readState, writeEvolutionScan, maybeGenerateDailyTip,
    getLastActiveProjectid, setLastActiveProjectid,
    sessionHelpers,
  } = deps();

  return defineCommand({
    meta: {
      name: 'startup',
      description:
        'Print the GAD session-start contract. Prefer `gad snapshot --projectid <id>` — snapshot is the canonical orientation command per decision 2026-04-20 D6 (phase-63 task 63-14 tracks the unification). `startup` remains as an alias.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id to snapshot against (default: first root)', default: '' },
      'no-side-effects': { type: 'boolean', description: 'Read-only startup: suppress .planning/ writes, user-setting stamps, and session creation.', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const frameworkDir = path.resolve(__dirname, '..', '..');
      const sideEffectsMode = resolveSideEffectsMode();

      let config = null;
      try { config = gadConfig.load(baseDir); } catch { /* non-fatal */ }

      printContract({ config, sideEffectsMode });
      printHandoffsSection({ baseDir, detectRuntimeIdentity, buildHandoffsSection, printSection });
      printDailySubagents({ baseDir, config, render });

      const { projectId, source } = resolveProjectId({ args, config, getLastActiveProjectid });
      if (!projectId) return;

      console.log('');
      announceResolution({ projectId, source });

      const { sessionArg } = bootstrapSession({
        projectId, baseDir, config, frameworkDir,
        sideEffectsSuppressed, ensureGraphFresh, readState, writeEvolutionScan,
        sessionHelpers,
      });

      if (!sideEffectsSuppressed()) {
        try { maybeGenerateDailyTip(); } catch { /* non-fatal */ }
      }

      console.log(`Running snapshot now for projectid=${projectId}...`);
      console.log('');

      const exitCode = spawnSnapshot({
        projectId,
        sessionArg,
        isPackagedExecutableRuntime,
        getPackagedExecutablePath,
        sideEffectsSuppressed,
        NO_SIDE_EFFECTS_FLAG,
      });

      if (exitCode === 0 && !sideEffectsSuppressed()) {
        try { setLastActiveProjectid(projectId); } catch { /* non-fatal */ }
      }
      process.exit(exitCode);
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
