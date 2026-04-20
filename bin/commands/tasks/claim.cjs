'use strict';

const path = require('path');
const { defineCommand } = require('citty');

function createTasksClaimCommand(deps) {
  return defineCommand({
    meta: { name: 'claim', description: 'Claim a task for an active agent lane. Note: decision 2026-04-20 D2 — prefer `gad tasks stamp` for post-completion attribution. Handoff rename is the atomic work lock; pre-claim here is a soft reservation only.' },
    args: {
      task: { type: 'positional', description: 'Task ID (e.g. 41-02)', required: true },
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      agentid: { type: 'string', description: 'Existing agent id to reuse', default: '' },
      role: { type: 'string', description: 'Logical agent role for auto-registration', default: '' },
      runtime: { type: 'string', description: 'Runtime identity override', default: '' },
      'parent-agentid': { type: 'string', description: 'Parent agent id for spawned subagents', default: '' },
      'model-profile': { type: 'string', description: 'Model profile attached to the lane', default: '' },
      'resolved-model': { type: 'string', description: 'Resolved model attached to the lane', default: '' },
      'lease-minutes': { type: 'string', description: 'Optional soft lease duration in minutes', default: '0' },
      force: { type: 'boolean', description: 'Steal a task already claimed by another lane', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { baseDir, root } = deps.resolveSingleTaskRoot(deps, args.projectid);
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const allTasks = deps.readTasks(root, baseDir, {});
      const task = allTasks.find((row) => row.id === args.task);
      if (!task) deps.outputError(`Task not found: ${args.task}`);
      if (task.status === 'done') deps.outputError(`Task ${args.task} is already done and cannot be claimed.`);
      if (task.agentId && task.agentId !== (args.agentid || process.env.GAD_AGENT_ID || '') && !args.force) {
        deps.outputError(`Task ${args.task} is already claimed by ${task.agentId}. Re-run with --force to take it over.`);
      }

      const agentInputs = deps.resolveSnapshotAgentInputs(args);
      const runtimeIdentity = deps.resolveSnapshotRuntime(args.runtime, { humanFallback: true });
      const leaseMinutes = Math.max(0, parseInt(args['lease-minutes'], 10) || 0);
      const leaseExpiresAt = leaseMinutes > 0
        ? new Date(Date.now() + (leaseMinutes * 60 * 1000)).toISOString()
        : null;

      let agentBootstrap;
      try {
        agentBootstrap = deps.ensureAgentLane(planDir, {
          requestedAgentId: agentInputs.requestedAgentId,
          role: agentInputs.role,
          runtime: runtimeIdentity.id,
          runtimeSessionId: deps.detectRuntimeSessionId(),
          parentAgentId: agentInputs.parentAgentId,
          modelProfile: agentInputs.modelProfile,
          resolvedModel: agentInputs.resolvedModel || runtimeIdentity.model || null,
          leaseExpiresAt,
        });
      } catch (error) {
        deps.outputError(error && error.message ? error.message : String(error));
      }

      deps.claimTask(planDir, task.id, {
        agentId: agentBootstrap.agent.agentId,
        agentRole: agentBootstrap.agent.agentRole,
        runtime: agentBootstrap.agent.runtime,
        modelProfile: agentBootstrap.agent.modelProfile,
        resolvedModel: agentBootstrap.agent.resolvedModel,
        claimedAt: deps.nowIso(),
        leaseExpiresAt,
      });
      deps.addTaskClaim(planDir, agentBootstrap.agent.agentId, task.id, task.phase);

      deps.maybeRebuildGraph(baseDir, root);

      const updatedTask = deps.readTasks(root, baseDir, {}).find((row) => row.id === task.id);
      const payload = {
        project: root.id,
        claimed: true,
        task: updatedTask,
        agent: {
          agentId: agentBootstrap.agent.agentId,
          agentRole: agentBootstrap.agent.agentRole,
          runtime: agentBootstrap.agent.runtime,
          parentAgentId: agentBootstrap.agent.parentAgentId || null,
          rootAgentId: agentBootstrap.agent.rootAgentId || agentBootstrap.agent.agentId,
          depth: agentBootstrap.agent.depth,
          modelProfile: agentBootstrap.agent.modelProfile || null,
          resolvedModel: agentBootstrap.agent.resolvedModel || null,
        },
        force: args.force === true,
      };

      if (args.json || deps.shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      console.log(`Claimed ${task.id} for ${agentBootstrap.agent.agentId} (${agentBootstrap.agent.runtime}).`);
    },
  });
}

module.exports = { createTasksClaimCommand };
