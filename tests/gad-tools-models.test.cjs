const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('gad-tools init model emission', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-models-');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="35">
    <title>Cross-runtime identity + telemetry attribution</title>
    <goal>Test phase</goal>
    <status>planned</status>
    <depends>32</depends>
  </phase>
</roadmap>
`,
      'utf8'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('defaults to off profile with no explicit models', () => {
    const result = runGsdTools(['init', 'plan-phase', '35'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.model_profile, 'off');
    assert.strictEqual(output.planner_model, undefined);
    assert.strictEqual(output.researcher_model, undefined);
    assert.strictEqual(output.checker_model, undefined);
  });

  test('emits Claude runtime aliases when profile is enabled', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        model_profile: 'balanced',
        workflow: { research: true },
      }, null, 2),
      'utf8'
    );

    const result = runGsdTools(['init', 'plan-phase', '35'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.model_profile, 'balanced');
    assert.strictEqual(output.planner_model, 'inherit');
    assert.strictEqual(output.researcher_model, 'sonnet');
    assert.strictEqual(output.checker_model, 'sonnet');
    assert.strictEqual(output.research_enabled, true);
  });

  test('honors explicit model overrides', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        model_profile: 'budget',
        model_overrides: {
          'gad-planner': 'claude-sonnet-4-6',
        },
      }, null, 2),
      'utf8'
    );

    const result = runGsdTools(['init', 'plan-phase', '35'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.planner_model, 'claude-sonnet-4-6');
    assert.strictEqual(output.researcher_model, 'haiku');
  });
});
