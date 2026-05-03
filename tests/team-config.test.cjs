const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const CONFIG_PATH = require.resolve('../lib/team/config.cjs');
const originalEnv = { ...process.env };

function loadConfig() {
  delete require.cache[CONFIG_PATH];
  return require(CONFIG_PATH);
}

afterEach(() => {
  process.env = { ...originalEnv };
  delete require.cache[CONFIG_PATH];
});

test('resolveRuntimeCmd keeps codex unwrapped when telemetry env is unset', () => {
  process.env = { ...originalEnv };
  delete process.env.GAD_SESSION_TELEMETRY;
  const { resolveRuntimeCmd } = loadConfig();
  const cmd = resolveRuntimeCmd({
    runtime: 'codex-cli',
    workers_spec: [{ id: 'w2', role: 'executor', runtime: 'codex-cli', runtime_cmd: null }],
  }, 'w2');
  assert.equal(cmd, 'codex exec');
});

test('resolveRuntimeCmd wraps codex runtime when telemetry env is enabled', () => {
  process.env = { ...originalEnv, GAD_SESSION_TELEMETRY: '1' };
  const { resolveRuntimeCmd } = loadConfig();
  const cmd = resolveRuntimeCmd({
    runtime: 'codex-cli',
    workers_spec: [{ id: 'w2', role: 'executor', runtime: 'codex-cli', runtime_cmd: 'codex exec -c features.codex_hooks=false -c notify=[] --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox' }],
  }, 'w2');
  assert.equal(
    cmd,
    'node scripts/codex-session-emit.cjs -- codex exec -c features.codex_hooks=false -c notify=[] --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox',
  );
});

test('resolveRuntimeCmd keeps cursor runtime unwrapped when telemetry env is unset', () => {
  process.env = { ...originalEnv };
  delete process.env.GAD_SESSION_TELEMETRY;
  const { resolveRuntimeCmd } = loadConfig();
  const cmd = resolveRuntimeCmd({
    runtime: 'cursor-cli',
    workers_spec: [{ id: 'w6', role: 'executor', runtime: 'cursor-cli', runtime_cmd: null }],
  }, 'w6');
  assert.equal(cmd, 'node scripts/gad-cursor-trial.mjs -- --print --output-format json');
});

test('resolveRuntimeCmd wraps cursor runtime when telemetry env is enabled', () => {
  process.env = { ...originalEnv, GAD_SESSION_TELEMETRY: '1' };
  const { resolveRuntimeCmd } = loadConfig();
  const cmd = resolveRuntimeCmd({
    runtime: 'cursor-cli',
    workers_spec: [{ id: 'w6', role: 'executor', runtime: 'cursor-cli', runtime_cmd: 'node scripts/gad-cursor-trial.mjs -- --print --output-format json' }],
  }, 'w6');
  assert.equal(
    cmd,
    'node scripts/cursor-session-emit.cjs -- node scripts/gad-cursor-trial.mjs -- --print --output-format json',
  );
});

test('resolveTickMs uses runtime override for gemini workers', () => {
  process.env = { ...originalEnv };
  const { resolveTickMs } = loadConfig();
  const tickMs = resolveTickMs({
    tick_ms: 2000,
    runtime_tick_overrides: { 'gemini-cli': 8000, 'codex-cli': 2000 },
    workers_spec: [{ id: 'w5', role: 'executor', runtime: 'gemini-cli', runtime_cmd: null }],
  }, 'w5');
  assert.equal(tickMs, 8000);
});

test('resolveTickMs falls back to global tick for runtimes without an override', () => {
  process.env = { ...originalEnv };
  const { resolveTickMs } = loadConfig();
  const tickMs = resolveTickMs({
    tick_ms: 3500,
    runtime_tick_overrides: { 'gemini-cli': 8000 },
    workers_spec: [{ id: 'w1', role: 'executor', runtime: 'claude-code', runtime_cmd: null }],
  }, 'w1');
  assert.equal(tickMs, 3500);
});

test('resolveTickMs prefers runtime-specific override for gemini workers', () => {
  process.env = { ...originalEnv };
  const { resolveTickMs } = loadConfig();
  const tickMs = resolveTickMs({
    tick_ms: 2000,
    runtime_tick_overrides: { 'gemini-cli': 8000, 'codex-cli': 2000 },
    workers_spec: [{ id: 'w3', role: 'executor', runtime: 'gemini-cli', runtime_cmd: null }],
  }, 'w3');
  assert.equal(tickMs, 8000);
});
