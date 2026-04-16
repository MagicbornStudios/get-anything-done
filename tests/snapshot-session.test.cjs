const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const GAD = path.resolve(__dirname, '..', 'bin', 'gad.cjs');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function gad(args, opts = {}) {
  return execSync(`node "${GAD}" ${args}`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  });
}

describe('snapshot session-aware mode', () => {
  let sessionId;

  test('session new creates a session with no staticLoadedAt', () => {
    const out = gad('session new --project get-anything-done --json');
    const session = JSON.parse(out);
    sessionId = session.id;
    assert.ok(sessionId, 'session id returned');
    assert.ok(!session.staticLoadedAt, 'no staticLoadedAt on fresh session');
  });

  test('first snapshot with --session emits full mode and stamps staticLoadedAt', () => {
    const out = gad(`snapshot --projectid get-anything-done --session ${sessionId}`);
    // Section headers are "-- DECISIONS ..." — match that pattern to avoid false positives from STATE.xml refs
    assert.ok(out.includes('-- DECISIONS'), 'full mode includes DECISIONS section');
    assert.ok(out.includes('-- EQUIPPED SKILLS') || out.includes('-- CONVENTIONS'), 'full mode includes static sections');
    assert.ok(out.includes(`session=${sessionId}`), 'session id in header');
    assert.ok(out.includes('Reuse:'), 'footer includes reuse hint');

    // Verify session file now has staticLoadedAt
    // get-anything-done root is at vendor/get-anything-done/.planning/sessions/
    const sessionsDir = path.join(REPO_ROOT, 'vendor', 'get-anything-done', '.planning', 'sessions');
    const sessFile = path.join(sessionsDir, `${sessionId}.json`);
    const sess = JSON.parse(fs.readFileSync(sessFile, 'utf8'));
    assert.ok(sess.staticLoadedAt, 'staticLoadedAt stamped after full snapshot');
  });

  test('second snapshot with same --session auto-downgrades to active', () => {
    const out = gad(`snapshot --projectid get-anything-done --session ${sessionId}`);
    assert.ok(out.includes('active'), 'header indicates active mode');
    assert.ok(out.includes('static elided'), 'header mentions static elided');
    assert.ok(!out.includes('-- DECISIONS'), 'active mode omits DECISIONS section');
    assert.ok(!out.includes('-- EQUIPPED SKILLS'), 'active mode omits EQUIPPED SKILLS section');
    assert.ok(out.includes('STATE.xml'), 'active mode includes STATE');
    assert.ok(out.includes('TASKS'), 'active mode includes TASKS');
  });

  test('explicit --mode=full overrides session downgrade', () => {
    const out = gad(`snapshot --projectid get-anything-done --session ${sessionId} --mode=full`);
    assert.ok(out.includes('-- DECISIONS'), 'explicit full includes DECISIONS section');
    assert.ok(out.includes('-- EQUIPPED SKILLS') || out.includes('-- CONVENTIONS'), 'explicit full includes static sections');
  });

  test('explicit --mode=active without session works', () => {
    const out = gad('snapshot --projectid get-anything-done --mode=active');
    assert.ok(!out.includes('-- DECISIONS'), 'active mode without session omits DECISIONS section');
    assert.ok(out.includes('STATE.xml'), 'active mode without session includes STATE');
  });

  test('GAD_SESSION_ID env var works as fallback', () => {
    const out = gad('snapshot --projectid get-anything-done', {
      env: { ...process.env, GAD_SESSION_ID: sessionId },
    });
    assert.ok(out.includes('active'), 'env var triggers session-aware downgrade');
    assert.ok(out.includes('static elided'), 'env var path notes static elided');
  });

  test('cleanup: close session', () => {
    gad(`session close --id ${sessionId}`);
    const out = gad('session list --project get-anything-done --all --json');
    let found = null;
    try {
      const sessions = JSON.parse(out);
      found = sessions.find(s => s.id === sessionId);
    } catch {
      // Empty list — session dir cleaned or no sessions
    }
    assert.ok(!found || found.status === 'closed', 'session closed');
  });
});
