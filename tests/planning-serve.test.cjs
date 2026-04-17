'use strict';
/**
 * planning-serve.test.cjs — phase 59 task 59-05.
 *
 * Unit tests for the pure reuse-detection function in lib/planning-serve.cjs.
 * The spawn path itself is NOT tested here (integration concern); this is
 * the decision table: given a probe result, do we attach / conflict / spawn?
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  decideReuseAction,
  PLANNING_APP_MARKER,
  DEFAULT_PORT,
} = require('../lib/planning-serve.cjs');

describe('decideReuseAction', () => {
  test('connection-refused error → spawn', () => {
    const d = decideReuseAction({ port: 3002, error: 'ECONNREFUSED' });
    assert.strictEqual(d.action, 'spawn');
    assert.match(d.reason, /ECONNREFUSED/);
  });

  test('timeout error → spawn', () => {
    const d = decideReuseAction({ port: 3002, error: 'health probe timeout' });
    assert.strictEqual(d.action, 'spawn');
  });

  test('HTTP 200 with planning-app marker → attach', () => {
    const body = JSON.stringify({
      app: PLANNING_APP_MARKER,
      version: '0.0.0',
      port: '3002',
      uptimeSeconds: 42,
    });
    const d = decideReuseAction({ port: 3002, status: 200, body });
    assert.strictEqual(d.action, 'attach');
    assert.match(d.reason, /port 3002/);
  });

  test('HTTP 200 with object body containing marker → attach', () => {
    // decideReuseAction must accept pre-parsed JSON too (e.g. when a future
    // caller wires it up after JSON.parse).
    const d = decideReuseAction({
      port: 3002,
      status: 200,
      body: { app: PLANNING_APP_MARKER, version: '0.0.0' },
    });
    assert.strictEqual(d.action, 'attach');
  });

  test('HTTP 200 without marker → conflict', () => {
    const body = JSON.stringify({ ok: true, service: 'some-other-dev-server' });
    const d = decideReuseAction({ port: 3002, status: 200, body });
    assert.strictEqual(d.action, 'conflict');
    assert.match(d.reason, /non-planning-app/);
  });

  test('HTTP 500 → conflict (something is bound but broken)', () => {
    const d = decideReuseAction({ port: 3002, status: 500, body: 'oops' });
    assert.strictEqual(d.action, 'conflict');
    assert.match(d.reason, /HTTP 500/);
  });

  test('HTTP 404 → conflict', () => {
    const d = decideReuseAction({ port: 3002, status: 404, body: 'not found' });
    assert.strictEqual(d.action, 'conflict');
  });

  test('missing probe → spawn (defensive)', () => {
    const d = decideReuseAction(null);
    assert.strictEqual(d.action, 'spawn');
  });

  test('default port echoed when probe.port omitted', () => {
    const d = decideReuseAction({ error: 'ECONNREFUSED' });
    assert.strictEqual(d.action, 'spawn');
    assert.match(d.reason, new RegExp(String(DEFAULT_PORT)));
  });

  test('custom port shown in reason', () => {
    const d = decideReuseAction({ port: 3102, error: 'ECONNREFUSED' });
    assert.match(d.reason, /3102/);
  });

  test('marker substring match is strict — partial match in non-app key still attaches by design', () => {
    // Contract: the marker string appearing anywhere in the response body
    // counts. Health route owns correctness; detection is loose on purpose
    // so old-binary / new-app mismatches still attach instead of failing.
    const body = 'random text containing gad-planning-app somewhere';
    const d = decideReuseAction({ port: 3002, status: 200, body });
    assert.strictEqual(d.action, 'attach');
  });

  test('malformed body (non-string, non-object) → conflict on HTTP 200', () => {
    const d = decideReuseAction({ port: 3002, status: 200, body: 42 });
    assert.strictEqual(d.action, 'conflict');
  });
});
