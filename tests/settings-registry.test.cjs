'use strict';
/**
 * Tests for lib/settings-registry.cjs
 * Run with: node --test tests/settings-registry.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  REGISTRY,
  getSetting,
  resolveSettingSource,
  validateSetting,
  writeTomlKey,
  readTomlKey,
  UNSET_SENTINEL,
  coerce,
  findEntry,
} = require('../lib/settings-registry.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gad-settings-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Test 1: getSetting precedence — env > project > user > default
// ---------------------------------------------------------------------------
test('getSetting: env > project > user > default precedence', (t) => {
  const tmp = makeTmpDir();
  try {
    const projToml = path.join(tmp, 'gad-config.toml');
    const userToml = path.join(tmp, 'settings.toml');

    // Default only
    const defVal = getSetting('team.worker.max_inner_rotations', undefined, {
      projectTomlPath: projToml, userTomlPath: userToml,
    });
    assert.equal(defVal, 3, 'should return registry default when nothing else set');

    // User layer
    writeTomlKey(userToml, 'settings', 'team.worker.max_inner_rotations', 7);
    const userVal = getSetting('team.worker.max_inner_rotations', undefined, {
      projectTomlPath: projToml, userTomlPath: userToml,
    });
    assert.equal(userVal, 7, 'user settings.toml should override default');

    // Project layer (should beat user)
    writeTomlKey(projToml, 'settings', 'team.worker.max_inner_rotations', 11);
    const projVal = getSetting('team.worker.max_inner_rotations', undefined, {
      projectTomlPath: projToml, userTomlPath: userToml,
    });
    assert.equal(projVal, 11, 'project config should override user settings');

    // Env layer (should beat project)
    const origEnv = process.env['VITE_KAEL_DUAL_GENERATE'];
    try {
      process.env['VITE_KAEL_DUAL_GENERATE'] = 'false';
      const envVal = getSetting('kael.dual_generate.enabled', undefined, {
        projectTomlPath: projToml, userTomlPath: userToml,
      });
      assert.equal(envVal, false, 'env var should override project config');
    } finally {
      if (origEnv === undefined) delete process.env['VITE_KAEL_DUAL_GENERATE'];
      else process.env['VITE_KAEL_DUAL_GENERATE'] = origEnv;
    }
  } finally {
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// Test 2: validateSetting rejects wrong type
// ---------------------------------------------------------------------------
test('validateSetting: rejects wrong type', () => {
  const r1 = validateSetting('kael.dual_generate.enabled', 'not-a-bool');
  assert.equal(r1.valid, false, 'string should fail boolean validation');
  assert.ok(r1.reason.includes('kael.dual_generate.enabled'));

  const r2 = validateSetting('team.worker.max_inner_rotations', 1.5);
  assert.equal(r2.valid, false, 'float should fail integer validation');

  const r3 = validateSetting('team.worker.max_inner_rotations', 5);
  assert.equal(r3.valid, true, 'valid integer passes');

  const r4 = validateSetting('kael.dual_generate.enabled', true);
  assert.equal(r4.valid, true, 'valid boolean passes');

  const r5 = validateSetting('nonexistent.key', 'value');
  assert.equal(r5.valid, false, 'unknown key fails');
  assert.ok(r5.reason.includes('Unknown setting key'));
});

// ---------------------------------------------------------------------------
// Test 3: getSetting coerces env var strings to declared types
// ---------------------------------------------------------------------------
test('getSetting: coerces env var strings to typed values', () => {
  // Boolean coercion
  const origDG = process.env['VITE_KAEL_DUAL_GENERATE'];
  const origSLM = process.env['VITE_KAEL_USE_SLM'];
  try {
    process.env['VITE_KAEL_DUAL_GENERATE'] = 'false';
    const boolVal = getSetting('kael.dual_generate.enabled');
    assert.strictEqual(boolVal, false, 'string "false" should coerce to boolean false');
    assert.strictEqual(typeof boolVal, 'boolean', 'coerced value should be boolean type');

    process.env['VITE_KAEL_USE_SLM'] = '1';
    const boolTrue = getSetting('kael.slm.enabled');
    assert.strictEqual(boolTrue, true, 'string "1" should coerce to boolean true');
  } finally {
    if (origDG === undefined) delete process.env['VITE_KAEL_DUAL_GENERATE'];
    else process.env['VITE_KAEL_DUAL_GENERATE'] = origDG;
    if (origSLM === undefined) delete process.env['VITE_KAEL_USE_SLM'];
    else process.env['VITE_KAEL_USE_SLM'] = origSLM;
  }
});

// ---------------------------------------------------------------------------
// Test 4: set --scope project writes correct TOML and reads back
// ---------------------------------------------------------------------------
test('set --scope project: writes correct TOML to [settings] section', () => {
  const tmp = makeTmpDir();
  try {
    const projToml = path.join(tmp, 'gad-config.toml');
    // Pre-seed with another section to verify it is preserved
    fs.writeFileSync(projToml, '# comment\nmode = "interactive"\n\n[features]\ngemini_trial = true\n', 'utf8');

    writeTomlKey(projToml, 'settings', 'team.rate_limit.max_retries', 9);

    const readback = readTomlKey(projToml, 'settings', 'team.rate_limit.max_retries');
    assert.equal(readback, 9, 'written value should read back correctly');

    // Verify other sections preserved
    const text = fs.readFileSync(projToml, 'utf8');
    assert.ok(text.includes('[features]'), 'other sections should be preserved');
    assert.ok(text.includes('gemini_trial = true'), 'other section keys should be preserved');
    assert.ok(text.includes('# comment'), 'comments should be preserved');
    assert.ok(text.includes('[settings]'), '[settings] section should be added');
    assert.ok(text.includes('team.rate_limit.max_retries = 9'), 'key=value should be present');
  } finally {
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// Test 5: set rejects unknown key
// ---------------------------------------------------------------------------
test('set: rejects unknown key via validateSetting', () => {
  const r = validateSetting('totally.unknown.key', 'somevalue');
  assert.equal(r.valid, false, 'unknown key should fail validation');
  assert.ok(r.reason.includes('Unknown setting key'));

  // Also verify findEntry returns null for unknown keys
  const e = findEntry('totally.unknown.key');
  assert.equal(e, undefined, 'findEntry returns undefined for unknown key');
});

// ---------------------------------------------------------------------------
// Test 6: phase 252 risk-mode workflow settings registered with correct shape
// ---------------------------------------------------------------------------
test('phase 252: new risk-mode workflow keys are present in REGISTRY', () => {
  const expected = [
    { key: 'workflow.subagent_parallelism_max', type: 'integer', default: 5 },
    { key: 'workflow.subagent_typecheck_trust', type: 'boolean', default: false },
    { key: 'workflow.task_stamp_batch', type: 'boolean', default: false },
    { key: 'workflow.cheap_model_for_mechanical', type: 'boolean', default: false },
    { key: 'workflow.risk_tolerance', type: 'string', default: 'low' },
  ];
  for (const spec of expected) {
    const entry = findEntry(spec.key);
    assert.ok(entry, `${spec.key} should be registered`);
    assert.equal(entry.type, spec.type, `${spec.key} type mismatch`);
    assert.equal(entry.default, spec.default, `${spec.key} default mismatch`);
    assert.equal(typeof entry.validate, 'function', `${spec.key} should have validate fn`);
    assert.ok(typeof entry.description === 'string' && entry.description.length > 0,
      `${spec.key} should have non-empty description`);
  }
});

// ---------------------------------------------------------------------------
// Test 7: phase 252 settings — validators enforce range/enum constraints
// ---------------------------------------------------------------------------
test('phase 252: subagent_parallelism_max enforces 1..15 range', () => {
  // Valid
  assert.equal(validateSetting('workflow.subagent_parallelism_max', 1).valid, true);
  assert.equal(validateSetting('workflow.subagent_parallelism_max', 5).valid, true);
  assert.equal(validateSetting('workflow.subagent_parallelism_max', 15).valid, true);

  // Invalid
  assert.equal(validateSetting('workflow.subagent_parallelism_max', 0).valid, false,
    'parallelism_max=0 must fail');
  assert.equal(validateSetting('workflow.subagent_parallelism_max', 16).valid, false,
    'parallelism_max=16 must fail');
  assert.equal(validateSetting('workflow.subagent_parallelism_max', 3.5).valid, false,
    'non-integer must fail');
  assert.equal(validateSetting('workflow.subagent_parallelism_max', 'three').valid, false,
    'string must fail');
});

test('phase 252: risk_tolerance enforces low|medium|high enum', () => {
  assert.equal(validateSetting('workflow.risk_tolerance', 'low').valid, true);
  assert.equal(validateSetting('workflow.risk_tolerance', 'medium').valid, true);
  assert.equal(validateSetting('workflow.risk_tolerance', 'high').valid, true);

  assert.equal(validateSetting('workflow.risk_tolerance', 'extreme').valid, false,
    'unknown level must fail');
  assert.equal(validateSetting('workflow.risk_tolerance', 'LOW').valid, false,
    'case-sensitive: LOW must fail');
  assert.equal(validateSetting('workflow.risk_tolerance', '').valid, false,
    'empty string must fail');
  assert.equal(validateSetting('workflow.risk_tolerance', 1).valid, false,
    'integer must fail');
});

test('phase 252: boolean risk settings reject non-boolean', () => {
  for (const key of [
    'workflow.subagent_typecheck_trust',
    'workflow.task_stamp_batch',
    'workflow.cheap_model_for_mechanical',
  ]) {
    assert.equal(validateSetting(key, true).valid, true, `${key} accepts true`);
    assert.equal(validateSetting(key, false).valid, true, `${key} accepts false`);
    assert.equal(validateSetting(key, 'true').valid, false,
      `${key} rejects string "true"`);
    assert.equal(validateSetting(key, 1).valid, false, `${key} rejects integer`);
    assert.equal(validateSetting(key, null).valid, false, `${key} rejects null`);
  }
});

// ---------------------------------------------------------------------------
// Test 8: phase 252 settings — defaults resolve from REGISTRY when no overrides
// ---------------------------------------------------------------------------
test('phase 252: defaults resolve correctly with no overrides', () => {
  const tmp = makeTmpDir();
  try {
    const projToml = path.join(tmp, 'gad-config.toml');
    const userToml = path.join(tmp, 'settings.toml');
    const opts = { projectTomlPath: projToml, userTomlPath: userToml };

    assert.equal(getSetting('workflow.subagent_parallelism_max', undefined, opts), 5);
    assert.equal(getSetting('workflow.subagent_typecheck_trust', undefined, opts), false);
    assert.equal(getSetting('workflow.task_stamp_batch', undefined, opts), false);
    assert.equal(getSetting('workflow.cheap_model_for_mechanical', undefined, opts), false);
    assert.equal(getSetting('workflow.risk_tolerance', undefined, opts), 'low');
  } finally {
    cleanup(tmp);
  }
});

test('phase 252: user TOML overrides default for risk settings', () => {
  const tmp = makeTmpDir();
  try {
    const projToml = path.join(tmp, 'gad-config.toml');
    const userToml = path.join(tmp, 'settings.toml');
    const opts = { projectTomlPath: projToml, userTomlPath: userToml };

    writeTomlKey(userToml, 'settings', 'workflow.subagent_parallelism_max', 10);
    writeTomlKey(userToml, 'settings', 'workflow.risk_tolerance', 'high');
    writeTomlKey(userToml, 'settings', 'workflow.cheap_model_for_mechanical', true);

    assert.equal(getSetting('workflow.subagent_parallelism_max', undefined, opts), 10);
    assert.equal(getSetting('workflow.risk_tolerance', undefined, opts), 'high');
    assert.equal(getSetting('workflow.cheap_model_for_mechanical', undefined, opts), true);

    const src = resolveSettingSource('workflow.risk_tolerance', opts);
    assert.equal(src.source, 'user');
    assert.equal(src.value, 'high');
  } finally {
    cleanup(tmp);
  }
});
