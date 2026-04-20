'use strict';
/**
 * Tests for `gad assets list` (task 71-02).
 *
 * Strategy: mock the @supabase/supabase-js module and lib/supabase-client.cjs
 * via Module._resolveFilename override before requiring the command under test.
 * node:test harness; no vitest-specific APIs.
 *
 * Coverage:
 *   1. Query shape — correct select/order/range applied.
 *   2. Filter composition — project / species / generation eq() calls.
 *   3. Empty result path — prints "No assets found.".
 *   4. --json output — JSON.stringify of data array written to stdout.
 *   5. Error path — Supabase error prints one-liner and sets exitCode=1.
 *   6. Env not configured — getSupabaseClient throws, prints the error, exitCode=1.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Paths
const SUPABASE_CLIENT_PATH = path.resolve(__dirname, '../lib/supabase-client.cjs');
const ASSETS_CMD_PATH = path.resolve(__dirname, '../bin/commands/assets.cjs');

// ---------------------------------------------------------------------------
// Helpers to capture stdout/stderr output during a run
// ---------------------------------------------------------------------------
function captureOutput(fn) {
  const stdoutLines = [];
  const stderrLines = [];
  const origStdout = process.stdout.write.bind(process.stdout);
  const origConsoleLog = console.log.bind(console);
  const origConsoleError = console.error.bind(console);

  process.stdout.write = (chunk) => { stdoutLines.push(String(chunk)); return true; };
  console.log = (...args) => { stdoutLines.push(args.join(' ') + '\n'); };
  console.error = (...args) => { stderrLines.push(args.join(' ') + '\n'); };

  const prevExitCode = process.exitCode;
  process.exitCode = 0;

  const result = fn();
  const cleanup = () => {
    process.stdout.write = origStdout;
    console.log = origConsoleLog;
    console.error = origConsoleError;
  };

  if (result && typeof result.then === 'function') {
    return result.then((v) => {
      cleanup();
      return { stdout: stdoutLines.join(''), stderr: stderrLines.join(''), exitCode: process.exitCode, value: v };
    }).catch((err) => {
      cleanup();
      process.exitCode = prevExitCode;
      throw err;
    });
  }

  cleanup();
  return { stdout: stdoutLines.join(''), stderr: stderrLines.join(''), exitCode: process.exitCode };
}

// ---------------------------------------------------------------------------
// Build a fake Supabase query chain that resolves to { data, error }.
// Tracks which filter methods were called with what args.
// ---------------------------------------------------------------------------
function buildFakeQuery(resolveWith) {
  const calls = { eq: [], range: null, order: null };
  const chain = {
    select: () => chain,
    order: (col, opts) => { calls.order = { col, opts }; return chain; },
    range: (from, to) => { calls.range = { from, to }; return chain; },
    eq: (col, val) => { calls.eq.push({ col, val }); return chain; },
    then: (resolve) => Promise.resolve(resolveWith).then(resolve),
  };
  return { chain, calls };
}

// ---------------------------------------------------------------------------
// Require the listCmd fresh for each test (clear require cache).
// Injects a mock getSupabaseClient via module cache replacement.
// ---------------------------------------------------------------------------
function requireListCmd(mockGetClient) {
  // Clear the command cache so it picks up the fresh supabase-client mock.
  delete require.cache[require.resolve(ASSETS_CMD_PATH)];
  delete require.cache[require.resolve(SUPABASE_CLIENT_PATH)];

  // Inject mock supabase-client into require cache before loading assets.cjs.
  require.cache[require.resolve(SUPABASE_CLIENT_PATH)] = {
    id: require.resolve(SUPABASE_CLIENT_PATH),
    filename: require.resolve(SUPABASE_CLIENT_PATH),
    loaded: true,
    exports: {
      getSupabaseClient: mockGetClient,
      clearSupabaseClient: () => {},
    },
  };

  const { createAssetsCommand } = require(ASSETS_CMD_PATH);
  const assetsCmd = createAssetsCommand();
  // The list subcommand is keyed under 'list' in subCommands.
  return assetsCmd.subCommands.list;
}

// ---------------------------------------------------------------------------
// Run a citty command definition with given args object.
// Returns a Promise.
// ---------------------------------------------------------------------------
async function runCmd(cmd, args) {
  return cmd.run({ args, rawArgs: [] });
}

// ===========================================================================
// Tests
// ===========================================================================

describe('assets list — query shape', () => {
  let fakeQuery;
  let fakeQueryCalls;

  beforeEach(() => {
    const { chain, calls } = buildFakeQuery({ data: [], error: null });
    fakeQuery = chain;
    fakeQueryCalls = calls;
  });

  afterEach(() => {
    // Restore exitCode to 0 between tests.
    process.exitCode = 0;
  });

  test('calls select with all asset columns and orders newest-first', async () => {
    let selectArgs;
    const mockFrom = (table) => {
      assert.equal(table, 'assets');
      return {
        select: (cols) => { selectArgs = cols; return fakeQuery; },
      };
    };
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    await captureOutput(() => runCmd(listCmd, { limit: '50', offset: '0', json: false }));

    assert.ok(selectArgs.includes('id'), 'select includes id');
    assert.ok(selectArgs.includes('project_id'), 'select includes project_id');
    assert.ok(selectArgs.includes('storage_path'), 'select includes storage_path');
    assert.ok(selectArgs.includes('mime_type'), 'select includes mime_type');
    assert.ok(selectArgs.includes('size_bytes'), 'select includes size_bytes');
    assert.ok(selectArgs.includes('labels'), 'select includes labels');
    assert.ok(selectArgs.includes('created_at'), 'select includes created_at');

    assert.deepEqual(fakeQueryCalls.order, { col: 'created_at', opts: { ascending: false } });
  });

  test('range uses limit+offset correctly', async () => {
    const mockFrom = () => ({ select: () => fakeQuery });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    await captureOutput(() => runCmd(listCmd, { limit: '10', offset: '20', json: false }));

    assert.deepEqual(fakeQueryCalls.range, { from: 20, to: 29 });
  });
});

describe('assets list — filter composition', () => {
  afterEach(() => { process.exitCode = 0; });

  test('project filter adds eq(project_id)', async () => {
    const { chain, calls } = buildFakeQuery({ data: [], error: null });
    const mockFrom = () => ({ select: () => chain });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    await captureOutput(() => runCmd(listCmd, {
      project: 'proj-uuid-123',
      limit: '50', offset: '0', json: false,
    }));

    assert.ok(calls.eq.some((c) => c.col === 'project_id' && c.val === 'proj-uuid-123'));
  });

  test('species filter adds eq(species_id)', async () => {
    const { chain, calls } = buildFakeQuery({ data: [], error: null });
    const mockFrom = () => ({ select: () => chain });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    await captureOutput(() => runCmd(listCmd, {
      species: 'sp-uuid-456',
      limit: '50', offset: '0', json: false,
    }));

    assert.ok(calls.eq.some((c) => c.col === 'species_id' && c.val === 'sp-uuid-456'));
  });

  test('generation filter adds eq(generation_id)', async () => {
    const { chain, calls } = buildFakeQuery({ data: [], error: null });
    const mockFrom = () => ({ select: () => chain });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    await captureOutput(() => runCmd(listCmd, {
      generation: 'gen-uuid-789',
      limit: '50', offset: '0', json: false,
    }));

    assert.ok(calls.eq.some((c) => c.col === 'generation_id' && c.val === 'gen-uuid-789'));
  });

  test('no filters — no eq() calls', async () => {
    const { chain, calls } = buildFakeQuery({ data: [], error: null });
    const mockFrom = () => ({ select: () => chain });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    await captureOutput(() => runCmd(listCmd, { limit: '50', offset: '0', json: false }));

    assert.equal(calls.eq.length, 0, 'no eq filters applied');
  });

  test('all three filters combined', async () => {
    const { chain, calls } = buildFakeQuery({ data: [], error: null });
    const mockFrom = () => ({ select: () => chain });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    await captureOutput(() => runCmd(listCmd, {
      project: 'p1', species: 's1', generation: 'g1',
      limit: '50', offset: '0', json: false,
    }));

    assert.equal(calls.eq.length, 3, 'three eq filters applied');
  });
});

describe('assets list — empty result', () => {
  afterEach(() => { process.exitCode = 0; });

  test('prints "No assets found." when data is empty array', async () => {
    const { chain } = buildFakeQuery({ data: [], error: null });
    const mockFrom = () => ({ select: () => chain });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    const { stdout } = await captureOutput(() => runCmd(listCmd, { limit: '50', offset: '0', json: false }));

    assert.ok(stdout.includes('No assets found.'), `expected "No assets found." in: ${stdout}`);
  });

  test('null data treated as empty', async () => {
    const { chain } = buildFakeQuery({ data: null, error: null });
    const mockFrom = () => ({ select: () => chain });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    const { stdout } = await captureOutput(() => runCmd(listCmd, { limit: '50', offset: '0', json: false }));

    assert.ok(stdout.includes('No assets found.'));
  });
});

describe('assets list — --json output', () => {
  afterEach(() => { process.exitCode = 0; });

  test('emits JSON array of data rows', async () => {
    const fakeRow = {
      id: 'asset-id-1',
      project_id: 'proj-1',
      species_id: 'sp-1',
      generation_id: 'gen-1',
      bucket_name: 'project-assets-proj-1',
      storage_path: 'species/gen/file.png',
      mime_type: 'image/png',
      size_bytes: 12345,
      labels: ['hero'],
      created_at: '2026-04-20T10:00:00Z',
    };
    const { chain } = buildFakeQuery({ data: [fakeRow], error: null });
    const mockFrom = () => ({ select: () => chain });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    const { stdout } = await captureOutput(() => runCmd(listCmd, { limit: '50', offset: '0', json: true }));

    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed), 'output is an array');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, 'asset-id-1');
    assert.equal(parsed[0].mime_type, 'image/png');
  });
});

describe('assets list — error paths', () => {
  afterEach(() => { process.exitCode = 0; });

  test('Supabase error prints message and sets exitCode=1', async () => {
    const { chain } = buildFakeQuery({ data: null, error: { message: 'relation "assets" does not exist' } });
    const mockFrom = () => ({ select: () => chain });
    const listCmd = requireListCmd(() => ({ client: { from: mockFrom }, hasServiceRole: true }));

    const { stderr, exitCode } = await captureOutput(() => runCmd(listCmd, { limit: '50', offset: '0', json: false }));

    assert.ok(stderr.includes('relation "assets" does not exist'), `stderr: ${stderr}`);
    assert.equal(exitCode, 1);
  });

  test('missing env prints config error and sets exitCode=1', async () => {
    const listCmd = requireListCmd(() => {
      throw new Error('Supabase env not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in your shell or .env.');
    });

    const { stderr, exitCode } = await captureOutput(() => runCmd(listCmd, { limit: '50', offset: '0', json: false }));

    assert.ok(stderr.includes('Supabase env not configured'), `stderr: ${stderr}`);
    assert.equal(exitCode, 1);
  });
});
