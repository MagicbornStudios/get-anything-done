'use strict';

const { resolveProjectRoot } = require('./resolve-project.cjs');
const { resolveSnapshotSession } = require('./resolve-session.cjs');
const { buildScopeDescriptor, resolveScopedSnapshot } = require('./resolve-scope.cjs');
const { materializeSnapshotAgentContext, resolveSnapshotAgentState } = require('./resolve-agent.cjs');

function resolveSnapshotContext(deps, args) {
  const projectContext = resolveProjectRoot(deps, args);
  if (!projectContext) return null;

  const { baseDir, config, root, planDir } = projectContext;
  const sprintSize = config.sprintSize || 5;
  const useFull = args.full;
  const readOnlySnapshot = deps.sideEffectsSuppressed();

  if (!readOnlySnapshot) {
    const result = deps.ensureGraphFresh(baseDir, root);
    if (result.rebuilt) console.error(`[snapshot] graph cache rebuilt (${result.reason})`);
  }

  const { snapshotSession, resolvedMode } = resolveSnapshotSession(deps, baseDir, root, args);
  const sdkAssetAliases = {
    '@skills': 'skills',
    '@workflows': 'workflows',
    '@templates': 'templates',
    '@references': 'references',
    '@agents': 'agents',
    '@hooks': 'hooks',
  };
  const scoped = resolveScopedSnapshot(deps, root, baseDir, planDir, args);
  const agentState = resolveSnapshotAgentState(deps, planDir, args, scoped.scopedPhaseId, scoped.scopedTaskId);
  const scope = buildScopeDescriptor(root, scoped);
  const agentContext = materializeSnapshotAgentContext(deps, {
    planDir,
    readOnlySnapshot,
    scopedTaskId: scoped.scopedTaskId,
    allTasks: scoped.allTasks,
  }, agentState);

  return {
    baseDir,
    config,
    root,
    planDir,
    sprintSize,
    useFull,
    readOnlySnapshot,
    snapshotSession,
    resolvedMode,
    sdkAssetAliases,
    ...scoped,
    ...agentContext,
    scope,
  };
}

module.exports = { resolveSnapshotContext };
