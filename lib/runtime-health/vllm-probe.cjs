'use strict';

/**
 * lib/runtime-health/vllm-probe.cjs
 *
 * vLLM endpoint health probe for `gad runtime check`.
 *
 * Detection priority:
 *   1. GAD_VLLM_ENDPOINT env var (explicit override)
 *   2. C:/Users/benja/Documents/slm_learning/modal_app/serve_vllm.py
 *      — reads DEFAULT_SERVED_NAME / any local-port override comment
 *   3. Common default: http://localhost:8000/v1/models
 *
 * Output shape:
 *   { present: false }
 *   { present: true, endpoint, alive, models?, throughput?, queue_depth?, error? }
 *
 * Self-contained: node:http / node:https / node:fs only. No external deps.
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 2000;
const METRICS_TIMEOUT_MS = 2000;

const KNOWN_SERVE_CONFIGS = [
  // slm-learning sibling — checked by absolute path + common OS locations
  path.join(os.homedir(), 'Documents', 'slm_learning', 'modal_app', 'serve_vllm.py'),
  // CI / Linux equivalent
  path.join(os.homedir(), 'slm_learning', 'modal_app', 'serve_vllm.py'),
];

const LOCAL_DEFAULT_URL = 'http://localhost:8000/v1/models';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Scan a serve_vllm.py file for a LOCAL_PORT = <n> comment or assignment.
 * Returns null if not found (caller falls back to 8000).
 */
function extractLocalPort(filePath) {
  try {
    const src = fs.readFileSync(filePath, 'utf8');
    // Look for: LOCAL_PORT = 1234  or  # local-port: 1234
    const m = src.match(/LOCAL_PORT\s*=\s*(\d{4,5})|local[-_]port[:\s]+(\d{4,5})/i);
    if (m) return parseInt(m[1] || m[2], 10);
  } catch {
    // unreadable — ignore
  }
  return null;
}

/**
 * Build the candidate endpoint URL from a serve config file path.
 */
function endpointFromServeConfig(filePath) {
  const port = extractLocalPort(filePath) || 8000;
  return `http://localhost:${port}/v1/models`;
}

/**
 * Detect a candidate vLLM endpoint URL from env / config files / defaults.
 * Returns { endpoint: string, source: string } or null if nothing found.
 */
function detectEndpoint() {
  // 1. Explicit env var
  const envVal = process.env.GAD_VLLM_ENDPOINT;
  if (envVal && envVal.trim()) {
    let url = envVal.trim();
    // Normalise: append /v1/models if bare base URL
    if (!url.includes('/v1/models')) {
      url = url.replace(/\/$/, '') + '/v1/models';
    }
    return { endpoint: url, source: 'env:GAD_VLLM_ENDPOINT' };
  }

  // 2. Known serve config files
  for (const filePath of KNOWN_SERVE_CONFIGS) {
    if (fs.existsSync(filePath)) {
      const endpoint = endpointFromServeConfig(filePath);
      return { endpoint, source: `config:${filePath}` };
    }
  }

  // 3. Common default — only report present:true if we actually detect
  //    a config OR an env var. Without either, we cannot know whether the
  //    user intends to run vLLM locally, so we skip the default probe and
  //    return null (present: false).
  return null;
}

/**
 * Issue an HTTP/HTTPS GET, resolve with { statusCode, body } or reject on
 * connection error / timeout.
 */
function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        timeout: timeoutMs,
        headers: { Accept: 'application/json' },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }),
        );
        res.on('error', reject);
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    });
    req.on('error', reject);
  });
}

/**
 * Parse Prometheus-style /metrics text for vLLM-specific gauges.
 * Returns { throughput?, queue_depth? } — keys omitted when not present.
 */
function parseMetrics(text) {
  const result = {};
  // vllm:avg_generation_throughput_toks_per_s
  const thr = text.match(/vllm:avg_generation_throughput_toks_per_s[^{}\n]*\s+([\d.]+)/);
  if (thr) result.throughput = parseFloat(thr[1]);
  // vllm:num_requests_waiting (queue depth)
  const q = text.match(/vllm:num_requests_waiting[^{}\n]*\s+([\d.]+)/);
  if (q) result.queue_depth = parseFloat(q[1]);
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * checkVllm(opts?)
 *
 * opts:
 *   probeTimeoutMs   — ms for /v1/models GET (default 2000)
 *   metricsTimeoutMs — ms for /metrics GET (default 2000)
 *   skipMetrics      — skip /metrics probe (default false)
 *
 * Returns the vllm shape:
 *   { present: false }
 *   { present: true, endpoint, alive, models?, throughput?, queue_depth?, error? }
 */
async function checkVllm(opts = {}) {
  const probeMs = opts.probeTimeoutMs || PROBE_TIMEOUT_MS;
  const metricsMs = opts.metricsTimeoutMs || METRICS_TIMEOUT_MS;
  const skipMetrics = Boolean(opts.skipMetrics);

  const detected = detectEndpoint();
  if (!detected) {
    return { present: false };
  }

  const { endpoint, source } = detected;
  const base = { present: true, endpoint, source };

  // Probe /v1/models
  let probeResult;
  try {
    probeResult = await httpGet(endpoint, probeMs);
  } catch (err) {
    const reason = (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET')
      ? 'timeout'
      : err.code === 'ECONNREFUSED'
        ? 'unreachable'
        : `connection-error:${err.code || err.message}`;
    return { ...base, alive: false, error: reason };
  }

  const { statusCode, body } = probeResult;

  // 5xx → server error
  if (statusCode >= 500) {
    return { ...base, alive: false, error: `server-error:${statusCode}` };
  }

  // 4xx → server is up but protocol mismatch
  if (statusCode >= 400) {
    return { ...base, alive: true, error: `protocol-mismatch:${statusCode}` };
  }

  // 2xx → parse model list
  let models;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed.data)) {
      models = parsed.data.map((m) => ({ id: m.id, object: m.object }));
    }
  } catch {
    // non-JSON 2xx — still alive, just unexpected body
    return { ...base, alive: true, error: 'response-parse-error' };
  }

  const result = { ...base, alive: true, models };

  // Optional: probe /metrics on the same base URL
  if (!skipMetrics) {
    const metricsUrl = endpoint.replace(/\/v1\/models$/, '/metrics');
    try {
      const mRes = await httpGet(metricsUrl, metricsMs);
      if (mRes.statusCode === 200) {
        const stats = parseMetrics(mRes.body);
        if ('throughput' in stats) result.throughput = stats.throughput;
        if ('queue_depth' in stats) result.queue_depth = stats.queue_depth;
      }
    } catch {
      // /metrics not exposed — not an error
    }
  }

  return result;
}

module.exports = { checkVllm, detectEndpoint, parseMetrics };
