// Misc CLI helpers extracted from bin/gad.cjs. Pure utilities and a few
// helpers that take their host-specific deps via factories.

const { detectRuntimeIdentity } = require('./runtime-detect.cjs');
const { runtimeInstallHint } = require('./eval-helpers.cjs');

const PROJECT_NAMESPACE_MAP = {
  'get-anything-done': 'GAD',
  'escape-the-dungeon': 'ETD',
  'escape-the-dungeon-bare': 'ETD',
  'escape-the-dungeon-emergent': 'ETD',
  'escape-the-dungeon-gad-emergent': 'ETD',
  'escape-the-dungeon-planning-only': 'ETD',
  'etd-brownfield-bare': 'ETD',
  'etd-brownfield-emergent': 'ETD',
  'etd-brownfield-gad': 'ETD',
  'etd-phaser': 'ETD',
  'etd-pixijs': 'ETD',
  'etd-threejs': 'ETD',
  'etd-babylonjs': 'ETD',
  'grime-time': 'GRIME',
  'grime-time-site': 'GRIME',
  'repo-planner': 'RP',
  'repub-builder': 'REPUB',
  'mb-cli-framework': 'MBCLI',
  'gad-manuscript': 'GADMS',
  'global': 'GLOBAL',
};

function projectNamespace(projectId) {
  if (PROJECT_NAMESPACE_MAP[projectId]) return PROJECT_NAMESPACE_MAP[projectId];
  return projectId.split('-').map((w) => w[0] || '').join('').toUpperCase().slice(0, 5) || 'UNK';
}

function formatId(projectId, type, number) {
  return `${projectNamespace(projectId)}-${type}-${number}`;
}

function detectAgentTelemetry() {
  const agentId = (process.env.GAD_AGENT_ID || '').trim();
  const parentAgentId = (process.env.GAD_PARENT_AGENT_ID || '').trim();
  const rootAgentId = (process.env.GAD_ROOT_AGENT_ID || parentAgentId || agentId || '').trim();
  const depthRaw = process.env.GAD_AGENT_DEPTH;
  const parsedDepth = Number.parseInt(depthRaw || '', 10);
  return {
    agent_id: agentId || null,
    agent_role: (process.env.GAD_AGENT_ROLE || '').trim() || null,
    parent_agent_id: parentAgentId || null,
    root_agent_id: rootAgentId || null,
    depth: Number.isFinite(parsedDepth) ? parsedDepth : null,
    model_profile: (process.env.GAD_MODEL_PROFILE || '').trim() || null,
    resolved_model: (process.env.GAD_RESOLVED_MODEL || '').trim() || null,
  };
}

function normalizeEvalRuntime(runtime) {
  const value = String(runtime || '').trim().toLowerCase();
  if (!value) return detectRuntimeIdentity();
  if (value === 'claude' || value === 'claude-code') return { id: 'claude-code', source: 'eval-arg', model: null };
  if (value === 'gemini') return { id: 'gemini-cli', source: 'eval-arg', model: null };
  if (['codex', 'cursor', 'windsurf'].includes(value)) return { id: value, source: 'eval-arg', model: null };
  return { id: value, source: 'eval-arg', model: null };
}

function runtimeInstallFlag(runtimeId) {
  if (runtimeId === 'claude-code') return '--claude';
  if (runtimeId === 'codex') return '--codex';
  if (runtimeId === 'cursor') return '--cursor';
  if (runtimeId === 'windsurf') return '--windsurf';
  if (runtimeId === 'gemini-cli') return '--gemini';
  return null;
}

function resolveSnapshotRuntime(runtimeArg, { humanFallback = false } = {}) {
  const normalized = normalizeEvalRuntime(runtimeArg);
  if (runtimeArg && normalized.id !== 'unknown') return normalized;
  const detected = detectRuntimeIdentity();
  if (detected.id !== 'unknown') return detected;
  if (humanFallback) return { id: 'human', source: 'snapshot-fallback', model: null };
  return detected;
}

function resolveSnapshotAgentInputs(args) {
  const requestedAgentId = (args.agentid || process.env.GAD_AGENT_ID || '').trim();
  const role = (args.role || process.env.GAD_AGENT_ROLE || 'default').trim() || 'default';
  const parentAgentId = (args.parentAgentid || args['parent-agentid'] || process.env.GAD_PARENT_AGENT_ID || '').trim() || null;
  const modelProfile = (args.modelProfile || args['model-profile'] || process.env.GAD_MODEL_PROFILE || '').trim() || null;
  const resolvedModel = (args.resolvedModel || args['resolved-model'] || process.env.GAD_RESOLVED_MODEL || '').trim() || null;
  return { requestedAgentId, role, parentAgentId, modelProfile, resolvedModel };
}

function simplifyAgentLane(agent, taskMap = new Map()) {
  const tasks = Array.from(new Set([
    ...(Array.isArray(agent?.claimedTaskIds) ? agent.claimedTaskIds : []),
    ...Array.from(taskMap.values())
      .filter((task) => task.agentId === agent.agentId && task.status !== 'done')
      .map((task) => task.id),
  ]));
  return {
    agentId: agent.agentId,
    agentRole: agent.agentRole,
    runtime: agent.runtime,
    depth: agent.depth,
    parentAgentId: agent.parentAgentId || null,
    rootAgentId: agent.rootAgentId || agent.agentId,
    modelProfile: agent.modelProfile || null,
    resolvedModel: agent.resolvedModel || null,
    tasks,
    lastSeenAt: agent.lastSeenAt || null,
    status: agent.status || 'active',
  };
}

function buildAssignmentsView(allTasks, activeAgents, staleAgents, currentAgent, scopedTaskId) {
  const taskMap = new Map(allTasks.map((task) => [task.id, task]));
  const activeRows = activeAgents.map((agent) => simplifyAgentLane(agent, taskMap));
  const staleRows = staleAgents.map((agent) => simplifyAgentLane(agent, taskMap));
  const selfTaskIds = currentAgent
    ? Array.from(new Set([
        ...(Array.isArray(currentAgent.claimedTaskIds) ? currentAgent.claimedTaskIds : []),
        ...allTasks.filter((task) => task.agentId === currentAgent.agentId && task.status !== 'done').map((task) => task.id),
      ]))
    : [];
  const collisions = [];
  if (scopedTaskId) {
    const scopedTask = taskMap.get(scopedTaskId);
    if (scopedTask && scopedTask.agentId && (!currentAgent || scopedTask.agentId !== currentAgent.agentId)) {
      collisions.push({
        taskId: scopedTask.id,
        agentId: scopedTask.agentId,
        agentRole: scopedTask.agentRole || null,
        runtime: scopedTask.runtime || null,
        status: scopedTask.status,
      });
    }
  }
  return { self: selfTaskIds, activeAgents: activeRows, collisions, staleAgents: staleRows };
}

function ensureEvalRuntimeHooks(runtimeIdentity, { outputError, gadEntryPath } = {}) {
  const runtimeId = runtimeIdentity?.id || 'unknown';
  const flag = runtimeInstallFlag(runtimeId);
  if (!flag) {
    return {
      attempted: false, ok: false, runtime: runtimeId,
      note: `No automatic installer mapping for runtime '${runtimeId}'. Run ${runtimeInstallHint(runtimeId)} manually before starting the eval.`,
    };
  }
  const { spawnSync } = require('child_process');
  const packaged = Boolean(process.env.GAD_PACKAGED_EXECUTABLE || process.env.GAD_PACKAGED_ROOT);
  const command = packaged ? (process.env.GAD_PACKAGED_EXECUTABLE || process.execPath) : process.execPath;
  const commandArgs = packaged
    ? ['__gad_internal_install__', flag, '--global']
    : [gadEntryPath, 'install', 'all', flag, '--global'];
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    if (outputError) outputError(`Failed to install/verify GAD hooks for runtime '${runtimeId}'.`);
    else throw new Error(`Failed to install/verify GAD hooks for runtime '${runtimeId}'.`);
  }
  return { attempted: true, ok: true, runtime: runtimeId, note: `Ensured runtime install for ${runtimeId} via ${flag}.` };
}

module.exports = {
  PROJECT_NAMESPACE_MAP,
  projectNamespace, formatId,
  detectAgentTelemetry,
  normalizeEvalRuntime, runtimeInstallFlag,
  resolveSnapshotRuntime, resolveSnapshotAgentInputs,
  simplifyAgentLane, buildAssignmentsView,
  ensureEvalRuntimeHooks,
};
