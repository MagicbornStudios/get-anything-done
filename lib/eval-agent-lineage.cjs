'use strict';

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeNumber(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function summarizeAgentLineage({ traceEvents, runtimeIdentity, runtimesInvolved } = {}) {
  const events = Array.isArray(traceEvents) ? traceEvents : [];
  const runtimeCounts = new Map();
  const agents = new Map();
  let eventsWithAgent = 0;
  let missingAgentEvents = 0;
  let maxDepthObserved = null;

  for (const entry of Array.isArray(runtimesInvolved) ? runtimesInvolved : []) {
    const runtimeId = normalizeString(entry?.id);
    const count = normalizeNumber(entry?.count) ?? 0;
    if (!runtimeId) continue;
    runtimeCounts.set(runtimeId, (runtimeCounts.get(runtimeId) ?? 0) + Math.max(count, 0));
  }

  const primaryRuntimeId = normalizeString(runtimeIdentity?.id);
  if (primaryRuntimeId && !runtimeCounts.has(primaryRuntimeId) && events.length === 0) {
    runtimeCounts.set(primaryRuntimeId, 1);
  }

  for (const event of events) {
    const runtimeId = normalizeString(event?.runtime?.id);
    if (runtimeId) runtimeCounts.set(runtimeId, (runtimeCounts.get(runtimeId) ?? 0) + 1);

    const agent = event?.agent && typeof event.agent === 'object' ? event.agent : null;
    const agentId = normalizeString(agent?.agent_id);
    const agentRole = normalizeString(agent?.agent_role);
    const parentAgentId = normalizeString(agent?.parent_agent_id);
    const rootAgentId = normalizeString(agent?.root_agent_id);
    const depth = normalizeNumber(agent?.depth);
    const modelProfile = normalizeString(agent?.model_profile);
    const resolvedModel = normalizeString(agent?.resolved_model);
    const hasLineage = Boolean(agentId || agentRole || parentAgentId || rootAgentId || depth != null);

    if (!hasLineage) {
      missingAgentEvents += 1;
      continue;
    }

    eventsWithAgent += 1;
    if (depth != null && (maxDepthObserved == null || depth > maxDepthObserved)) {
      maxDepthObserved = depth;
    }

    const syntheticKey = [agentRole ?? 'unknown', rootAgentId ?? 'none', parentAgentId ?? 'none', String(depth ?? 'null')].join('|');
    const key = agentId ?? `anonymous:${syntheticKey}`;
    const current = agents.get(key) ?? {
      agent_id: agentId,
      agent_role: agentRole,
      runtime: runtimeId,
      parent_agent_id: parentAgentId,
      root_agent_id: rootAgentId ?? agentId,
      depth,
      model_profile: modelProfile,
      resolved_model: resolvedModel,
      event_count: 0,
      tool_use_count: 0,
      skill_invocation_count: 0,
      subagent_spawn_count: 0,
      file_mutation_count: 0,
    };

    if (!current.runtime && runtimeId) current.runtime = runtimeId;
    if (!current.agent_id && agentId) current.agent_id = agentId;
    if (!current.agent_role && agentRole) current.agent_role = agentRole;
    if (!current.parent_agent_id && parentAgentId) current.parent_agent_id = parentAgentId;
    if (!current.root_agent_id && (rootAgentId || agentId)) current.root_agent_id = rootAgentId ?? agentId;
    if (current.depth == null && depth != null) current.depth = depth;
    if (!current.model_profile && modelProfile) current.model_profile = modelProfile;
    if (!current.resolved_model && resolvedModel) current.resolved_model = resolvedModel;

    current.event_count += 1;
    switch (event?.type) {
      case 'tool_use':
        current.tool_use_count += 1;
        break;
      case 'skill_invocation':
        current.skill_invocation_count += 1;
        break;
      case 'subagent_spawn':
        current.subagent_spawn_count += 1;
        break;
      case 'file_mutation':
        current.file_mutation_count += 1;
        break;
      default:
        break;
    }

    agents.set(key, current);
  }

  const agentList = [...agents.values()].sort((a, b) => {
    if (b.event_count !== a.event_count) return b.event_count - a.event_count;
    return String(a.agent_id ?? a.agent_role ?? '').localeCompare(String(b.agent_id ?? b.agent_role ?? ''));
  });

  const rootIds = new Set();
  for (const agent of agentList) {
    if (agent.root_agent_id) rootIds.add(agent.root_agent_id);
    else if ((agent.depth ?? 0) === 0 && agent.agent_id) rootIds.add(agent.agent_id);
  }

  const runtimes = [...runtimeCounts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

  const hasLineage = eventsWithAgent > 0;
  const source = hasLineage ? 'trace-events' : (runtimes.length > 0 ? 'runtime-only' : 'missing');
  const subagentCount = agentList.filter((agent) => (agent.depth ?? 0) > 0 || agent.parent_agent_id).length;

  return {
    source,
    has_lineage: hasLineage,
    trace_event_count: events.length,
    events_with_agent: eventsWithAgent,
    missing_agent_events: missingAgentEvents,
    total_agents: agentList.length,
    root_agent_count: rootIds.size,
    subagent_count: subagentCount,
    max_depth_observed: hasLineage ? (maxDepthObserved ?? 0) : null,
    runtimes,
    agents: agentList,
  };
}

module.exports = {
  summarizeAgentLineage,
};
