'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { summarizeAgentLineage } = require('../lib/eval-agent-lineage.cjs');

test('summarizeAgentLineage derives root/subagent lineage from trace events', () => {
  const summary = summarizeAgentLineage({
    runtimeIdentity: { id: 'claude-code' },
    traceEvents: [
      {
        type: 'tool_use',
        runtime: { id: 'claude-code' },
        agent: {
          agent_id: 'claude-default-0001',
          agent_role: 'default',
          root_agent_id: 'claude-default-0001',
          parent_agent_id: null,
          depth: 0,
          model_profile: 'off',
          resolved_model: null,
        },
      },
      {
        type: 'subagent_spawn',
        runtime: { id: 'claude-code' },
        agent: {
          agent_id: 'claude-default-0001',
          agent_role: 'default',
          root_agent_id: 'claude-default-0001',
          parent_agent_id: null,
          depth: 0,
          model_profile: 'off',
          resolved_model: null,
        },
      },
      {
        type: 'tool_use',
        runtime: { id: 'claude-code' },
        agent: {
          agent_id: 'claude-gad-planner-0001',
          agent_role: 'gad-planner',
          root_agent_id: 'claude-default-0001',
          parent_agent_id: 'claude-default-0001',
          depth: 1,
          model_profile: 'balanced',
          resolved_model: 'claude-sonnet-4-6',
        },
      },
      {
        type: 'file_mutation',
        runtime: { id: 'claude-code' },
        agent: {
          agent_id: 'claude-gad-planner-0001',
          agent_role: 'gad-planner',
          root_agent_id: 'claude-default-0001',
          parent_agent_id: 'claude-default-0001',
          depth: 1,
          model_profile: 'balanced',
          resolved_model: 'claude-sonnet-4-6',
        },
      },
    ],
  });

  assert.equal(summary.source, 'trace-events');
  assert.equal(summary.has_lineage, true);
  assert.equal(summary.total_agents, 2);
  assert.equal(summary.root_agent_count, 1);
  assert.equal(summary.subagent_count, 1);
  assert.equal(summary.max_depth_observed, 1);
  assert.equal(summary.events_with_agent, 4);
  assert.equal(summary.runtimes[0].id, 'claude-code');
  assert.equal(summary.agents[0].agent_id, 'claude-default-0001');
  assert.equal(summary.agents[1].agent_id, 'claude-gad-planner-0001');
  assert.equal(summary.agents[1].file_mutation_count, 1);
});

test('summarizeAgentLineage preserves runtime-only attribution when no trace events are available', () => {
  const summary = summarizeAgentLineage({
    runtimeIdentity: { id: 'codex' },
    runtimesInvolved: [{ id: 'codex', count: 7 }],
    traceEvents: null,
  });

  assert.equal(summary.source, 'runtime-only');
  assert.equal(summary.has_lineage, false);
  assert.equal(summary.total_agents, 0);
  assert.equal(summary.max_depth_observed, null);
  assert.deepEqual(summary.runtimes, [{ id: 'codex', count: 7 }]);
});
