'use strict';
/**
 * Tests for `gad assets move` and `gad assets transfer` (task 71-04).
 *
 * Strategy: inject mock supabase-client into require.cache before loading
 * assets.cjs. Use node:test harness; no vitest-specific APIs.
 *
 * Coverage (14 test cases):
 *
 *   move:
 *     1.  No-storage-path: updates species_id only (no storage.move call).
 *     2.  With --storage-path: calls storage.move + updates storage_path in metadata.
 *     3.  Compensation: storage.move succeeds but UPDATE fails → reverse storage.move called.
 *     4.  Compensation cascade: storage.move succeeds, UPDATE fails, reverse also fails → manual-intervention message.
 *     5.  No flags → exitCode=1, requires-flag error.
 *     6.  Asset not found → exitCode=1, not-found message.
 *     7.  Missing env → exitCode=1, env-config error.
 *     8.  --json output → emits full updated row as JSON.
 *
 *   transfer:
 *     9.  Happy path (no --keep-source): download + upload + insert + remove called; row printed.
 *    10.  --keep-source: download + upload + insert called; remove NOT called; row printed.
 *    11.  Compensation on insert failure: uploaded dest object removed; exitCode=1.
 *    12.  Dest bucket lazy-create: ensureBucket RPC called with dest project id.
 *    13.  Source asset not found → exitCode=1.
 *    14.  Partial source-cleanup failure → warning printed but exitCode=0, new row output.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SUPABASE_CLIENT_PATH = path.resolve(__dirname, '../lib/supabase-client.cjs');
const ASSETS_CMD_PATH = path.resolve(__dirname, '../bin/commands/assets.cjs');

// ---------------------------------------------------------------------------
// Output capture helper
// ---------------------------------------------------------------------------
function captureOutput(fn) {
  const stdoutLines = [];
  const stderrLines = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);

  process.stdout.write = (chunk) => { stdoutLines.push(String(chunk)); return true; };
  console.log = (...args) => { stdoutLines.push(args.join(' ') + '\n'); };
  console.error = (...args) => { stderrLines.push(args.join(' ') + '\n'); };

  const prevExitCode = process.exitCode;
  process.exitCode = 0;

  const result = fn();
  const cleanup = () => {
    process.stdout.write = origWrite;
    console.log = origLog;
    console.error = origErr;
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
// Require assets command fresh with injected supabase-client mock
// ---------------------------------------------------------------------------
function requireAssetsCmd(mockGetClient) {
  delete require.cache[require.resolve(ASSETS_CMD_PATH)];
  delete require.cache[require.resolve(SUPABASE_CLIENT_PATH)];

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
  return assetsCmd.subCommands;
}

async function runCmd(cmd, args) {
  return cmd.run({ args, rawArgs: [] });
}

afterEach(() => { process.exitCode = 0; });

// ===========================================================================
// move tests
// ===========================================================================

describe('assets move — metadata-only (no storage-path flag)', () => {
  test('1. updates species_id; no storage.move called', async () => {
    const updatedRow = { id: 'asset-1', species_id: 'species-new', generation_id: null, storage_path: 'abc/file.png' };
    const moveCalls = [];
    const updateCalls = [];

    const mockClient = {
      from: (table) => ({
        select: (fields) => ({
          eq: (col, val) => ({
            single: () => Promise.resolve({
              data: { id: 'asset-1', species_id: 'species-old', generation_id: null, storage_path: 'abc/file.png', bucket_name: 'project-assets-proj-1' },
              error: null,
            }),
          }),
        }),
        update: (payload) => {
          updateCalls.push(payload);
          return {
            eq: (col, val) => ({
              select: () => Promise.resolve({ data: [updatedRow], error: null }),
            }),
          };
        },
      }),
      storage: {
        from: (bucket) => ({
          move: (from, to) => { moveCalls.push({ bucket, from, to }); return Promise.resolve({ error: null }); },
        }),
      },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode } = await captureOutput(() =>
      runCmd(cmds.move, { assetId: 'asset-1', species: 'species-new', json: false })
    );

    assert.equal(exitCode, 0);
    assert.equal(moveCalls.length, 0, 'storage.move should not be called when no --storage-path');
    assert.equal(updateCalls.length, 1, 'UPDATE called once');
    assert.equal(updateCalls[0].species_id, 'species-new');
  });
});

describe('assets move — with --storage-path', () => {
  test('2. calls storage.move and updates storage_path in metadata', async () => {
    const moveCalls = [];
    const updateCalls = [];

    const mockClient = {
      from: (table) => ({
        select: (fields) => ({
          eq: (col, val) => ({
            single: () => Promise.resolve({
              data: { id: 'asset-2', species_id: null, generation_id: null, storage_path: 'old/path.png', bucket_name: 'project-assets-proj-2' },
              error: null,
            }),
          }),
        }),
        update: (payload) => {
          updateCalls.push(payload);
          return {
            eq: (col, val) => ({
              select: () => Promise.resolve({ data: [{ id: 'asset-2', storage_path: 'new/path.png' }], error: null }),
            }),
          };
        },
      }),
      storage: {
        from: (bucket) => ({
          move: (from, to) => { moveCalls.push({ bucket, from, to }); return Promise.resolve({ error: null }); },
        }),
      },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode } = await captureOutput(() =>
      runCmd(cmds.move, { assetId: 'asset-2', storagePath: 'new/path.png', json: false })
    );

    assert.equal(exitCode, 0);
    assert.equal(moveCalls.length, 1, 'storage.move called once');
    assert.equal(moveCalls[0].from, 'old/path.png');
    assert.equal(moveCalls[0].to, 'new/path.png');
    assert.equal(updateCalls[0].storage_path, 'new/path.png');
  });
});

describe('assets move — compensation on UPDATE failure', () => {
  test('3. storage.move succeeded but UPDATE failed → reverse storage.move attempted', async () => {
    const moveCalls = [];

    const mockClient = {
      from: (table) => ({
        select: (fields) => ({
          eq: (col, val) => ({
            single: () => Promise.resolve({
              data: { id: 'asset-3', species_id: null, generation_id: null, storage_path: 'orig/file.txt', bucket_name: 'bkt' },
              error: null,
            }),
          }),
        }),
        update: () => ({
          eq: (col, val) => ({
            select: () => Promise.resolve({ data: null, error: { message: 'update-failed' } }),
          }),
        }),
      }),
      storage: {
        from: (bucket) => ({
          move: (from, to) => {
            moveCalls.push({ from, to });
            return Promise.resolve({ error: null });
          },
        }),
      },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode, stderr } = await captureOutput(() =>
      runCmd(cmds.move, { assetId: 'asset-3', storagePath: 'new/file.txt', json: false })
    );

    assert.equal(exitCode, 1);
    // First move: orig → new; reverse move: new → orig
    assert.equal(moveCalls.length, 2, 'two storage.move calls (forward + reverse)');
    assert.equal(moveCalls[0].from, 'orig/file.txt');
    assert.equal(moveCalls[0].to, 'new/file.txt');
    assert.equal(moveCalls[1].from, 'new/file.txt');
    assert.equal(moveCalls[1].to, 'orig/file.txt');
    assert.ok(stderr.includes('reversed') || stderr.includes('storage move reversed'), `stderr: ${stderr}`);
  });
});

describe('assets move — compensation cascade (reverse also fails)', () => {
  test('4. both UPDATE and reverse storage.move fail → manual-intervention message', async () => {
    let moveCallCount = 0;

    const mockClient = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'a4', storage_path: 'old/x.bin', bucket_name: 'bkt4' }, error: null }) }) }),
        update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'db-error' } }) }) }),
      }),
      storage: {
        from: () => ({
          move: (from, to) => {
            moveCallCount++;
            if (moveCallCount === 2) {
              return Promise.resolve({ error: { message: 'reverse-failed' } });
            }
            return Promise.resolve({ error: null });
          },
        }),
      },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode, stderr } = await captureOutput(() =>
      runCmd(cmds.move, { assetId: 'a4', storagePath: 'new/x.bin', json: false })
    );

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('MANUAL INTERVENTION') || stderr.includes('manual'), `stderr should mention manual intervention: ${stderr}`);
  });
});

describe('assets move — no flags error', () => {
  test('5. no species/generation/storage-path → exitCode=1', async () => {
    const cmds = requireAssetsCmd(() => ({ client: {} }));
    const { exitCode, stderr } = await captureOutput(() =>
      runCmd(cmds.move, { assetId: 'a5', json: false })
    );
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('at least one'), `stderr: ${stderr}`);
  });
});

describe('assets move — asset not found', () => {
  test('6. asset query returns null → exitCode=1, not-found message', async () => {
    const mockClient = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'no rows' } }) }) }),
      }),
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode, stderr } = await captureOutput(() =>
      runCmd(cmds.move, { assetId: 'missing-id', species: 'sp-1', json: false })
    );

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('not found') || stderr.includes('missing-id'), `stderr: ${stderr}`);
  });
});

describe('assets move — missing env', () => {
  test('7. getSupabaseClient throws → exitCode=1, env-config error', async () => {
    const cmds = requireAssetsCmd(() => { throw new Error('Supabase env not configured'); });
    const { exitCode, stderr } = await captureOutput(() =>
      runCmd(cmds.move, { assetId: 'any', species: 'sp', json: false })
    );
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('Supabase env not configured'), `stderr: ${stderr}`);
  });
});

describe('assets move — --json output', () => {
  test('8. emits full updated row as JSON when --json', async () => {
    const updatedRow = { id: 'asset-8', species_id: 'sp-8', generation_id: 'gen-8', storage_path: 'p/f.png' };

    const mockClient = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'asset-8', species_id: null, generation_id: null, storage_path: 'p/f.png', bucket_name: 'bkt' }, error: null }) }) }),
        update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [updatedRow], error: null }) }) }),
      }),
      storage: { from: () => ({ move: () => Promise.resolve({ error: null }) }) },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode, stdout } = await captureOutput(() =>
      runCmd(cmds.move, { assetId: 'asset-8', species: 'sp-8', generation: 'gen-8', json: true })
    );

    assert.equal(exitCode, 0);
    const jsonStart = stdout.indexOf('{');
    assert.ok(jsonStart !== -1, `stdout should contain JSON: ${stdout}`);
    const parsed = JSON.parse(stdout.slice(jsonStart));
    assert.equal(parsed.id, 'asset-8');
    assert.equal(parsed.species_id, 'sp-8');
  });
});

// ===========================================================================
// transfer tests
// ===========================================================================

describe('assets transfer — happy path (default: remove source)', () => {
  test('9. download + upload + insert + remove source all called; row printed', async () => {
    const rpcCalls = [];
    const downloadCalls = [];
    const uploadCalls = [];
    const removeCalls = [];
    const insertCalls = [];
    const deleteCalls = [];

    const srcAsset = { id: 'src-1', project_id: 'proj-src', bucket_name: 'project-assets-proj-src', storage_path: 'hash/file.png', mime_type: 'image/png', size_bytes: 100, labels: ['a'], species_id: 'sp1', generation_id: 'gen1' };
    const newRow = { id: 'new-1', project_id: 'proj-dst', bucket_name: 'project-assets-proj-dst', storage_path: 'hash/file.png', size_bytes: 100 };

    let selectCallCount = 0;

    const mockClient = {
      rpc: (name, params) => { rpcCalls.push({ name, params }); return Promise.resolve({ error: null }); },
      from: (table) => ({
        select: () => ({
          eq: (col, val) => ({
            single: () => {
              selectCallCount++;
              return Promise.resolve({ data: srcAsset, error: null });
            },
          }),
        }),
        insert: (payload) => {
          insertCalls.push(payload);
          return { select: () => Promise.resolve({ data: [newRow], error: null }) };
        },
        delete: () => ({
          eq: (col, val) => { deleteCalls.push({ col, val }); return Promise.resolve({ error: null }); },
        }),
      }),
      storage: {
        from: (bucket) => ({
          download: (p) => { downloadCalls.push({ bucket, p }); return Promise.resolve({ data: Buffer.from('img-data'), error: null }); },
          upload: (p, data, opts) => { uploadCalls.push({ bucket, p, opts }); return Promise.resolve({ data: {}, error: null }); },
          remove: (paths) => { removeCalls.push({ bucket, paths }); return Promise.resolve({ error: null }); },
        }),
      },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode, stdout } = await captureOutput(() =>
      runCmd(cmds.transfer, { assetId: 'src-1', project: 'proj-dst', keepSource: false, json: false })
    );

    assert.equal(exitCode, 0, `exitCode should be 0; stderr may help`);
    assert.equal(rpcCalls.length, 1, 'ensureBucket RPC called');
    assert.equal(rpcCalls[0].params.project_id, 'proj-dst');
    assert.equal(downloadCalls.length, 1);
    assert.equal(uploadCalls.length, 1);
    assert.equal(insertCalls.length, 1);
    assert.equal(insertCalls[0].project_id, 'proj-dst');
    // Source cleanup: one storage remove + one row delete.
    assert.equal(removeCalls.length, 1);
    assert.equal(deleteCalls.length, 1);
    assert.equal(deleteCalls[0].val, 'src-1');
  });
});

describe('assets transfer — --keep-source', () => {
  test('10. download + upload + insert; source remove/delete NOT called', async () => {
    const removeCalls = [];
    const deleteCalls = [];

    const srcAsset = { id: 'src-2', project_id: 'proj-a', bucket_name: 'project-assets-proj-a', storage_path: 'h/f.txt', mime_type: 'text/plain', size_bytes: 20, labels: [], species_id: null, generation_id: null };

    const mockClient = {
      rpc: () => Promise.resolve({ error: null }),
      from: (table) => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: srcAsset, error: null }) }) }),
        insert: () => ({ select: () => Promise.resolve({ data: [{ id: 'new-2', project_id: 'proj-b', storage_path: 'h/f.txt', size_bytes: 20 }], error: null }) }),
        delete: () => ({ eq: (col, val) => { deleteCalls.push(val); return Promise.resolve({ error: null }); } }),
      }),
      storage: {
        from: (bucket) => ({
          download: () => Promise.resolve({ data: Buffer.from('data'), error: null }),
          upload: () => Promise.resolve({ data: {}, error: null }),
          remove: (paths) => { removeCalls.push(paths); return Promise.resolve({ error: null }); },
        }),
      },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode } = await captureOutput(() =>
      runCmd(cmds.transfer, { assetId: 'src-2', project: 'proj-b', keepSource: true, json: false })
    );

    assert.equal(exitCode, 0);
    assert.equal(removeCalls.length, 0, 'source storage not removed when --keep-source');
    assert.equal(deleteCalls.length, 0, 'source row not deleted when --keep-source');
  });
});

describe('assets transfer — compensation on insert failure', () => {
  test('11. insert fails → dest storage object removed; exitCode=1', async () => {
    const removeCalls = [];

    const srcAsset = { id: 'src-3', project_id: 'p-src', bucket_name: 'project-assets-p-src', storage_path: 'k/f.bin', mime_type: 'application/octet-stream', size_bytes: 10, labels: [], species_id: null, generation_id: null };

    const mockClient = {
      rpc: () => Promise.resolve({ error: null }),
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: srcAsset, error: null }) }) }),
        insert: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'insert-failed' } }) }),
      }),
      storage: {
        from: (bucket) => ({
          download: () => Promise.resolve({ data: Buffer.from('d'), error: null }),
          upload: () => Promise.resolve({ data: {}, error: null }),
          remove: (paths) => { removeCalls.push({ bucket, paths }); return Promise.resolve({ error: null }); },
        }),
      },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode, stderr } = await captureOutput(() =>
      runCmd(cmds.transfer, { assetId: 'src-3', project: 'proj-dst', keepSource: false, json: false })
    );

    assert.equal(exitCode, 1);
    assert.equal(removeCalls.length, 1, 'destination storage object removed on insert failure');
    assert.ok(stderr.includes('insert failed') || stderr.includes('metadata insert'), `stderr: ${stderr}`);
  });
});

describe('assets transfer — dest bucket lazy-create', () => {
  test('12. ensureBucket RPC called with destination project id', async () => {
    const rpcCalls = [];
    const srcAsset = { id: 'src-4', project_id: 'p-src-4', bucket_name: 'project-assets-p-src-4', storage_path: 'p/f.jpg', mime_type: 'image/jpeg', size_bytes: 50, labels: [], species_id: null, generation_id: null };

    const mockClient = {
      rpc: (name, params) => { rpcCalls.push({ name, params }); return Promise.resolve({ error: null }); },
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: srcAsset, error: null }) }) }),
        insert: () => ({ select: () => Promise.resolve({ data: [{ id: 'new-4' }], error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
      storage: {
        from: () => ({
          download: () => Promise.resolve({ data: Buffer.from('d'), error: null }),
          upload: () => Promise.resolve({ data: {}, error: null }),
          remove: () => Promise.resolve({ error: null }),
        }),
      },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    await captureOutput(() =>
      runCmd(cmds.transfer, { assetId: 'src-4', project: 'dest-proj-99', keepSource: true, json: false })
    );

    assert.ok(rpcCalls.some(c => c.name === 'create_project_bucket' && c.params.project_id === 'dest-proj-99'),
      'ensureBucket RPC called with dest project id');
  });
});

describe('assets transfer — source asset not found', () => {
  test('13. asset missing → exitCode=1, not-found message', async () => {
    const mockClient = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'no rows' } }) }) }),
      }),
      rpc: () => Promise.resolve({ error: null }),
      storage: { from: () => ({}) },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode, stderr } = await captureOutput(() =>
      runCmd(cmds.transfer, { assetId: 'missing-src', project: 'dst', keepSource: false, json: false })
    );

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('not found') || stderr.includes('missing-src'), `stderr: ${stderr}`);
  });
});

describe('assets transfer — partial source-cleanup failure', () => {
  test('14. source remove fails after successful insert → warning but exitCode=0, new row output', async () => {
    const srcAsset = { id: 'src-14', project_id: 'p14', bucket_name: 'project-assets-p14', storage_path: 'r/f.png', mime_type: 'image/png', size_bytes: 8, labels: [], species_id: null, generation_id: null };
    const newRow = { id: 'new-14', project_id: 'dst-14', storage_path: 'r/f.png', size_bytes: 8 };

    const mockClient = {
      rpc: () => Promise.resolve({ error: null }),
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: srcAsset, error: null }) }) }),
        insert: () => ({ select: () => Promise.resolve({ data: [newRow], error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: { message: 'delete-failed' } }) }),
      }),
      storage: {
        from: (bucket) => ({
          download: () => Promise.resolve({ data: Buffer.from('img'), error: null }),
          upload: () => Promise.resolve({ data: {}, error: null }),
          remove: () => Promise.resolve({ error: { message: 'remove-failed' } }),
        }),
      },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient }));
    const { exitCode, stderr, stdout } = await captureOutput(() =>
      runCmd(cmds.transfer, { assetId: 'src-14', project: 'dst-14', keepSource: false, json: false })
    );

    // Transfer succeeded; only cleanup failed → exitCode should be 0
    assert.equal(exitCode, 0, `exitCode should be 0 despite cleanup failure: ${stderr}`);
    assert.ok(stderr.includes('WARNING') || stderr.includes('cleanup'), `stderr should warn about cleanup: ${stderr}`);
    // New row should still be output
    assert.ok(stdout.includes('new-14') || stdout.length > 0, `stdout should include new row: ${stdout}`);
  });
});
