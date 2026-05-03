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
