import type {
  ActiveAssignmentsResult,
  AgentLaneRecord,
  ClaimTaskOptions,
  ClaimTaskResult,
  QueryTask,
  ReleaseTaskOptions,
  ReleaseTaskResult,
  ScopedSnapshotOptions,
  ScopedSnapshotResult,
  SnapshotAgentView,
} from './types.js';
import { addTaskClaim, buildAssignmentsView, ensureAgentLane, listAgentLanes, removeTaskClaim, touchAgentLane } from './agent-lanes.js';
import { detectRuntimeSessionId, resolveSnapshotRuntime } from './runtime.js';
import { readDocsMapXml, readRoadmapPhases, readStateXml } from './roadmap.js';
import { claimTaskRecord, readTaskById, readTaskRegistry, releaseTaskRecord } from './task-registry.js';

const SDK_ASSET_ALIASES = {
  '@skills': 'skills',
  '@workflows': 'workflows',
  '@templates': 'templates',
  '@references': 'references',
  '@agents': 'agents',
  '@hooks': 'hooks',
} as const;

function toAgentView(agent: AgentLaneRecord, autoRegistered: boolean): SnapshotAgentView {
  return {
    agentId: agent.agentId,
    agentRole: agent.agentRole,
    runtime: agent.runtime,
    runtimeSessionId: agent.runtimeSessionId || null,
    parentAgentId: agent.parentAgentId || null,
    rootAgentId: agent.rootAgentId || agent.agentId,
    depth: agent.depth,
    modelProfile: agent.modelProfile || null,
    resolvedModel: agent.resolvedModel || null,
    autoRegistered,
    humanOperator: agent.humanOperator === true,
  };
}

export async function getScopedSnapshot(projectDir: string, options: ScopedSnapshotOptions = {}): Promise<ScopedSnapshotResult> {
  const allTasks = await readTaskRegistry(projectDir);
  const phases = await readRoadmapPhases(projectDir);
  const scopedTaskId = String(options.taskId || '').trim();
  const scopedTask = scopedTaskId ? allTasks.find((task) => task.id === scopedTaskId) || null : null;
  if (scopedTaskId && !scopedTask) throw new Error(`Task not found for snapshot scope: ${scopedTaskId}`);

  const explicitPhaseId = String(options.phaseId || '').trim();
  const scopedPhaseId = explicitPhaseId || (scopedTask ? scopedTask.phase : '');
  if (scopedPhaseId && !phases.find((phase) => phase.id === scopedPhaseId)) {
    throw new Error(`Phase not found for snapshot scope: ${scopedPhaseId}`);
  }

  const runtimeIdentity = resolveSnapshotRuntime(options.runtime, {
    humanFallback: options.humanFallback ?? Boolean(scopedPhaseId || scopedTaskId || options.parentAgentId || options.role || options.agentId),
  });

  const shouldAutoRegister = Boolean(
    options.agentId ||
    options.parentAgentId ||
    options.role ||
    scopedPhaseId ||
    scopedTaskId ||
    process.env.GAD_AGENT_ID ||
    process.env.GAD_AGENT_ROLE ||
    process.env.GAD_PARENT_AGENT_ID
  );

  let bootstrap: Awaited<ReturnType<typeof ensureAgentLane>> | null = null;
  if (shouldAutoRegister && runtimeIdentity.id !== 'unknown') {
    bootstrap = await ensureAgentLane(projectDir, {
      requestedAgentId: options.agentId,
      role: options.role || 'default',
      runtime: runtimeIdentity.id,
      runtimeSessionId: detectRuntimeSessionId(),
      parentAgentId: options.parentAgentId || null,
      modelProfile: options.modelProfile || null,
      resolvedModel: options.resolvedModel || runtimeIdentity.model || null,
    });
  }

  let laneListing = await listAgentLanes(projectDir);
  const currentAgent = bootstrap?.agent
    || (options.agentId ? laneListing.activeAgents.find((agent) => agent.agentId === options.agentId) || null : null);

  if (currentAgent) {
    await touchAgentLane(projectDir, currentAgent.agentId, {
      runtime: runtimeIdentity.id,
      runtimeSessionId: detectRuntimeSessionId() || currentAgent.runtimeSessionId || null,
      resolvedModel: options.resolvedModel || runtimeIdentity.model || currentAgent.resolvedModel || null,
    });
    laneListing = await listAgentLanes(projectDir);
  }

  const refreshedAgent = currentAgent ? laneListing.activeAgents.find((agent) => agent.agentId === currentAgent.agentId) || currentAgent : null;
  const phase = scopedPhaseId ? phases.find((row) => row.id === scopedPhaseId) || null : null;
  const peerTasks = scopedTask
    ? allTasks.filter((task) => task.phase === scopedTask.phase && task.id !== scopedTask.id && task.status !== 'done')
    : scopedPhaseId
      ? allTasks.filter((task) => task.phase === scopedPhaseId && task.status !== 'done')
      : [];

  const projectId = options.projectId || projectDir.split(/[\\/]/).pop() || 'project';
  return {
    projectId,
    planningDir: '.planning',
    sdkAssetAliases: SDK_ASSET_ALIASES as Record<string, string>,
    scope: {
      projectId,
      phaseId: scopedPhaseId || null,
      taskId: scopedTaskId || null,
      snapshotMode: scopedTask ? 'task' : (scopedPhaseId ? 'phase' : 'project'),
      isScoped: Boolean(scopedTask || scopedPhaseId),
    },
    agent: refreshedAgent ? toAgentView(refreshedAgent, bootstrap?.autoRegistered === true) : null,
    assignments: buildAssignmentsView(allTasks, laneListing.activeAgents, laneListing.staleAgents, refreshedAgent, scopedTaskId || null),
    stateXml: await readStateXml(projectDir),
    task: scopedTask,
    phase,
    peerTasks,
    allTasks,
    allPhases: phases,
    docsMapXml: await readDocsMapXml(projectDir),
  };
}

export async function claimTask(projectDir: string, options: ClaimTaskOptions): Promise<ClaimTaskResult> {
  const task = await readTaskById(projectDir, options.taskId);
  if (!task) throw new Error(`Task not found: ${options.taskId}`);
  const runtimeIdentity = resolveSnapshotRuntime(options.runtime, { humanFallback: true });
  const bootstrap = await ensureAgentLane(projectDir, {
    requestedAgentId: options.agentId,
    role: options.role || 'default',
    runtime: runtimeIdentity.id,
    runtimeSessionId: detectRuntimeSessionId(),
    parentAgentId: options.parentAgentId || null,
    modelProfile: options.modelProfile || null,
    resolvedModel: options.resolvedModel || runtimeIdentity.model || null,
    leaseExpiresAt: options.leaseExpiresAt || null,
  });
  await claimTaskRecord(projectDir, options.taskId, {
    agentId: bootstrap.agent.agentId,
    agentRole: bootstrap.agent.agentRole,
    runtime: bootstrap.agent.runtime,
    modelProfile: bootstrap.agent.modelProfile,
    resolvedModel: bootstrap.agent.resolvedModel,
    leaseExpiresAt: options.leaseExpiresAt || null,
    status: options.status || 'in-progress',
  });
  await addTaskClaim(projectDir, bootstrap.agent.agentId, options.taskId, task.phase || null);
  const updatedTask = await readTaskById(projectDir, options.taskId);
  return {
    agent: (await listAgentLanes(projectDir)).activeAgents.find((agent) => agent.agentId === bootstrap.agent.agentId) || bootstrap.agent,
    autoRegistered: bootstrap.autoRegistered,
    task: updatedTask as QueryTask,
  };
}

export async function releaseTask(projectDir: string, options: ReleaseTaskOptions): Promise<ReleaseTaskResult> {
  const task = await readTaskById(projectDir, options.taskId);
  if (!task) throw new Error(`Task not found: ${options.taskId}`);
  await releaseTaskRecord(projectDir, options.taskId, { done: options.done, status: options.status });
  let updatedAgent: AgentLaneRecord | null = null;
  if (options.agentId) {
    updatedAgent = await removeTaskClaim(projectDir, options.agentId, options.taskId, task.phase || null, true);
  }
  const updatedTask = await readTaskById(projectDir, options.taskId);
  return {
    agent: updatedAgent,
    task: updatedTask as QueryTask,
  };
}

export async function listActiveAssignments(projectDir: string): Promise<ActiveAssignmentsResult> {
  const allTasks = await readTaskRegistry(projectDir);
  const laneListing = await listAgentLanes(projectDir);
  return {
    activeTasks: allTasks.filter((task) => task.status === 'in-progress' || task.claimed || Boolean(task.agentId)),
    activeAgents: laneListing.activeAgents.map((agent) => ({
      agentId: agent.agentId,
      agentRole: agent.agentRole,
      runtime: agent.runtime,
      depth: agent.depth,
      parentAgentId: agent.parentAgentId || null,
      rootAgentId: agent.rootAgentId || agent.agentId,
      modelProfile: agent.modelProfile || null,
      resolvedModel: agent.resolvedModel || null,
      tasks: Array.from(new Set([
        ...(agent.claimedTaskIds || []),
        ...allTasks.filter((task) => task.agentId === agent.agentId && task.status !== 'done').map((task) => task.id),
      ])),
      lastSeenAt: agent.lastSeenAt || null,
      status: agent.status,
    })),
    staleAgents: laneListing.staleAgents.map((agent) => ({
      agentId: agent.agentId,
      agentRole: agent.agentRole,
      runtime: agent.runtime,
      depth: agent.depth,
      parentAgentId: agent.parentAgentId || null,
      rootAgentId: agent.rootAgentId || agent.agentId,
      modelProfile: agent.modelProfile || null,
      resolvedModel: agent.resolvedModel || null,
      tasks: Array.from(new Set([
        ...(agent.claimedTaskIds || []),
        ...allTasks.filter((task) => task.agentId === agent.agentId && task.status !== 'done').map((task) => task.id),
      ])),
      lastSeenAt: agent.lastSeenAt || null,
      status: agent.status,
    })),
  };
}

