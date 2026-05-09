'use strict';
/**
 * ecosystem-state.test.cjs — unit tests for gad ecosystem subcommands.
 *
 * Tests:
 *   1. `gad ecosystem status` returns expected schema with 0-process state
 *      when nothing is running.
 *   2. `gad ecosystem doctor` reports missing IONOS_API_KEY when env unset.
 *   3. `gad ecosystem up --json --no-kael --no-team --no-daemons` returns
 *      expected no-op JSON (all entries skipped).
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('child_process');

const GAD_CLI = path.resolve(__dirname, '..', 'bin', 'gad.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeGadConfig(dir, id = 'test') {
  fs.writeFileSync(path.join(dir, 'gad-config.toml'), [
    '[[planning.roots]]',
    `id = "${id}"`,
    'path = "."',
    'planningDir = ".planning"',
    '',
  ].join('\n'));
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
}

function runGad(args, cwd, env = {}) {
  const result = execFileSync(process.execPath, [GAD_CLI, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  return result;
}

function runGadJson(args, cwd, env = {}) {
  const raw = runGad(args, cwd, env);
  // Find JSON block in output (may have preamble lines)
  const start = raw.indexOf('{');
  if (start === -1) throw new Error(`No JSON in output: ${raw}`);
  return JSON.parse(raw.slice(start));
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('gad ecosystem status — zero-process schema', () => {
  let dir;

  beforeEach(() => {
    dir = tmpDir('eco-status-');
    writeGadConfig(dir);
  });

  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  test('returns ok:true with processes shape when nothing running', async () => {
    const result = runGadJson(
      ['ecosystem', 'status', '--projectid', 'test', '--json'],
      dir,
    );

    assert.ok(typeof result === 'object', 'result is object');
    assert.ok('processes' in result, 'has processes key');
    assert.ok('env' in result, 'has env key');

    const procs = result.processes;
    assert.ok('kael'         in procs, 'has kael');
    assert.ok('curator'      in procs, 'has curator');
    assert.ok('delta-train'  in procs, 'has delta-train');
    assert.ok('dispatcher'   in procs, 'has dispatcher');

    for (const [key, p] of Object.entries(procs)) {
      assert.ok('state' in p,   `${key} has state`);
      assert.ok('pid'   in p,   `${key} has pid`);
      assert.ok('info'  in p,   `${key} has info`);
      assert.strictEqual(p.state, 'stopped', `${key} should be stopped`);
    }

    // env shape
    assert.ok('IONOS_API_KEY'     in result.env, 'env has IONOS_API_KEY');
    assert.ok('ANTHROPIC_API_KEY' in result.env, 'env has ANTHROPIC_API_KEY');
    assert.ok('MODAL_VLLM_URL'    in result.env, 'env has MODAL_VLLM_URL');
  });
});

describe('gad ecosystem doctor — missing IONOS_API_KEY', () => {
  let dir;

  beforeEach(() => {
    dir = tmpDir('eco-doctor-');
    writeGadConfig(dir);
  });

  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  test('reports missing IONOS_API_KEY when env unset', async () => {
    // Scrub env vars so they are definitely absent
    const env = {
      IONOS_API_KEY:     '',
      ANTHROPIC_API_KEY: '',
      MODAL_VLLM_URL:    '',
    };
    const result = runGadJson(
      ['ecosystem', 'doctor', '--projectid', 'test', '--json'],
      dir,
      env,
    );

    assert.ok(typeof result === 'object', 'result is object');
    assert.ok('todos' in result, 'has todos');
    assert.ok(Array.isArray(result.todos), 'todos is array');

    const ionosTodo = result.todos.find(
      (t) => t.type === 'env' && t.item === 'IONOS_API_KEY',
    );
    assert.ok(ionosTodo, 'IONOS_API_KEY should appear in todos');
    assert.ok(ionosTodo.message.includes('IONOS_API_KEY'), 'message mentions key');
    assert.strictEqual(result.ok, false, 'ok=false when todos exist');
  });
});

describe('gad ecosystem up --no-kael --no-team --no-daemons — no-op', () => {
  let dir;

  beforeEach(() => {
    dir = tmpDir('eco-up-noop-');
    writeGadConfig(dir);
  });

  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  });

  test('returns ok:true with all results skipped', async () => {
    const result = runGadJson(
      ['ecosystem', 'up',
        '--projectid', 'test',
        '--no-kael',
        '--no-team',
        '--no-daemons',
        '--json',
      ],
      dir,
    );

    assert.ok(typeof result === 'object', 'result is object');
    assert.strictEqual(result.ok, true, 'ok is true');
    assert.ok('results' in result, 'has results');

    const r = result.results;
    assert.ok('kael'         in r, 'has kael');
    assert.ok('curator'      in r, 'has curator');
    assert.ok('delta-train'  in r, 'has delta-train');
    assert.ok('dispatcher'   in r, 'has dispatcher');

    for (const [key, v] of Object.entries(r)) {
      assert.strictEqual(v.skipped, true, `${key} should be skipped`);
      assert.ok(typeof v.reason === 'string' && v.reason.length > 0, `${key} has reason`);
    }
  });
});
