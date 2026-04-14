import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  AgentBootstrapOptions,
  AgentBootstrapResult,
  AgentLaneRecord,
  AgentLaneState,
  AssignmentView,
  QueryTask,
  SimplifiedAgentLane,
} from './types.js';

export const AGENT_LANES_FILE = '.gad-agent-lanes.json';
export const DEFAULT_STALE_AFTER_MS = 30 * 60 * 1000;

const DEFAULT_LANE_STATE: AgentLaneState = {
  version: 1,
  agents: [],
  sequenceByKey: {},
};

function planningFile(projectDir: string): string {
  return join(projectDir, '.planning', AGENT_LANES_FILE);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function sanitizeAgentSegment(value: string | null | undefined, fallback = 'default'): string {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function runtimePrefix(runtimeId: string): string {
  const normalized = sanitizeAgentSegment(runtimeId, 'agent');
  if (normalized === 'claude-code' || normalized === 'claude') return 'claude';
  if (normalized.startsWith('cursor')) return 'cursor';
  if (normalized === 'codex') return 'codex';
  if (normalized.startsWith('windsurf')) return 'windsurf';
  if (normalized.startsWith('gemini')) return 'gemini';
  if (normalized === 'human') return 'human';
  return normalized;
}

function sequenceKey(runtimeId: string, agentRole: string): string {
  return `${runtimePrefix(runtimeId)}::${sanitizeAgentSegment(agentRole, 'default')}`;
}

export function formatAgentId(runtimeId: string, agentRole: string, seq: number): string {
  return `${runtimePrefix(runtimeId)}-${sanitizeAgentSegment(agentRole, 'default')}-${String(seq).padStart(4, '0')}`;
}

function normalizeAgentRecord(raw: Partial<AgentLaneRecord> & { agentId: string }): AgentLaneRecord {
  return {
    agentId: String(raw.agentId || '').trim(),
    agentRole: sanitizeAgentSegment(raw.agentRole || 'default', 'default'),
    runtime: String(raw.runtime || 'unknown').trim() || 'unknown',
    runtimeSessionId: raw.runtimeSessionId ? String(raw.runtimeSessionId) : null,
    parentAgentId: raw.parentAgentId ? String(raw.parentAgentId) : null,
    rootAgentId: raw.rootAgentId ? String(raw.rootAgentId) : (raw.agentId ? String(raw.agentId) : null),
    depth: Number(raw.depth) || 0,
    modelProfile: raw.modelProfile ? String(raw.modelProfile) : null,
    resolvedModel: raw.resolvedModel ? String(raw.resolvedModel) : null,
    humanOperator: raw.humanOperator === true || String(raw.runtime || '') === 'human',
    status: raw.status === 'released' ? 'released' : 'active',
    claimedTaskIds: Array.isArray(raw.claimedTaskIds) ? Array.from(new Set(raw.claimedTaskIds.map(String))) : [],
    claimedPhaseIds: Array.isArray(raw.claimedPhaseIds) ? Array.from(new Set(raw.claimedPhaseIds.map(String))) : [],
    createdAt: raw.createdAt ? String(raw.createdAt) : nowIso(),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : nowIso(),
    lastSeenAt: raw.lastSeenAt ? String(raw.lastSeenAt) : nowIso(),
    leaseExpiresAt: raw.leaseExpiresAt ? String(raw.leaseExpiresAt) : null,
  };
}

function normalizeState(raw: Partial<AgentLaneState> | null | undefined): AgentLaneState {
  const agents = Array.isArray(raw?.agents) ? raw.agents.map((agent) => normalizeAgentRecord(agent as AgentLaneRecord)) : [];
  const sequenceByKey = raw && typeof raw.sequenceByKey === 'object' && raw.sequenceByKey
    ? Object.fromEntries(Object.entries(raw.sequenceByKey).map(([key, value]) => [key, Number(value) || 0]))
    : {};
  return { version: 1, agents, sequenceByKey };
}

export async function readAgentLanes(projectDir: string): Promise<AgentLaneState> {
  const file = planningFile(projectDir);
  if (!existsSync(file)) return normalizeState(DEFAULT_LANE_STATE);
  try {
    return normalizeState(JSON.parse(await readFile(file, 'utf8')) as AgentLaneState);
  } catch {
    return normalizeState(DEFAULT_LANE_STATE);
  }
}

export async function writeAgentLanes(projectDir: string, state: AgentLaneState): Promise<AgentLaneState> {
  await mkdir(join(projectDir, '.planning'), { recursive: true });
  const normalized = normalizeState(state);
  await writeFile(planningFile(projectDir), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export function findAgent(state: AgentLaneState, agentId: string): AgentLaneRecord | null {
  return state.agents.find((agent) => agent.agentId === agentId) || null;
}

function findReusableAgent(state: AgentLaneState, runtimeId: string, agentRole: string, runtimeSessionId: string | null | undefined): AgentLaneRecord | null {
  if (!runtimeSessionId) return null;
  return state.agents.find((agent) =>
    agent.runtime === runtimeId &&
    agent.agentRole === sanitizeAgentSegment(agentRole, 'default') &&
    agent.runtimeSessionId === runtimeSessionId &&
    agent.status !== 'released'
  ) || null;
}

function upsertAgent(state: AgentLaneState, agent: AgentLaneRecord): AgentLaneRecord {
  const normalized = normalizeAgentRecord(agent);
  const idx = state.agents.findIndex((row) => row.agentId === normalized.agentId);
  if (idx === -1) state.agents.push(normalized);
  else state.agents[idx] = normalized;
  return normalized;
}

export async function ensureAgentLane(projectDir: string, options: AgentBootstrapOptions = {}): Promise<AgentBootstrapResult> {
  const state = await readAgentLanes(projectDir);
  const runtimeId = String(options.runtime || 'unknown').trim() || 'unknown';
  const agentRole = sanitizeAgentSegment(options.role || 'default', 'default');
  const runtimeSessionId = options.runtimeSessionId ? String(options.runtimeSessionId) : null;
  const requestedAgentId = options.requestedAgentId ? String(options.requestedAgentId).trim() : '';
  const parentAgentId = options.parentAgentId ? String(options.parentAgentId).trim() : null;
  const timestamp = nowIso();

  let parent: AgentLaneRecord | null = null;
  let depth = 0;
  let rootAgentId: string | null = null;
  if (parentAgentId) {
    parent = findAgent(state, parentAgentId);
    if (!parent) {
      const error = new Error(`Parent agent not found: ${parentAgentId}`) as Error & { code?: string };
      error.code = 'PARENT_AGENT_NOT_FOUND';
      throw error;
    }
    depth = (Number(parent.depth) || 0) + 1;
    if (depth > 1) {
      const error = new Error('Subagents cannot spawn subagents. Maximum depth is 1.') as Error & { code?: string };
      error.code = 'MAX_AGENT_DEPTH';
      throw error;
    }
    rootAgentId = parent.rootAgentId || parent.agentId;
  }

  let agent = requestedAgentId ? findAgent(state, requestedAgentId) : null;
  if (!agent) {
    agent = findReusableAgent(state, runtimeId, agentRole, runtimeSessionId);
  }

  let autoRegistered = false;
  if (agent) {
    agent = normalizeAgentRecord({
      ...agent,
      agentRole,
      runtime: runtimeId,
      runtimeSessionId: runtimeSessionId || agent.runtimeSessionId,
      parentAgentId,
      rootAgentId: rootAgentId || agent.rootAgentId || agent.agentId,
      depth,
      modelProfile: options.modelProfile ?? agent.modelProfile ?? null,
      resolvedModel: options.resolvedModel ?? agent.resolvedModel ?? null,
      humanOperator: runtimeId === 'human' || agent.humanOperator === true,
      status: 'active',
      updatedAt: timestamp,
      lastSeenAt: timestamp,
      leaseExpiresAt: options.leaseExpiresAt ?? agent.leaseExpiresAt ?? null,
    });
  } else {
    let agentId = requestedAgentId;
    if (!agentId) {
      const key = sequenceKey(runtimeId, agentRole);
      const nextSeq = (state.sequenceByKey[key] || 0) + 1;
      state.sequenceByKey[key] = nextSeq;
      agentId = formatAgentId(runtimeId, agentRole, nextSeq);
    }
    agent = normalizeAgentRecord({
      agentId,
      agentRole,
      runtime: runtimeId,
      runtimeSessionId,
      parentAgentId,
      rootAgentId: rootAgentId || agentId,
      depth,
      modelProfile: options.modelProfile ?? null,
      resolvedModel: options.resolvedModel ?? null,
      humanOperator: runtimeId === 'human',
      status: 'active',
      claimedTaskIds: [],
      claimedPhaseIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSeenAt: timestamp,
      leaseExpiresAt: options.leaseExpiresAt ?? null,
    });
    autoRegistered = true;
  }

  upsertAgent(state, agent);
  const persisted = await writeAgentLanes(projectDir, state);
  return {
    agent,
    autoRegistered,
    state: persisted,
    lanesPath: planningFile(projectDir),
  };
}

export async function touchAgentLane(projectDir: string, agentId: string, patch: Partial<AgentLaneRecord> = {}): Promise<AgentLaneRecord | null> {
  const state = await readAgentLanes(projectDir);
  const current = findAgent(state, agentId);
  if (!current) return null;
  const updated = normalizeAgentRecord({
    ...current,
    ...patch,
    updatedAt: nowIso(),
    lastSeenAt: nowIso(),
  });
  upsertAgent(state, updated);
  await writeAgentLanes(projectDir, state);
  return updated;
}

async function updateAgentClaims(projectDir: string, agentId: string, mutator: (agent: AgentLaneRecord) => AgentLaneRecord): Promise<AgentLaneRecord | null> {
  const state = await readAgentLanes(projectDir);
  const current = findAgent(state, agentId);
  if (!current) return null;
  const next = normalizeAgentRecord(mutator({ ...current }));
  next.updatedAt = nowIso();
  next.lastSeenAt = nowIso();
  upsertAgent(state, next);
  await writeAgentLanes(projectDir, state);
  return next;
}

export async function addTaskClaim(projectDir: string, agentId: string, taskId: string, phaseId: string | null): Promise<AgentLaneRecord | null> {
  return updateAgentClaims(projectDir, agentId, (agent) => ({
    ...agent,
    status: 'active',
    claimedTaskIds: Array.from(new Set([...(agent.claimedTaskIds || []), String(taskId)])),
    claimedPhaseIds: phaseId ? Array.from(new Set([...(agent.claimedPhaseIds || []), String(phaseId)])) : agent.claimedPhaseIds,
  }));
}

export async function removeTaskClaim(projectDir: string, agentId: string, taskId: string, phaseId: string | null, releaseAgent = false): Promise<AgentLaneRecord | null> {
  return updateAgentClaims(projectDir, agentId, (agent) => {
    const claimedTaskIds = (agent.claimedTaskIds || []).filter((value) => value !== String(taskId));
    const claimedPhaseIds = phaseId
      ? (agent.claimedPhaseIds || []).filter((value) => value !== String(phaseId))
      : agent.claimedPhaseIds;
    return {
      ...agent,
      claimedTaskIds,
      claimedPhaseIds,
      status: releaseAgent && claimedTaskIds.length === 0 ? 'released' : agent.status,
    };
  });
}

export async function listAgentLanes(projectDir: string, options: { staleAfterMs?: number } = {}): Promise<{ state: AgentLaneState; activeAgents: AgentLaneRecord[]; staleAgents: AgentLaneRecord[]; lanesPath: string; }> {
  const staleAfterMs = Number(options.staleAfterMs) || DEFAULT_STALE_AFTER_MS;
  const state = await readAgentLanes(projectDir);
  const now = Date.now();
  const activeAgents: AgentLaneRecord[] = [];
  const staleAgents: AgentLaneRecord[] = [];
  let mutated = false;
  for (const agent of state.agents) {
    if (agent.status === 'released') continue;
    const leaseExpiry = agent.leaseExpiresAt ? Date.parse(agent.leaseExpiresAt) : Number.NaN;
    const lastSeen = agent.lastSeenAt ? Date.parse(agent.lastSeenAt) : Number.NaN;
    const stale = Number.isFinite(leaseExpiry)
      ? leaseExpiry <= now
      : Number.isFinite(lastSeen) && lastSeen > 0 && (now - lastSeen) > staleAfterMs;
    const hasClaims = (agent.claimedTaskIds || []).length > 0 || (agent.claimedPhaseIds || []).length > 0;
    if (stale && !hasClaims) {
      agent.status = 'released';
      agent.updatedAt = nowIso();
      mutated = true;
      continue;
    }
    if (stale) staleAgents.push(agent);
    activeAgents.push(agent);
  }
  if (mutated) {
    await writeAgentLanes(projectDir, state);
  }
  return { state, activeAgents, staleAgents, lanesPath: planningFile(projectDir) };
}

export function simplifyAgentLane(agent: AgentLaneRecord, allTasks: QueryTask[]): SimplifiedAgentLane {
  const tasks = Array.from(new Set([
    ...(Array.isArray(agent.claimedTaskIds) ? agent.claimedTaskIds : []),
    ...allTasks.filter((task) => task.agentId === agent.agentId && task.status !== 'done').map((task) => task.id),
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
    status: agent.status,
  };
}

export function buildAssignmentsView(allTasks: QueryTask[], activeAgents: AgentLaneRecord[], staleAgents: AgentLaneRecord[], currentAgent: AgentLaneRecord | null, scopedTaskId: string | null): AssignmentView {
  const taskMap = new Map(allTasks.map((task) => [task.id, task]));
  const activeRows = activeAgents.map((agent) => simplifyAgentLane(agent, allTasks));
  const staleRows = staleAgents.map((agent) => simplifyAgentLane(agent, allTasks));
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
  return {
    self: selfTaskIds,
    activeAgents: activeRows,
    collisions,
    staleAgents: staleRows,
  };
}
