'use strict';
/**
 * Tests for `gad assets upload` and `gad assets download` (task 71-03).
 *
 * Strategy: inject mock supabase-client into require.cache before loading
 * assets.cjs. Use node:test harness; no vitest-specific APIs.
 *
 * Coverage (14 test cases):
 *
 *   upload:
 *     1. Success path — storage upload + metadata insert called, table summary printed.
 *     2. --json output — emits full inserted row as JSON.
 *     3. Labels parsed and passed to insert payload.
 *     4. Path collision retry — suffix appended on duplicate, second upload succeeds.
 *     5. Bucket RPC already-exists error treated as non-fatal (continues).
 *     6. Storage upload hard failure → exitCode=1, no insert attempted.
 *     7. Insert failure → compensation remove called, exitCode=1.
 *     8. Missing local file → exitCode=1, error message includes path.
 *     9. Missing env → exitCode=1, env-config error message.
 *
 *   download:
 *    10. Success path — signed URL created, fetch called, file written, summary line.
 *    11. --json output — emits metadata + downloaded_to + bytes_written.
 *    12. --cli flag → TTL passed as 3600.
 *    13. Asset not found → "Asset <id> not found." + exitCode=1.
 *    14. Signed URL failure → message + exitCode=1.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function runCmd(cmd, args) {
  return cmd.run({ args, rawArgs: [] });
}

// Create a temp file with given content for upload tests.
function makeTempFile(content, ext) {
  const tmpDir = os.tmpdir();
  const name = `gad-test-${crypto.randomBytes(4).toString('hex')}${ext || '.bin'}`;
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

afterEach(() => { process.exitCode = 0; });

// ===========================================================================
// Upload tests
// ===========================================================================

describe('assets upload — success path', () => {
  test('1. calls rpc, storage upload, insert; prints table summary', async () => {
    const tmpFile = makeTempFile('hello world', '.txt');
    const insertedRow = {
      id: 'row-id-1',
      project_id: 'proj-1',
      bucket_name: 'project-assets-proj-1',
      storage_path: 'aabbccdd/gad-test.txt',
      mime_type: 'text/plain',
      size_bytes: 11,
      labels: [],
    };

    const rpcCalls = [];
    const uploadCalls = [];
    const insertCalls = [];

    const mockClient = {
      rpc: (name, params) => { rpcCalls.push({ name, params }); return Promise.resolve({ error: null }); },
      storage: {
        from: (bucket) => ({
          upload: (storagePath, buf, opts) => {
            uploadCalls.push({ bucket, storagePath, opts });
            return Promise.resolve({ data: { path: storagePath }, error: null });
          },
        }),
      },
      from: (table) => ({
        insert: (payload) => {
          insertCalls.push({ table, payload });
          return {
            select: () => Promise.resolve({ data: [insertedRow], error: null }),
          };
        },
      }),
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { stdout, exitCode } = await captureOutput(() =>
      runCmd(cmds.upload, { file: tmpFile, project: 'proj-1', json: false })
    );

    fs.unlinkSync(tmpFile);

    assert.equal(exitCode, 0, `exitCode should be 0, stderr may help: ${stdout}`);
    assert.equal(rpcCalls.length, 1, 'rpc called once');
    assert.equal(rpcCalls[0].name, 'create_project_bucket');
    assert.equal(rpcCalls[0].params.project_id, 'proj-1');
    assert.equal(uploadCalls.length, 1, 'upload called once');
    assert.equal(insertCalls.length, 1, 'insert called once');
    // Table output contains size_bytes value.
    assert.ok(stdout.includes('11'), `stdout should include size: ${stdout}`);
  });
});

describe('assets upload — --json output', () => {
  test('2. emits full inserted row as JSON when --json', async () => {
    const tmpFile = makeTempFile('json-content', '.json');
    const insertedRow = { id: 'row-id-2', project_id: 'proj-2', storage_path: 'ab12cd34/file.json', size_bytes: 12, mime_type: 'application/json', labels: [] };

    const mockClient = {
      rpc: () => Promise.resolve({ error: null }),
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }) }) },
      from: () => ({ insert: () => ({ select: () => Promise.resolve({ data: [insertedRow], error: null }) }) }),
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { stdout, exitCode } = await captureOutput(() =>
      runCmd(cmds.upload, { file: tmpFile, project: 'proj-2', json: true })
    );
    fs.unlinkSync(tmpFile);

    assert.equal(exitCode, 0);
    const jsonStart2 = stdout.indexOf('{');
    assert.ok(jsonStart2 !== -1, `stdout should contain JSON; got: ${stdout}`);
    const parsed = JSON.parse(stdout.slice(jsonStart2));
    assert.equal(parsed.id, 'row-id-2');
  });
});

describe('assets upload — labels', () => {
  test('3. labels comma-string parsed into array in insert payload', async () => {
    const tmpFile = makeTempFile('labelled', '.txt');
    let capturedPayload;

    const mockClient = {
      rpc: () => Promise.resolve({ error: null }),
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }) }) },
      from: () => ({
        insert: (payload) => {
          capturedPayload = payload;
          return { select: () => Promise.resolve({ data: [payload], error: null }) };
        },
      }),
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    await captureOutput(() =>
      runCmd(cmds.upload, { file: tmpFile, project: 'proj-3', labels: 'hero, cover, thumb', json: false })
    );
    fs.unlinkSync(tmpFile);

    assert.deepEqual(capturedPayload.labels, ['hero', 'cover', 'thumb']);
  });
});

describe('assets upload — path collision retry', () => {
  test('4. appends -1 suffix and retries when first upload returns duplicate error', async () => {
    const tmpFile = makeTempFile('collision-content', '.png');
    const uploadCalls = [];
    let insertPayloadCaptured;

    const mockClient = {
      rpc: () => Promise.resolve({ error: null }),
      storage: {
        from: (bucket) => ({
          upload: (storagePath, buf, opts) => {
            uploadCalls.push(storagePath);
            if (uploadCalls.length === 1) {
              return Promise.resolve({ data: null, error: { message: 'The resource already exists' } });
            }
            return Promise.resolve({ data: { path: storagePath }, error: null });
          },
        }),
      },
      from: () => ({
        insert: (payload) => {
          insertPayloadCaptured = payload;
          return { select: () => Promise.resolve({ data: [payload], error: null }) };
        },
      }),
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { exitCode } = await captureOutput(() =>
      runCmd(cmds.upload, { file: tmpFile, project: 'proj-4', json: false })
    );
    fs.unlinkSync(tmpFile);

    assert.equal(exitCode, 0, 'should succeed after retry');
    assert.equal(uploadCalls.length, 2, 'upload called twice');
    // Second path has -1 suffix.
    assert.ok(uploadCalls[1].includes('-1'), `second path should have -1 suffix: ${uploadCalls[1]}`);
    assert.ok(insertPayloadCaptured.storage_path.includes('-1'), 'insert payload path has suffix');
  });
});

describe('assets upload — bucket already-exists is non-fatal', () => {
  test('5. "already exists" RPC error does not abort upload', async () => {
    const tmpFile = makeTempFile('bucket-exists-test', '.txt');
    let uploadCalled = false;

    const mockClient = {
      rpc: () => Promise.resolve({ error: { message: 'Bucket already exists' } }),
      storage: {
        from: () => ({
          upload: (sp, buf, opts) => {
            uploadCalled = true;
            return Promise.resolve({ data: { path: sp }, error: null });
          },
        }),
      },
      from: () => ({ insert: () => ({ select: () => Promise.resolve({ data: [{}], error: null }) }) }),
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { exitCode } = await captureOutput(() =>
      runCmd(cmds.upload, { file: tmpFile, project: 'proj-5', json: false })
    );
    fs.unlinkSync(tmpFile);

    assert.equal(uploadCalled, true, 'upload still called despite bucket-exists RPC error');
    assert.equal(exitCode, 0);
  });
});

describe('assets upload — storage hard failure', () => {
  test('6. hard storage error → exitCode=1, insert never called', async () => {
    const tmpFile = makeTempFile('hard-fail', '.txt');
    let insertCalled = false;

    const mockClient = {
      rpc: () => Promise.resolve({ error: null }),
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ data: null, error: { message: 'storage quota exceeded' } }),
        }),
      },
      from: () => ({
        insert: () => { insertCalled = true; return { select: () => Promise.resolve({ data: [], error: null }) }; },
      }),
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { stderr, exitCode } = await captureOutput(() =>
      runCmd(cmds.upload, { file: tmpFile, project: 'proj-6', json: false })
    );
    fs.unlinkSync(tmpFile);

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('storage quota exceeded'), `stderr: ${stderr}`);
    assert.equal(insertCalled, false, 'insert should NOT be called');
  });
});

describe('assets upload — insert failure compensation', () => {
  test('7. insert failure → remove called (compensation), exitCode=1', async () => {
    const tmpFile = makeTempFile('insert-fail', '.txt');
    const removeCalls = [];

    const mockClient = {
      rpc: () => Promise.resolve({ error: null }),
      storage: {
        from: (bucket) => ({
          upload: (sp) => Promise.resolve({ data: { path: sp }, error: null }),
          remove: (paths) => { removeCalls.push(paths); return Promise.resolve({ error: null }); },
        }),
      },
      from: () => ({ insert: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'insert constraint violation' } }) }) }),
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { stderr, exitCode } = await captureOutput(() =>
      runCmd(cmds.upload, { file: tmpFile, project: 'proj-7', json: false })
    );
    fs.unlinkSync(tmpFile);

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('insert constraint violation'), `stderr: ${stderr}`);
    assert.equal(removeCalls.length, 1, 'remove (compensation) called once');
  });
});

describe('assets upload — missing file', () => {
  test('8. non-existent local file → exitCode=1, path in error message', async () => {
    const bogusPath = '/no/such/file/here.png';

    const cmds = requireAssetsCmd(() => ({ client: {}, hasServiceRole: false }));
    const { stderr, exitCode } = await captureOutput(() =>
      runCmd(cmds.upload, { file: bogusPath, project: 'proj-8', json: false })
    );

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('here.png') || stderr.includes('no/such'), `stderr: ${stderr}`);
  });
});

describe('assets upload — missing env', () => {
  test('9. getSupabaseClient throws → env-config message + exitCode=1', async () => {
    const tmpFile = makeTempFile('env-test', '.txt');

    const cmds = requireAssetsCmd(() => {
      throw new Error('Supabase env not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in your shell or .env.');
    });
    const { stderr, exitCode } = await captureOutput(() =>
      runCmd(cmds.upload, { file: tmpFile, project: 'proj-9', json: false })
    );
    fs.unlinkSync(tmpFile);

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('Supabase env not configured'), `stderr: ${stderr}`);
  });
});

// ===========================================================================
// Download tests
// ===========================================================================

describe('assets download — success path', () => {
  test('10. signed URL created, fetch called, file written, summary line printed', async () => {
    const outDir = os.tmpdir();
    const outFile = path.join(outDir, `gad-dl-test-${crypto.randomBytes(4).toString('hex')}.bin`);
    const fileContent = Buffer.from('downloaded content');

    let signedUrlTtl;
    const assetRow = {
      id: 'asset-dl-1',
      project_id: 'proj-dl',
      bucket_name: 'project-assets-proj-dl',
      storage_path: 'ab12cd34/file.bin',
      mime_type: 'application/octet-stream',
      size_bytes: fileContent.length,
      labels: [],
      created_at: '2026-04-20T00:00:00Z',
    };

    const mockClient = {
      from: (table) => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: assetRow, error: null }),
          }),
        }),
      }),
      storage: {
        from: (bucket) => ({
          createSignedUrl: (sp, ttl) => {
            signedUrlTtl = ttl;
            return Promise.resolve({ data: { signedUrl: 'https://fake.supabase.co/signed/file.bin' }, error: null });
          },
        }),
      },
    };

    // Patch global fetch for this test.
    const origFetch = globalThis.fetch;
    const fetchCalls = [];
    globalThis.fetch = (url) => {
      fetchCalls.push(url);
      const body = {
        ok: true,
        arrayBuffer: () => Promise.resolve(fileContent.buffer.slice(fileContent.byteOffset, fileContent.byteOffset + fileContent.byteLength)),
      };
      return Promise.resolve(body);
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { stdout, exitCode } = await captureOutput(() =>
      runCmd(cmds.download, { assetId: 'asset-dl-1', out: outFile, cli: false, json: false })
    );

    globalThis.fetch = origFetch;

    try { fs.unlinkSync(outFile); } catch (_) {}

    assert.equal(exitCode, 0, `exitCode should be 0; stdout: ${stdout}`);
    assert.equal(fetchCalls.length, 1, 'fetch called once');
    assert.equal(signedUrlTtl, 60, 'default TTL is 60s');
    assert.ok(stdout.includes('Downloaded'), `stdout should include "Downloaded": ${stdout}`);
  });
});

describe('assets download — --json output', () => {
  test('11. --json emits metadata + downloaded_to + bytes_written', async () => {
    const outFile = path.join(os.tmpdir(), `gad-dl-json-${crypto.randomBytes(4).toString('hex')}.txt`);
    const fileContent = Buffer.from('json-download');
    const assetRow = {
      id: 'asset-json-1',
      bucket_name: 'project-assets-pj',
      storage_path: '00112233/data.txt',
      size_bytes: fileContent.length,
    };

    const mockClient = {
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: assetRow, error: null }) }) }) }),
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://x.io/f' }, error: null }) }) },
    };

    const origFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(fileContent.buffer.slice(fileContent.byteOffset, fileContent.byteOffset + fileContent.byteLength)),
    });

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { stdout, exitCode } = await captureOutput(() =>
      runCmd(cmds.download, { assetId: 'asset-json-1', out: outFile, cli: false, json: true })
    );

    globalThis.fetch = origFetch;
    try { fs.unlinkSync(outFile); } catch (_) {}

    assert.equal(exitCode, 0);
    // node:test may run suites concurrently; strip any leading non-JSON output
    // (e.g. "▶ assets download …" suite headers) before parsing.
    const jsonStart = stdout.indexOf('{');
    assert.ok(jsonStart !== -1, `stdout should contain a JSON object; got: ${stdout}`);
    const fullParsed = JSON.parse(stdout.slice(jsonStart));
    assert.equal(fullParsed.id, 'asset-json-1');
    assert.ok(fullParsed.downloaded_to, 'downloaded_to present');
    assert.ok(typeof fullParsed.bytes_written === 'number', 'bytes_written is a number');
  });
});

describe('assets download — --cli flag TTL', () => {
  test('12. --cli sets TTL to 3600', async () => {
    const outFile = path.join(os.tmpdir(), `gad-dl-cli-${crypto.randomBytes(4).toString('hex')}.txt`);
    const fileContent = Buffer.from('cli-ttl');
    const assetRow = { id: 'a-cli', bucket_name: 'b', storage_path: 'xx/file.txt', size_bytes: 7 };
    let capturedTtl;

    const mockClient = {
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: assetRow, error: null }) }) }) }),
      storage: { from: () => ({ createSignedUrl: (sp, ttl) => { capturedTtl = ttl; return Promise.resolve({ data: { signedUrl: 'https://x.io/f' }, error: null }); } }) },
    };

    const origFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(fileContent.buffer.slice(fileContent.byteOffset, fileContent.byteOffset + fileContent.byteLength)),
    });

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { exitCode } = await captureOutput(() =>
      runCmd(cmds.download, { assetId: 'a-cli', out: outFile, cli: true, json: false })
    );

    globalThis.fetch = origFetch;
    try { fs.unlinkSync(outFile); } catch (_) {}

    assert.equal(exitCode, 0);
    assert.equal(capturedTtl, 3600, `--cli should set TTL to 3600; got ${capturedTtl}`);
  });
});

describe('assets download — asset not found', () => {
  test('13. asset not found → "Asset <id> not found." + exitCode=1', async () => {
    const mockClient = {
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'no rows' } }) }) }) }),
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { stderr, exitCode } = await captureOutput(() =>
      runCmd(cmds.download, { assetId: 'missing-id', cli: false, json: false })
    );

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('missing-id'), `stderr should include asset id: ${stderr}`);
    assert.ok(stderr.toLowerCase().includes('not found'), `stderr should include "not found": ${stderr}`);
  });
});

describe('assets download — signed URL failure', () => {
  test('14. signed URL error → message + exitCode=1', async () => {
    const assetRow = { id: 'a-url-fail', bucket_name: 'b', storage_path: 'xx/file.txt', size_bytes: 0 };

    const mockClient = {
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: assetRow, error: null }) }) }) }),
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: { message: 'bucket not found' } }) }) },
    };

    const cmds = requireAssetsCmd(() => ({ client: mockClient, hasServiceRole: true }));
    const { stderr, exitCode } = await captureOutput(() =>
      runCmd(cmds.download, { assetId: 'a-url-fail', cli: false, json: false })
    );

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('bucket not found'), `stderr: ${stderr}`);
  });
});
