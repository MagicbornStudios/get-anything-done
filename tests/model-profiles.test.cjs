/**
 * Model Profiles Tests
 *
 * Tests the restored shared model-profile resolver used by workflow prompts and
 * SDK sessions.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  MODEL_PROFILES,
  VALID_PROFILES,
  formatAgentToModelMapAsTable,
  getAgentToModelMapForProfile,
  resolveAgentModel,
  resolveWorkflowModels,
} = require('../lib/model-profiles.cjs');

describe('MODEL_PROFILES', () => {
  test('contains expected current GAD agents', () => {
    const expectedAgents = [
      'gad-planner',
      'gad-roadmapper',
      'gad-executor',
      'gad-phase-researcher',
      'gad-project-researcher',
      'gad-research-synthesizer',
      'gad-debugger',
      'gad-codebase-mapper',
      'gad-verifier',
      'gad-plan-checker',
      'gad-integration-checker',
      'gad-nyquist-auditor',
      'gad-ui-researcher',
      'gad-ui-checker',
      'gad-ui-auditor',
      'gad-user-profiler',
    ];
    for (const agent of expectedAgents) {
      assert.ok(MODEL_PROFILES[agent], `Missing agent: ${agent}`);
    }
  });

  test('every agent exposes all supported profiles', () => {
    for (const [agent, profiles] of Object.entries(MODEL_PROFILES)) {
      assert.ok(Object.prototype.hasOwnProperty.call(profiles, 'off'), `${agent} missing off profile`);
      assert.ok(Object.prototype.hasOwnProperty.call(profiles, 'inherit'), `${agent} missing inherit profile`);
      assert.ok(Object.prototype.hasOwnProperty.call(profiles, 'quality'), `${agent} missing quality profile`);
      assert.ok(Object.prototype.hasOwnProperty.call(profiles, 'balanced'), `${agent} missing balanced profile`);
      assert.ok(Object.prototype.hasOwnProperty.call(profiles, 'budget'), `${agent} missing budget profile`);
    }
  });

  test('profile values are runtime aliases or null', () => {
    const validModels = [null, 'inherit', 'sonnet', 'haiku'];
    for (const [agent, profiles] of Object.entries(MODEL_PROFILES)) {
      for (const [profile, model] of Object.entries(profiles)) {
        assert.ok(
          validModels.includes(model),
          `${agent}.${profile} has invalid model "${model}"`
        );
      }
    }
  });
});

describe('VALID_PROFILES', () => {
  test('contains all supported profile names', () => {
    assert.deepStrictEqual(VALID_PROFILES, ['off', 'inherit', 'quality', 'balanced', 'budget']);
  });
});

describe('getAgentToModelMapForProfile', () => {
  test('returns correct values for balanced profile', () => {
    const map = getAgentToModelMapForProfile('balanced');
    assert.strictEqual(map['gad-planner'], 'inherit');
    assert.strictEqual(map['gad-codebase-mapper'], 'haiku');
    assert.strictEqual(map['gad-verifier'], 'sonnet');
  });

  test('returns correct values for budget profile', () => {
    const map = getAgentToModelMapForProfile('budget');
    assert.strictEqual(map['gad-planner'], 'sonnet');
    assert.strictEqual(map['gad-phase-researcher'], 'haiku');
  });

  test('returns null values for off profile', () => {
    const map = getAgentToModelMapForProfile('off');
    assert.strictEqual(map['gad-planner'], null);
    assert.strictEqual(map['gad-phase-researcher'], null);
  });
});

describe('formatAgentToModelMapAsTable', () => {
  test('renders a simple table', () => {
    const table = formatAgentToModelMapAsTable({
      'gad-planner': 'inherit',
      'gad-executor': 'sonnet',
    });
    assert.ok(table.includes('Agent'));
    assert.ok(table.includes('Model'));
    assert.ok(table.includes('gad-planner'));
    assert.ok(table.includes('inherit'));
    assert.ok(table.includes('|'));
  });

  test('handles empty input', () => {
    const table = formatAgentToModelMapAsTable({});
    assert.ok(table.includes('Agent'));
  });
});

describe('resolveAgentModel', () => {
  test('returns undefined when profile is off', () => {
    assert.strictEqual(
      resolveAgentModel('gad-planner', { profile: 'off', target: 'claude' }),
      undefined
    );
  });

  test('returns Claude aliases for Claude runtime', () => {
    assert.strictEqual(
      resolveAgentModel('gad-planner', { profile: 'balanced', target: 'claude' }),
      'inherit'
    );
    assert.strictEqual(
      resolveAgentModel('gad-codebase-mapper', { profile: 'balanced', target: 'claude' }),
      'haiku'
    );
  });

  test('returns concrete model IDs for SDK runtime', () => {
    assert.strictEqual(
      resolveAgentModel('gad-planner', { profile: 'balanced', target: 'sdk' }),
      undefined
    );
    assert.strictEqual(
      resolveAgentModel('gad-phase-researcher', { profile: 'balanced', target: 'sdk' }),
      'claude-sonnet-4-6'
    );
    assert.strictEqual(
      resolveAgentModel('gad-codebase-mapper', { profile: 'balanced', target: 'sdk' }),
      'claude-haiku-3-5'
    );
  });

  test('honors explicit model overrides', () => {
    assert.strictEqual(
      resolveAgentModel('gad-planner', {
        profile: 'quality',
        modelOverrides: { 'gad-planner': 'claude-sonnet-4-6' },
        target: 'sdk',
      }),
      'claude-sonnet-4-6'
    );
  });
});

describe('resolveWorkflowModels', () => {
  test('emits expected fields for Claude runtime', () => {
    const models = resolveWorkflowModels({ model_profile: 'balanced' }, 'claude');
    assert.strictEqual(models.model_profile, 'balanced');
    assert.strictEqual(models.planner_model, 'inherit');
    assert.strictEqual(models.researcher_model, 'sonnet');
    assert.strictEqual(models.checker_model, 'sonnet');
    assert.strictEqual(models.executor_model, 'sonnet');
  });

  test('emits undefined values when model profiles are off', () => {
    const models = resolveWorkflowModels({ model_profile: 'off' }, 'claude');
    assert.strictEqual(models.model_profile, 'off');
    assert.strictEqual(models.planner_model, undefined);
    assert.strictEqual(models.researcher_model, undefined);
    assert.strictEqual(models.executor_model, undefined);
  });
});
