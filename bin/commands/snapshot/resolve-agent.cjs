'use strict';

function resolveSnapshotAgentState(deps, planDir, args, scopedPhaseId, scopedTaskId) {
  const agentInputs = deps.resolveSnapshotAgentInputs(args);
  const detectedRuntime = deps.detectRuntimeIdentity();
  const shouldAutoRegister = Boolean(
    agentInputs.requestedAgentId ||
    agentInputs.parentAgentId ||
    args.role ||
    scopedPhaseId ||
    scopedTaskId ||
    process.env.GAD_AGENT_ID ||
    process.env.GAD_AGENT_ROLE ||
    process.env.GAD_PARENT_AGENT_ID
  );
  const runtimeIdentity = deps.resolveSnapshotRuntime(args.runtime, {
    humanFallback: Boolean(scopedPhaseId || scopedTaskId || agentInputs.parentAgentId || args.role || args.agentid),
  });

  return {
    agentInputs,
    detectedRuntime,
    shouldAutoRegister,
    runtimeIdentity,
  };
}

function materializeSnapshotAgentContext(deps, context, agentState) {
  const { planDir, readOnlySnapshot, scopedTaskId, allTasks } = context;

  let agentBootstrap = null;
  if (!readOnlySnapshot && agentState.shouldAutoRegister && agentState.runtimeIdentity.id !== 'unknown') {
    try {
      agentBootstrap = deps.ensureAgentLane(planDir, {
        requestedAgentId: agentState.agentInputs.requestedAgentId,
        role: agentState.agentInputs.role,
        runtime: agentState.runtimeIdentity.id,
        runtimeSessionId: deps.detectRuntimeSessionId(),
        parentAgentId: agentState.agentInputs.parentAgentId,
        modelProfile: agentState.agentInputs.modelProfile,
        resolvedModel: agentState.agentInputs.resolvedModel || agentState.runtimeIdentity.model || null,
      });
    } catch (error) {
      deps.outputError(error && error.message ? error.message : String(error));
    }
  }

  let laneListing = deps.listAgentLanes(planDir);
  const currentAgent = agentBootstrap?.agent
    || (agentState.agentInputs.requestedAgentId
      ? laneListing.activeAgents.find((agent) => agent.agentId === agentState.agentInputs.requestedAgentId) || null
      : null);

  if (!readOnlySnapshot && currentAgent) {
    deps.touchAgentLane(planDir, currentAgent.agentId, {
      runtime: agentState.runtimeIdentity.id,
      runtimeSessionId: deps.detectRuntimeSessionId() || currentAgent.runtimeSessionId || null,
      resolvedModel: agentState.agentInputs.resolvedModel || agentState.runtimeIdentity.model || currentAgent.resolvedModel || null,
    });
    laneListing = deps.listAgentLanes(planDir);
  }

  const assignments = deps.buildAssignmentsView(
    allTasks,
    laneListing.activeAgents,
    laneListing.staleAgents,
    currentAgent,
    scopedTaskId || null
  );
  const agentView = currentAgent ? {
    agentId: currentAgent.agentId,
    agentRole: currentAgent.agentRole,
    runtime: currentAgent.runtime,
    runtimeSessionId: currentAgent.runtimeSessionId || null,
    parentAgentId: currentAgent.parentAgentId || null,
    rootAgentId: currentAgent.rootAgentId || currentAgent.agentId,
    depth: currentAgent.depth,
    modelProfile: currentAgent.modelProfile || null,
    resolvedModel: currentAgent.resolvedModel || null,
    autoRegistered: agentBootstrap?.autoRegistered === true,
    humanOperator: currentAgent.humanOperator === true,
  } : null;

  return {
    detectedRuntime: agentState.detectedRuntime,
    runtimeIdentity: agentState.runtimeIdentity,
    laneListing,
    assignments,
    agentView,
  };
}

module.exports = {
  materializeSnapshotAgentContext,
  resolveSnapshotAgentState,
};
