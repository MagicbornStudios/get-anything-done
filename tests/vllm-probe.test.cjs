'use strict';
// Tests for lib/runtime-health/vllm-probe.cjs
// Uses mocked HTTP by monkey-patching node:http/https require chains.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');

// We test the module's logic by spinning up a real tiny http server
// on a random port, setting GAD_VLLM_ENDPOINT, then importing the probe.
// This avoids any monkey-patching fragility and exercises the full code path.

const probePath = path.resolve(__dirname, '..', 'lib', 'runtime-health', 'vllm-probe.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModelsBody(ids = ['dr-stein-v2']) {
  return JSON.stringify({
    object: 'list',
    data: ids.map((id) => ({ id, object: 'model' })),
  });
}

function startServer(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

function serverUrl(server) {
  const { address, port } = server.address();
  return `http://${address}:${port}`;
}

// Fresh require each test by deleting cached module
function freshProbe() {
  delete require.cache[probePath];
  return require(probePath);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('vllm-probe unit tests', () => {
  let prevEnv;

  before(() => {
    prevEnv = process.env.GAD_VLLM_ENDPOINT;
  });

  after(() => {
    if (prevEnv === undefined) delete process.env.GAD_VLLM_ENDPOINT;
    else process.env.GAD_VLLM_ENDPOINT = prevEnv;
    delete require.cache[probePath];
  });

  // -------------------------------------------------------------------------
  // present:false when no config
  // -------------------------------------------------------------------------
  test('returns present:false when no env var and no config file found', async () => {
    delete process.env.GAD_VLLM_ENDPOINT;
    delete require.cache[probePath];

    // Override KNOWN_SERVE_CONFIGS by ensuring none exist at test time.
    // The probe module reads from os.homedir()-based paths; in CI those
    // files won't be there, so present:false is the expected outcome.
    const { checkVllm, detectEndpoint } = freshProbe();

    // detectEndpoint should return null (no env, no config files in CI)
    const det = detectEndpoint();
    // On dev machine with slm_learning present, det may be non-null.
    // We only assert the null-case when it is truly absent.
    if (det === null) {
      const result = await checkVllm();
      assert.strictEqual(result.present, false);
      assert.strictEqual(Object.keys(result).length, 1, 'only key is present');
    } else {
      // If the config file exists on this machine, skip — that's a valid detection.
      // Just verify the shape is correct.
      assert.strictEqual(typeof det.endpoint, 'string');
      assert.strictEqual(typeof det.source, 'string');
    }
  });

  // -------------------------------------------------------------------------
  // alive:true, models parsed
  // -------------------------------------------------------------------------
  test('alive=true with model list when /v1/models returns 200 JSON', async () => {
    const modelIds = ['dr-stein-v2', 'base-qwen'];
    const srv = await startServer((req, res) => {
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(makeModelsBody(modelIds));
      } else {
        res.writeHead(404);
        res.end('not found');
      }
    });

    try {
      process.env.GAD_VLLM_ENDPOINT = `${serverUrl(srv)}/v1/models`;
      const { checkVllm } = freshProbe();
      const result = await checkVllm({ probeTimeoutMs: 2000, skipMetrics: true });

      assert.strictEqual(result.present, true);
      assert.strictEqual(result.alive, true);
      assert.ok(Array.isArray(result.models));
      assert.strictEqual(result.models.length, 2);
      const ids = result.models.map((m) => m.id);
      assert.deepStrictEqual(ids.sort(), modelIds.slice().sort());
      assert.ok(!('error' in result), 'no error key on healthy response');
    } finally {
      srv.close();
    }
  });

  // -------------------------------------------------------------------------
  // alive:false on unreachable
  // -------------------------------------------------------------------------
  test('alive=false with reason=unreachable on ECONNREFUSED', async () => {
    // Pick a port nothing is listening on (use ephemeral, then close immediately)
    const tempSrv = await startServer((_, res) => res.end());
    const port = tempSrv.address().port;
    await new Promise((r) => tempSrv.close(r));

    process.env.GAD_VLLM_ENDPOINT = `http://127.0.0.1:${port}/v1/models`;
    const { checkVllm } = freshProbe();
    const result = await checkVllm({ probeTimeoutMs: 2000, skipMetrics: true });

    assert.strictEqual(result.present, true);
    assert.strictEqual(result.alive, false);
    assert.ok(result.error, 'error key set');
    assert.match(result.error, /unreachable|connection-error/);
  });

  // -------------------------------------------------------------------------
  // alive:true but error=protocol-mismatch on 4xx
  // -------------------------------------------------------------------------
  test('alive=true with protocol-mismatch error on 4xx response', async () => {
    const srv = await startServer((req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });

    try {
      process.env.GAD_VLLM_ENDPOINT = `${serverUrl(srv)}/v1/models`;
      const { checkVllm } = freshProbe();
      const result = await checkVllm({ probeTimeoutMs: 2000, skipMetrics: true });

      assert.strictEqual(result.present, true);
      assert.strictEqual(result.alive, true);
      assert.match(result.error, /protocol-mismatch/);
    } finally {
      srv.close();
    }
  });

  // -------------------------------------------------------------------------
  // alive:false on 5xx
  // -------------------------------------------------------------------------
  test('alive=false with server-error on 5xx response', async () => {
    const srv = await startServer((req, res) => {
      res.writeHead(503);
      res.end('Service Unavailable');
    });

    try {
      process.env.GAD_VLLM_ENDPOINT = `${serverUrl(srv)}/v1/models`;
      const { checkVllm } = freshProbe();
      const result = await checkVllm({ probeTimeoutMs: 2000, skipMetrics: true });

      assert.strictEqual(result.present, true);
      assert.strictEqual(result.alive, false);
      assert.match(result.error, /server-error/);
    } finally {
      srv.close();
    }
  });

  // -------------------------------------------------------------------------
  // /metrics parsing
  // -------------------------------------------------------------------------
  test('parseMetrics extracts throughput and queue_depth from prometheus text', () => {
    const { parseMetrics } = freshProbe();
    const sample = [
      '# HELP vllm:avg_generation_throughput_toks_per_s Average generation throughput',
      '# TYPE vllm:avg_generation_throughput_toks_per_s gauge',
      'vllm:avg_generation_throughput_toks_per_s 47.3',
      '# HELP vllm:num_requests_waiting Number of requests waiting',
      '# TYPE vllm:num_requests_waiting gauge',
      'vllm:num_requests_waiting 2',
    ].join('\n');

    const result = parseMetrics(sample);
    assert.strictEqual(result.throughput, 47.3);
    assert.strictEqual(result.queue_depth, 2);
  });

  test('parseMetrics returns empty object when no vllm metrics present', () => {
    const { parseMetrics } = freshProbe();
    const result = parseMetrics('# no relevant metrics here\nsome_other_metric 1.0');
    assert.deepStrictEqual(result, {});
  });

  // -------------------------------------------------------------------------
  // /metrics surfaced in checkVllm result
  // -------------------------------------------------------------------------
  test('throughput and queue_depth populated from /metrics when server exposes them', async () => {
    const metricsBody = [
      'vllm:avg_generation_throughput_toks_per_s 120.5',
      'vllm:num_requests_waiting 0',
    ].join('\n');

    const srv = await startServer((req, res) => {
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(makeModelsBody(['test-model']));
      } else if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(metricsBody);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    try {
      process.env.GAD_VLLM_ENDPOINT = `${serverUrl(srv)}/v1/models`;
      const { checkVllm } = freshProbe();
      const result = await checkVllm({ probeTimeoutMs: 2000, metricsTimeoutMs: 2000 });

      assert.strictEqual(result.alive, true);
      assert.strictEqual(result.throughput, 120.5);
      assert.strictEqual(result.queue_depth, 0);
    } finally {
      srv.close();
    }
  });
});
