'use strict';
/**
 * Tests for gad bridge discord + bridge status.
 *
 * All tests use --dry-run; no real Discord/Twilio messages are sent.
 * No network calls should occur.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the gad.cjs entry point from this test file's location. */
const gadCjs = path.resolve(__dirname, '..', 'bin', 'gad.cjs');

/** Run gad.cjs in a child process, return { stdout, stderr, exitCode }. */
async function runGad(args, opts = {}) {
  const { execFileSync } = require('child_process');
  const env = { ...process.env, ...(opts.env || {}) };
  try {
    const stdout = execFileSync(process.execPath, [gadCjs, ...args], {
      env,
      cwd: opts.cwd || process.cwd(),
      timeout: 10000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.status || 1,
    };
  }
}

/** Create a temp directory with a minimal .planning/gad-config.toml. */
function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-bridge-test-'));
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(
    path.join(planningDir, 'gad-config.toml'),
    '# test config\n[bridge.discord]\ndefault_webhook_url = ""\n'
  );
  return dir;
}

// ---------------------------------------------------------------------------
// Test 1 — discord send --dry-run returns expected payload, no fetch fired
// ---------------------------------------------------------------------------

test('discord send --dry-run: returns expected payload shape, no network call', async () => {
  const result = await runGad([
    'bridge', 'discord', 'send', '#kael-inbox', 'test message',
    '--webhook-url', 'https://discord.com/api/webhooks/000/test',
    '--dry-run', '--json',
  ]);

  assert.equal(result.exitCode, 0, `exit code should be 0, got ${result.exitCode}. stderr: ${result.stderr}`);

  let parsed;
  try {
    // Output may have leading text; find first '{' line
    const jsonLine = result.stdout.split('\n').find((l) => l.trim().startsWith('{'));
    assert.ok(jsonLine, `no JSON found in stdout: ${result.stdout}`);
    parsed = JSON.parse(jsonLine);
  } catch (e) {
    // Try parsing the whole stdout as JSON (may be pretty-printed)
    parsed = JSON.parse(result.stdout.trim());
  }

  assert.equal(parsed.dry_run, true, 'dry_run should be true');
  assert.ok(parsed.webhook_url, 'webhook_url should be present');
  assert.ok(parsed.payload, 'payload should be present');
  assert.equal(parsed.payload.content, 'test message', 'payload.content should match message');
});

// ---------------------------------------------------------------------------
// Test 2 — channels add writes to gad-config.toml correctly
// ---------------------------------------------------------------------------

test('discord channels add: writes webhook mapping to gad-config.toml', async () => {
  const tmpDir = makeTempProject();
  const tomlPath = path.join(tmpDir, '.planning', 'gad-config.toml');

  const result = await runGad([
    'bridge', 'discord', 'channels', 'add', 'kael-inbox',
    '--webhook-url', 'https://discord.com/api/webhooks/123/abc',
  ], { cwd: tmpDir });

  assert.equal(result.exitCode, 0, `exit code should be 0. stderr: ${result.stderr}\nstdout: ${result.stdout}`);

  const toml = fs.readFileSync(tomlPath, 'utf8');
  assert.ok(toml.includes('[bridge.discord.channels]'), 'TOML should contain [bridge.discord.channels] section');
  assert.ok(toml.includes('kael-inbox'), 'TOML should contain channel name');
  assert.ok(toml.includes('https://discord.com/api/webhooks/123/abc'), 'TOML should contain webhook URL');
});

// ---------------------------------------------------------------------------
// Test 3 — discord receive --dry-run does not start a server
// ---------------------------------------------------------------------------

test('discord receive --dry-run: prints config without starting a server', async () => {
  const result = await runGad([
    'bridge', 'discord', 'receive', '--port', '13131', '--dry-run',
  ]);

  assert.equal(result.exitCode, 0, `exit code should be 0. stderr: ${result.stderr}`);
  assert.ok(result.stdout.includes('dry-run'), 'stdout should mention dry-run');
  assert.ok(result.stdout.includes('13131'), 'stdout should mention the port');

  // Verify no server is actually running on that port
  const net = require('net');
  await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(200);
    socket.on('connect', () => {
      socket.destroy();
      assert.fail('Server should not be listening on port 13131 after --dry-run');
    });
    socket.on('error', () => { socket.destroy(); resolve(); });
    socket.on('timeout', () => { socket.destroy(); resolve(); });
    socket.connect(13131, '127.0.0.1');
  });
});

// ---------------------------------------------------------------------------
// Test 4 — bridge status returns expected schema with no env vars set
// ---------------------------------------------------------------------------

test('bridge status --json: returns expected schema with no env vars configured', async () => {
  // Strip all bridge-related env vars to simulate unconfigured state
  const env = { ...process.env };
  delete env.DISCORD_WEBHOOK_URL;
  delete env.TWILIO_ACCOUNT_SID;
  delete env.TWILIO_AUTH_TOKEN;
  delete env.TWILIO_WHATSAPP_FROM;
  delete env.TWILIO_SMS_FROM;

  const result = await runGad(['bridge', 'status', '--json'], { env });

  assert.equal(result.exitCode, 0, `exit code should be 0. stderr: ${result.stderr}`);

  let status;
  try {
    status = JSON.parse(result.stdout.trim());
  } catch (e) {
    assert.fail(`stdout is not valid JSON: ${result.stdout}`);
  }

  // Shape assertions
  assert.ok('discord' in status, 'status should have discord key');
  assert.ok('whatsapp' in status, 'status should have whatsapp key');
  assert.ok('sms' in status, 'status should have sms key');
  assert.ok('phone' in status, 'status should have phone key');

  // With no env vars, configured should be false for twilio-dependent bridges
  assert.equal(status.whatsapp.configured, false, 'whatsapp.configured should be false with no creds');
  assert.equal(status.sms.configured, false, 'sms.configured should be false with no creds');
  assert.equal(status.whatsapp.account_sid_set, false, 'whatsapp.account_sid_set should be false');
  assert.equal(status.sms.auth_token_set, false, 'sms.auth_token_set should be false');
  assert.equal(status.phone.configured, false, 'phone.configured should always be false (future)');

  // last_success keys should be present
  assert.ok('last_success' in status.discord, 'discord should have last_success key');
  assert.ok('last_success' in status.whatsapp, 'whatsapp should have last_success key');
  assert.ok('last_success' in status.sms, 'sms should have last_success key');
});
