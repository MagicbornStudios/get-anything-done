'use strict';

const { defineCommand } = require('citty');
const {
  buildSnapshotSectionPayload,
  countSectionTokensApprox,
  printSections,
  resolveSnapshotContext,
} = require('./snapshot/shared.cjs');
const { handleFullSnapshot } = require('./snapshot/full.cjs');
const { handleScopedSnapshot } = require('./snapshot/scoped.cjs');
const { handleSprintSnapshot } = require('./snapshot/sprint.cjs');

function createSnapshotCommand(deps) {
  const commandDeps = {
    ...deps,
    buildSnapshotSectionPayload,
    countSectionTokensApprox,
    printSections,
  };

  return defineCommand({
    meta: { name: 'snapshot', description: 'Print all planning files inlined for a project' },
    args: {
      projectid: { type: 'string', description: 'Project ID (default: first root)', default: '' },
      project: { type: 'string', description: 'Project ID (alias for --projectid)', default: '' },
      phaseid: { type: 'string', description: 'Scope snapshot to one phase id', default: '' },
      taskid: { type: 'string', description: 'Scope snapshot to one task id', default: '' },
      agentid: { type: 'string', description: 'Existing agent id to reuse', default: '' },
      role: { type: 'string', description: 'Logical agent role for auto-registration', default: '' },
      runtime: { type: 'string', description: 'Runtime identity override (claude-code, codex, cursor, human, etc.)', default: '' },
      'parent-agentid': { type: 'string', description: 'Parent/root agent id when bootstrapping a subagent lane', default: '' },
      'model-profile': { type: 'string', description: 'Model profile attached to the lane', default: '' },
      'resolved-model': { type: 'string', description: 'Resolved concrete model attached to the lane', default: '' },
      full: { type: 'boolean', description: 'Full dump (no sprint filtering)', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
      skills: { type: 'string', description: 'Number of equipped skills to surface (44-35). 0 disables. Default: 5.', default: '5' },
      mode: { type: 'string', description: 'full (default) | active — "active" emits ONLY STATE.xml next-action + current phase + open sprint tasks (skips static catalog, references, decisions). Decision gad-195: static info loaded once at session start, active info re-pullable cheap without context waste.', default: '' },
      session: { type: 'string', description: 'Session ID. When provided, auto-downgrades to mode=active if static context was already delivered in this session. Env fallback: GAD_SESSION_ID.', default: '' },
      sessionid: { type: 'string', description: 'Session ID alias for --session (runtime command compatibility).', default: '' },
      format: { type: 'string', description: 'compact (default) | xml — "compact" strips XML envelope tokens (prolog, outer tags, per-item tag pairs) while preserving content. "xml" dumps raw file content (legacy). Decision gad-241.', default: 'compact' },
      'no-side-effects': { type: 'boolean', description: 'Read-only snapshot: suppress session/lane/log/graph writes.', default: false },
    },
    run({ args }) {
      const context = resolveSnapshotContext(commandDeps, args);
      if (!context) return;
      if (context.useFull) {
        handleFullSnapshot(commandDeps, context, args);
        return;
      }
      if (context.scope.isScoped) {
        handleScopedSnapshot(commandDeps, context, args);
        return;
      }
      handleSprintSnapshot(commandDeps, context, args);
    },
  });
}

module.exports = { createSnapshotCommand };
module.exports.register = (ctx) => ({
  snapshot: createSnapshotCommand({
    ...ctx.common,
    loadSessions: ctx.services.session.helpers.loadSessions,
    writeSession: ctx.services.session.writeSession,
    getCurrentSprintIndex: ctx.services.sprint.getCurrentSprintIndex,
    getSprintPhaseIds: ctx.services.sprint.getSprintPhaseIds,
  }),
});
