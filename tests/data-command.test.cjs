'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createDataCommand } = require('../bin/commands/data.cjs');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gad-data-cmd-'));
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function captureOutput(fn) {
  const stdout = [];
  const stderr = [];
  const origLog = console.log;
  const origErr = console.error;

  console.log = (...args) => { stdout.push(args.join(' ') + '\n'); };
  console.error = (...args) => { stderr.push(args.join(' ') + '\n'); };

  const result = fn();
  const restore = () => {
    console.log = origLog;
    console.error = origErr;
  };

  if (result && typeof result.then === 'function') {
    return result.then((value) => {
      restore();
      return { stdout: stdout.join(''), stderr: stderr.join(''), value };
    }).catch((err) => {
      restore();
      throw err;
    });
  }

  restore();
  return { stdout: stdout.join(''), stderr: stderr.join('') };
}

async function runSubcommand(command, name, args) {
  return command.subCommands[name].run({ args, rawArgs: [] });
}

function createDeps({ repoRoot, fetchImpl, getSupabaseClient }) {
  return {
    findRepoRoot: () => repoRoot,
    gadConfig: {
      load: () => ({
        roots: [
          { id: 'global', path: '.', planningDir: '.planning' },
          { id: 'child', path: 'apps/child', planningDir: '.planning' },
        ],
      }),
    },
    fetchImpl,
    getSupabaseClient,
    outputError: (message) => {
      throw new Error(message);
    },
  };
}

describe('gad data command', () => {
  let repoRoot;
  let childRoot;
  let oldVercelToken;
  let oldBlobToken;

  beforeEach(() => {
    repoRoot = makeTempDir();
    childRoot = path.join(repoRoot, 'apps', 'child');
    fs.mkdirSync(path.join(repoRoot, '.planning'), { recursive: true });
    fs.mkdirSync(path.join(childRoot, '.planning'), { recursive: true });
    oldVercelToken = process.env.VERCEL_API_TOKEN;
    oldBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_API_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterEach(() => {
    if (oldVercelToken == null) delete process.env.VERCEL_API_TOKEN;
    else process.env.VERCEL_API_TOKEN = oldVercelToken;
    if (oldBlobToken == null) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = oldBlobToken;
    rmrf(repoRoot);
  });

  test('tables queries information_schema through Supabase schema switching', async () => {
    const calls = [];
    const query = {
      select(columns) { calls.push(['select', columns]); return query; },
      eq(column, value) { calls.push(['eq', column, value]); return query; },
      order(column, options) { calls.push(['order', column, options]); return Promise.resolve({ data: [{ table_schema: 'public', table_name: 'projects', table_type: 'BASE TABLE' }], error: null }); },
    };
    const client = {
      schema(schemaName) {
        calls.push(['schema', schemaName]);
        return {
          from(tableName) {
            calls.push(['from', tableName]);
            return query;
          },
        };
      },
    };
    const cmd = createDataCommand(createDeps({
      repoRoot,
      getSupabaseClient: () => ({ client, hasServiceRole: true }),
    }));

    const { stdout } = await captureOutput(() => runSubcommand(cmd, 'tables', {
      projectid: 'global',
      json: true,
    }));

    assert.deepEqual(calls, [
      ['schema', 'information_schema'],
      ['from', 'tables'],
      ['select', 'table_schema,table_name,table_type'],
      ['eq', 'table_schema', 'public'],
      ['order', 'table_name', { ascending: true }],
    ]);
    const payload = JSON.parse(stdout);
    assert.equal(payload[0].table_name, 'projects');
  });

  test('local-fs list is scoped to the resolved project root', async () => {
    const bucketDir = path.join(childRoot, 'content');
    fs.mkdirSync(bucketDir, { recursive: true });
    fs.writeFileSync(path.join(bucketDir, 'a.txt'), 'A');
    fs.writeFileSync(path.join(bucketDir, 'b.txt'), 'B');
    fs.mkdirSync(path.join(repoRoot, 'content'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'content', 'wrong.txt'), 'wrong');

    const cmd = createDataCommand(createDeps({ repoRoot }));
    const { stdout } = await captureOutput(() => runSubcommand(cmd, 'list', {
      projectid: 'child',
      bucket: 'content',
      adapter: 'local-fs',
      json: true,
      limit: '10',
    }));

    const payload = JSON.parse(stdout);
    assert.deepEqual(payload.map((row) => row.name).sort(), ['a.txt', 'b.txt']);
  });

  test('local-fs put then get writes inside the project root', async () => {
    const cmd = createDataCommand(createDeps({ repoRoot }));

    await captureOutput(() => runSubcommand(cmd, 'put', {
      projectid: 'child',
      bucket: 'data',
      key: 'nested/example.json',
      adapter: 'local-fs',
      value: '{"ok":true}',
    }));

    const written = path.join(childRoot, 'data', 'nested', 'example.json');
    assert.equal(fs.readFileSync(written, 'utf8'), '{"ok":true}');

    const { stdout } = await captureOutput(() => runSubcommand(cmd, 'get', {
      projectid: 'child',
      bucket: 'data',
      key: 'nested/example.json',
      adapter: 'local-fs',
      json: false,
    }));

    assert.equal(stdout.trim(), '{"ok":true}');
  });

  test('vercel-blob list reads token from .env and prefixes by bucket', async () => {
    fs.writeFileSync(path.join(repoRoot, '.env'), 'VERCEL_API_TOKEN=token-from-env\n');
    const fetchCalls = [];
    const cmd = createDataCommand(createDeps({
      repoRoot,
      fetchImpl: async (url, init) => {
        fetchCalls.push({
          url: String(url),
          auth: init.headers.Authorization,
        });
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              blobs: [{ pathname: 'gallery/hero.png', size: 123, url: 'https://blob.example/hero.png' }],
            });
          },
        };
      },
    }));

    const { stdout } = await captureOutput(() => runSubcommand(cmd, 'list', {
      projectid: 'global',
      bucket: 'gallery',
      adapter: 'vercel-blob',
      json: true,
      limit: '25',
    }));

    const payload = JSON.parse(stdout);
    assert.equal(payload[0].pathname, 'gallery/hero.png');
    assert.match(fetchCalls[0].url, /prefix=gallery%2F/);
    assert.equal(fetchCalls[0].auth, 'Bearer token-from-env');
  });

  test('vercel-blob get fetches the exact blob after listing', async () => {
    fs.writeFileSync(path.join(repoRoot, '.env'), 'VERCEL_API_TOKEN=blob-token\n');
    const fetchCalls = [];
    const cmd = createDataCommand(createDeps({
      repoRoot,
      fetchImpl: async (url, init = {}) => {
        fetchCalls.push({ url: String(url), init });
        if (String(url).startsWith('https://blob.vercel-storage.com')) {
          return {
            ok: true,
            status: 200,
            async text() {
              return JSON.stringify({
                blobs: [{ pathname: 'gallery/hero.txt', url: 'https://store.public.blob.vercel-storage.com/gallery/hero.txt' }],
              });
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async text() {
            return 'hello blob';
          },
        };
      },
    }));

    const { stdout } = await captureOutput(() => runSubcommand(cmd, 'get', {
      projectid: 'global',
      bucket: 'gallery',
      key: 'hero.txt',
      adapter: 'vercel-blob',
      json: false,
    }));

    assert.equal(stdout.trim(), 'hello blob');
    assert.equal(fetchCalls.length, 2);
    assert.match(fetchCalls[0].url, /prefix=gallery%2Fhero\.txt%2F?/);
    assert.equal(fetchCalls[1].init.headers.Authorization, 'Bearer blob-token');
  });

  test('supabase put injects the key into the configured id column', async () => {
    const upsertCalls = [];
    const client = {
      from(table) {
        assert.equal(table, 'projects');
        return {
          upsert(payload) {
            upsertCalls.push(payload);
            return {
              select() {
                return Promise.resolve({ data: [payload], error: null });
              },
            };
          },
        };
      },
    };

    const cmd = createDataCommand(createDeps({
      repoRoot,
      getSupabaseClient: () => ({ client, hasServiceRole: true }),
    }));

    await captureOutput(() => runSubcommand(cmd, 'put', {
      projectid: 'global',
      bucket: 'projects',
      key: 'proj-1',
      adapter: 'supabase-rest',
      value: '{"name":"Alpha"}',
      'id-column': 'id',
    }));

    assert.deepEqual(upsertCalls, [{ name: 'Alpha', id: 'proj-1' }]);
  });
});
