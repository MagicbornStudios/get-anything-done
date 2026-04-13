'use strict';

const fs = require('fs');
const path = require('path');

const AGENT_LANES_FILE = '.gad-agent-lanes.json';
const DEFAULT_LANE_STATE = {
  version: 1,
  agents: [],
  sequenceByKey: {},
};
const DEFAULT_STALE_AFTER_MS = 30 * 60 * 1000;

function getAgentLanesFile(planDir) {
  return path.join(planDir, AGENT_LANES_FILE);
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeAgentSegment(value, fallback = 'default') {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function runtimePrefix(runtimeId) {
  const normalized = sanitizeAgentSegment(runtimeId, 'agent');
  if (normalized === 'claude-code' || normalized === 'claude') return 'claude';
  if (normalized.startsWith('cursor')) return 'cursor';
  if (normalized === 'codex') return 'codex';
  if (normalized.startsWith('windsurf')) return 'windsurf';
  if (normalized.startsWith('gemini')) return 'gemini';
  if (normalized === 'human') return 'human';
  return normalized;
}

function sequenceKey(runtimeId, agentRole) {
  return `${runtimePrefix(runtimeId)}::${sanitizeAgentSegment(agentRole, 'default')}`;
}

function formatAgentId(runtimeId, agentRole, seq) {
  return `${runtimePrefix(runtimeId)}-${sanitizeAgentSegment(agentRole, 'default')}-${String(seq).padStart(4, '0')}`;
}

function normalizeLaneState(raw) {
  const agents = Array.isArray(raw?.agents) ? raw.agents.map(normalizeAgentRecord) : [];
  const sequenceByKey = raw && typeof raw.sequenceByKey === 'object' && raw.sequenceByKey
    ? Object.fromEntries(Object.entries(raw.sequenceByKey).map(([key, value]) => [key, Number(value) || 0]))
    : {};
  return {
    version: 1,
    agents,
    sequenceByKey,
  };
}

function normalizeAgentRecord(raw) {
  return {
    agentId: String(raw?.agentId || '').trim(),
    agentRole: sanitizeAgentSegment(raw?.agentRole || 'default', 'default'),
    runtime: String(raw?.runtime || 'unknown').trim() || 'unknown',
    runtimeSessionId: raw?.runtimeSessionId ? String(raw.runtimeSessionId) : null,
    parentAgentId: raw?.parentAgentId ? String(raw.parentAgentId) : null,
    rootAgentId: raw?.rootAgentId ? String(raw.rootAgentId) : (raw?.agentId ? String(raw.agentId) : null),
    depth: Number(raw?.depth) || 0,
    modelProfile: raw?.modelProfile ? String(raw.modelProfile) : null,
    resolvedModel: raw?.resolvedModel ? String(raw.resolvedModel) : null,
    humanOperator: raw?.humanOperator === true || String(raw?.runtime || '') === 'human',
    status: raw?.status === 'released' ? 'released' : 'active',
    claimedTaskIds: Array.isArray(raw?.claimedTaskIds) ? Array.from(new Set(raw.claimedTaskIds.map(String))) : [],
    claimedPhaseIds: Array.isArray(raw?.claimedPhaseIds) ? Array.from(new Set(raw.claimedPhaseIds.map(String))) : [],
    createdAt: raw?.createdAt ? String(raw.createdAt) : nowIso(),
    updatedAt: raw?.updatedAt ? String(raw.updatedAt) : nowIso(),
    lastSeenAt: raw?.lastSeenAt ? String(raw.lastSeenAt) : nowIso(),
    leaseExpiresAt: raw?.leaseExpiresAt ? String(raw.leaseExpiresAt) : null,
  };
}

function readAgentLanes(planDir) {
  const file = getAgentLanesFile(planDir);
  if (!fs.existsSync(file)) return normalizeLaneState(DEFAULT_LANE_STATE);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return normalizeLaneState(parsed);
  } catch {
    return normalizeLaneState(DEFAULT_LANE_STATE);
  }
}

function writeAgentLanes(planDir, state) {
  fs.mkdirSync(planDir, { recursive: true });
  const normalized = normalizeLaneState(state);
  fs.writeFileSync(getAgentLanesFile(planDir), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function findAgent(state, agentId) {
  return state.agents.find((agent) => agent.agentId === agentId) || null;
}

function findReusableAgent(state, runtimeId, agentRole, runtimeSessionId) {
  if (!runtimeSessionId) return null;
  return state.agents.find((agent) =>
    agent.runtime === runtimeId &&
    agent.agentRole === sanitizeAgentSegment(agentRole, 'default') &&
    agent.runtimeSessionId === runtimeSessionId &&
    agent.status !== 'released'
  ) || null;
}

function upsertAgent(state, agent) {
  const next = normalizeAgentRecord(agent);
  const idx = state.agents.findIndex((row) => row.agentId === next.agentId);
  if (idx === -1) state.agents.push(next);
  else state.agents[idx] = next;
  return next;
}

function ensureAgentLane(planDir, options = {}) {
  const state = readAgentLanes(planDir);
  const runtimeId = String(options.runtime || 'unknown').trim() || 'unknown';
  const agentRole = sanitizeAgentSegment(options.role || 'default', 'default');
  const runtimeSessionId = options.runtimeSessionId ? String(options.runtimeSessionId) : null;
  const requestedAgentId = options.requestedAgentId ? String(options.requestedAgentId).trim() : '';
  const parentAgentId = options.parentAgentId ? String(options.parentAgentId).trim() : null;
  const timestamp = nowIso();

  let parent = null;
  let depth = 0;
  let rootAgentId = null;
  if (parentAgentId) {
    parent = findAgent(state, parentAgentId);
    if (!parent) {
      const err = new Error(`Parent agent not found: ${parentAgentId}`);
      err.code = 'PARENT_AGENT_NOT_FOUND';
      throw err;
    }
    depth = (Number(parent.depth) || 0) + 1;
    if (depth > 1) {
      const err = new Error('Subagents cannot spawn subagents. Maximum depth is 1.');
      err.code = 'MAX_AGENT_DEPTH';
      throw err;
    }
    rootAgentId = parent.rootAgentId || parent.agentId;
  }

  let agent = null;
  let autoRegistered = false;

  if (requestedAgentId) {
    agent = findAgent(state, requestedAgentId);
  }
  if (!agent) {
    agent = findReusableAgent(state, runtimeId, agentRole, runtimeSessionId);
  }

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
  const persisted = writeAgentLanes(planDir, state);
  return {
    agent,
    autoRegistered,
    state: persisted,
    lanesPath: getAgentLanesFile(planDir),
  };
}

function touchAgentLane(planDir, agentId, patch = {}) {
  const state = readAgentLanes(planDir);
  const current = findAgent(state, agentId);
  if (!current) return null;
  const timestamp = nowIso();
  const updated = normalizeAgentRecord({
    ...current,
    ...patch,
    updatedAt: timestamp,
    lastSeenAt: timestamp,
  });
  upsertAgent(state, updated);
  writeAgentLanes(planDir, state);
  return updated;
}

function updateAgentClaims(planDir, agentId, mutator) {
  const state = readAgentLanes(planDir);
  const current = findAgent(state, agentId);
  if (!current) return null;
  const next = normalizeAgentRecord(mutator({ ...current }));
  next.updatedAt = nowIso();
  next.lastSeenAt = nowIso();
  upsertAgent(state, next);
  writeAgentLanes(planDir, state);
  return next;
}

function addTaskClaim(planDir, agentId, taskId, phaseId) {
  return updateAgentClaims(planDir, agentId, (agent) => {
    agent.status = 'active';
    agent.claimedTaskIds = Array.from(new Set([...(agent.claimedTaskIds || []), String(taskId)]));
    if (phaseId) {
      agent.claimedPhaseIds = Array.from(new Set([...(agent.claimedPhaseIds || []), String(phaseId)]));
    }
    return agent;
  });
}

function removeTaskClaim(planDir, agentId, taskId, phaseId, releaseAgent = false) {
  return updateAgentClaims(planDir, agentId, (agent) => {
    agent.claimedTaskIds = (agent.claimedTaskIds || []).filter((value) => value !== String(taskId));
    if (phaseId) {
      agent.claimedPhaseIds = (agent.claimedPhaseIds || []).filter((value) => value !== String(phaseId));
    }
    if (releaseAgent && agent.claimedTaskIds.length === 0) {
      agent.status = 'released';
    }
    return agent;
  });
}

function listAgentLanes(planDir, options = {}) {
  const staleAfterMs = Number(options.staleAfterMs) || DEFAULT_STALE_AFTER_MS;
  const state = readAgentLanes(planDir);
  const now = Date.now();
  const activeAgents = [];
  const staleAgents = [];

  for (const agent of state.agents) {
    if (agent.status === 'released') continue;
    const leaseExpiry = agent.leaseExpiresAt ? Date.parse(agent.leaseExpiresAt) : null;
    const lastSeen = agent.lastSeenAt ? Date.parse(agent.lastSeenAt) : 0;
    const stale = Number.isFinite(leaseExpiry)
      ? leaseExpiry <= now
      : Number.isFinite(lastSeen) && lastSeen > 0 && (now - lastSeen) > staleAfterMs;
    if (stale) staleAgents.push(agent);
    activeAgents.push(agent);
  }

  return { state, activeAgents, staleAgents, lanesPath: getAgentLanesFile(planDir) };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getAttr(attrs, name) {
  const match = attrs.match(new RegExp(`(?:^|\\s)${escapeRegex(name)}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

function setAttr(attrs, name, value) {
  const escapedValue = escapeXmlAttr(value);
  const re = new RegExp(`(^|\\s)${escapeRegex(name)}="[^"]*"`, 'i');
  if (re.test(attrs)) {
    return attrs.replace(re, `$1${name}="${escapedValue}"`);
  }
  return `${attrs.trim()} ${name}="${escapedValue}"`.trim();
}

function clearAttr(attrs, name) {
  const re = new RegExp(`\\s*${escapeRegex(name)}="[^"]*"`, 'ig');
  return attrs.replace(re, '').replace(/\s+/g, ' ').trim();
}

function updateTaskRecord(planDir, taskId, updater) {
  const xmlFile = path.join(planDir, 'TASK-REGISTRY.xml');
  if (!fs.existsSync(xmlFile)) {
    const err = new Error(`TASK-REGISTRY.xml not found at ${xmlFile}`);
    err.code = 'TASK_REGISTRY_NOT_FOUND';
    throw err;
  }

  const source = fs.readFileSync(xmlFile, 'utf8');
  let found = false;
  const taskRe = /<task\s([^>]*)>([\s\S]*?)<\/task>/g;
  const nextSource = source.replace(taskRe, (full, attrs, body) => {
    const id = getAttr(attrs, 'id');
    if (id !== taskId) return full;
    found = true;
    const nextAttrs = updater(String(attrs), String(body));
    return `<task ${nextAttrs}>${body}</task>`;
  });

  if (!found) {
    const err = new Error(`Task not found in TASK-REGISTRY.xml: ${taskId}`);
    err.code = 'TASK_NOT_FOUND';
    throw err;
  }

  fs.writeFileSync(xmlFile, nextSource, 'utf8');
  return { xmlFile };
}

function claimTask(planDir, taskId, claim = {}) {
  const claimedAt = claim.claimedAt || nowIso();
  updateTaskRecord(planDir, taskId, (attrs) => {
    const currentStatus = getAttr(attrs, 'status').toLowerCase();
    let next = attrs.trim();
    next = setAttr(next, 'status', currentStatus === 'done' ? 'done' : (claim.status || 'in-progress'));
    next = setAttr(next, 'agent-id', claim.agentId);
    if (claim.agentRole) next = setAttr(next, 'agent-role', claim.agentRole);
    if (claim.runtime) next = setAttr(next, 'runtime', claim.runtime);
    if (claim.modelProfile) next = setAttr(next, 'model-profile', claim.modelProfile);
    if (claim.resolvedModel) next = setAttr(next, 'resolved-model', claim.resolvedModel);
    next = setAttr(next, 'claimed', 'true');
    next = setAttr(next, 'claimed-at', claimedAt);
    if (claim.leaseExpiresAt) next = setAttr(next, 'lease-expires-at', claim.leaseExpiresAt);
    return next;
  });
}

function releaseTask(planDir, taskId, options = {}) {
  updateTaskRecord(planDir, taskId, (attrs) => {
    const done = options.done === true || String(options.status || '').toLowerCase() === 'done';
    let next = attrs.trim();
    next = setAttr(next, 'status', done ? 'done' : (options.status || 'planned'));
    next = clearAttr(next, 'claimed');
    next = clearAttr(next, 'claimed-at');
    next = clearAttr(next, 'lease-expires-at');
    if (!done) {
      next = clearAttr(next, 'agent-id');
      next = clearAttr(next, 'agent-role');
      next = clearAttr(next, 'runtime');
      next = clearAttr(next, 'model-profile');
      next = clearAttr(next, 'resolved-model');
    }
    return next;
  });
}

module.exports = {
  AGENT_LANES_FILE,
  DEFAULT_STALE_AFTER_MS,
  addTaskClaim,
  claimTask,
  ensureAgentLane,
  findAgent,
  formatAgentId,
  getAgentLanesFile,
  listAgentLanes,
  nowIso,
  readAgentLanes,
  releaseTask,
  removeTaskClaim,
  runtimePrefix,
  sanitizeAgentSegment,
  touchAgentLane,
  updateTaskRecord,
  writeAgentLanes,
};
