'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeToolUseEvent,
  makeSkillInvocationEvent,
  makeSubagentSpawnEvent,
  makeFileMutationEvent,
} = require('../lib/trace-schema.cjs');

const runtime = {
  id: 'claude-code',
  source: 'env',
  model: 'claude-sonnet-4-6',
  session_id: 'sess-123',
};

const agent = {
  agent_id: 'claude-gad-planner-0001',
  agent_role: 'gad-planner',
  parent_agent_id: 'claude-default-0001',
  root_agent_id: 'claude-default-0001',
  depth: 1,
  model_profile: 'balanced',
  resolved_model: 'claude-sonnet-4-6',
};

test('trace schema emits agent lineage on every event type', () => {
  const toolUse = makeToolUseEvent({
    seq: 1,
    runtime,
    agent,
    tool: 'Read',
    inputs: { file_path: 'foo.ts' },
    outputs: 'ok',
    outputsTruncated: false,
    durationMs: 12,
    success: true,
    triggerSkill: 'gad-plan-phase',
  });
  const skill = makeSkillInvocationEvent({
    seq: 2,
    runtime,
    agent,
    skillId: 'gad-plan-phase',
    parent: null,
    triggerContext: 'marker_file',
    triggerSnippet: null,
  });
  const spawn = makeSubagentSpawnEvent({
    seq: 3,
    runtime,
    agent,
    agentId: 'gad-executor',
    inputs: { prompt: 'execute task' },
    outputs: 'done',
    durationMs: 100,
    success: true,
  });
  const mutation = makeFileMutationEvent({
    seq: 4,
    runtime,
    agent,
    filePath: 'sdk/src/query/index.ts',
    op: 'edit',
    sizeDelta: 42,
  });

  for (const event of [toolUse, skill, spawn, mutation]) {
    assert.equal(event.agent.agent_id, agent.agent_id);
    assert.equal(event.agent.agent_role, agent.agent_role);
    assert.equal(event.agent.parent_agent_id, agent.parent_agent_id);
    assert.equal(event.agent.root_agent_id, agent.root_agent_id);
    assert.equal(event.agent.depth, agent.depth);
    assert.equal(event.agent.model_profile, agent.model_profile);
    assert.equal(event.agent.resolved_model, agent.resolved_model);
  }
});
