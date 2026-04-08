#!/usr/bin/env node
'use strict';

/**
 * MCP tooling eval harness.
 *
 * Spawns gad-mcp.cjs as a child process, sends golden tool invocations,
 * measures cold-start and per-tool latency, asserts correctness.
 * Produces TRACE.json with eval_type: "mcp".
 *
 * Usage: node harness.cjs [--version vN]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const evalsDir = __dirname;
const mcpBin = path.join(__dirname, '..', '..', 'bin', 'gad-mcp.cjs');
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');

// Parse args
const args = process.argv.slice(2);
const versionIdx = args.indexOf('--version');
let version = 'v1';
if (versionIdx >= 0 && args[versionIdx + 1]) {
  version = args[versionIdx + 1];
} else {
  const existing = fs.readdirSync(evalsDir).filter(n => /^v\d+$/.test(n)).map(n => parseInt(n.slice(1)));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  version = `v${next}`;
}

const runDir = path.join(evalsDir, version);
fs.mkdirSync(runDir, { recursive: true });

console.log(`MCP eval: tooling-mcp ${version}`);
console.log(`Server: ${mcpBin}\n`);

// --- MCP client helpers ---

let msgId = 0;
let responseBuffer = Buffer.alloc(0);
const pending = new Map();

function sendMessage(proc, method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    const frame = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
    pending.set(id, { resolve, reject, sent: Date.now() });
    proc.stdin.write(frame);
    // Timeout after 10s
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout on ${method}`));
      }
    }, 10000);
  });
}

function handleData(chunk) {
  const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
  responseBuffer = Buffer.concat([responseBuffer, buf]);
  while (true) {
    const headerEnd = responseBuffer.indexOf('\r\n\r\n');
    if (headerEnd < 0) break;
    const header = responseBuffer.slice(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { responseBuffer = responseBuffer.slice(headerEnd + 4); continue; }
    const len = parseInt(match[1]);
    const bodyStart = headerEnd + 4;
    if (responseBuffer.length < bodyStart + len) break;
    const body = responseBuffer.slice(bodyStart, bodyStart + len).toString('utf8');
    responseBuffer = responseBuffer.slice(bodyStart + len);
    try {
      const msg = JSON.parse(body);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        p.resolve({ ...msg, duration_ms: Date.now() - p.sent });
      }
    } catch {}
  }
}

// --- Run eval ---

async function run() {
  const startTime = Date.now();
  const results = [];

  // Spawn MCP server
  const coldStart = Date.now();
  const proc = spawn('node', [mcpBin], {
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stdout.on('data', handleData);
  proc.stderr.on('data', () => {}); // Suppress stderr

  // Wait a moment for startup
  await new Promise(r => setTimeout(r, 500));

  // Test 1: Initialize
  try {
    const resp = await sendMessage(proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'gad-mcp-eval', version: '1.0' },
    });
    const coldStartMs = Date.now() - coldStart;
    results.push({
      tool: 'initialize',
      pass: !!resp.result?.serverInfo,
      duration_ms: resp.duration_ms,
      detail: `serverInfo: ${resp.result?.serverInfo?.name}`,
    });
    results.push({
      tool: 'cold-start',
      pass: coldStartMs < 3000,
      duration_ms: coldStartMs,
      detail: `cold start: ${coldStartMs}ms`,
    });

    // Send initialized notification (required by MCP protocol)
    const notifBody = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' });
    proc.stdin.write(`Content-Length: ${Buffer.byteLength(notifBody)}\r\n\r\n${notifBody}`);
    await new Promise(r => setTimeout(r, 100));
  } catch (e) {
    results.push({ tool: 'initialize', pass: false, duration_ms: 0, detail: e.message });
  }

  // Test 2: List tools
  try {
    const resp = await sendMessage(proc, 'tools/list', {});
    const toolCount = resp.result?.tools?.length || 0;
    results.push({
      tool: 'tools/list',
      pass: toolCount >= 5,
      duration_ms: resp.duration_ms,
      detail: `${toolCount} tools listed`,
    });
  } catch (e) {
    results.push({ tool: 'tools/list', pass: false, duration_ms: 0, detail: e.message });
  }

  // Test 3: gad_verify
  try {
    const resp = await sendMessage(proc, 'tools/call', {
      name: 'gad_verify',
      arguments: {},
    });
    const text = resp.result?.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    results.push({
      tool: 'gad_verify',
      pass: parsed.ok === true || parsed.ok === false, // just needs to return valid JSON
      duration_ms: resp.duration_ms,
      detail: `ok=${parsed.ok}, xml_files=${parsed.xmlFileCount}`,
    });
  } catch (e) {
    results.push({ tool: 'gad_verify', pass: false, duration_ms: 0, detail: e.message });
  }

  // Test 4: gad_state
  try {
    const resp = await sendMessage(proc, 'tools/call', {
      name: 'gad_state',
      arguments: { projectid: 'get-anything-done' },
    });
    const text = resp.result?.content?.[0]?.text || '';
    results.push({
      tool: 'gad_state',
      pass: text.length > 10,
      duration_ms: resp.duration_ms,
      detail: `${text.length} chars returned`,
    });
  } catch (e) {
    results.push({ tool: 'gad_state', pass: false, duration_ms: 0, detail: e.message });
  }

  // Test 5: gad_snapshot
  try {
    const resp = await sendMessage(proc, 'tools/call', {
      name: 'gad_snapshot',
      arguments: { projectid: 'get-anything-done' },
    });
    const text = resp.result?.content?.[0]?.text || '';
    results.push({
      tool: 'gad_snapshot',
      pass: text.length > 100,
      duration_ms: resp.duration_ms,
      detail: `${text.length} chars, ~${Math.ceil(text.length / 4)} tokens`,
    });
  } catch (e) {
    results.push({ tool: 'gad_snapshot', pass: false, duration_ms: 0, detail: e.message });
  }

  // Shutdown
  proc.kill('SIGTERM');

  const totalDuration = Date.now() - startTime;
  const passes = results.filter(r => r.pass).length;
  const failures = results.filter(r => !r.pass).length;

  // Output
  console.log('Results:');
  for (const r of results) {
    const mark = r.pass ? '✓' : '✗';
    console.log(`  ${mark} ${r.tool} (${r.duration_ms}ms) — ${r.detail}`);
  }
  console.log(`\n${passes}/${results.length} passed, ${failures} failed, ${totalDuration}ms total`);

  // Latency metrics
  const toolResults = results.filter(r => r.tool.startsWith('gad_'));
  const latencies = toolResults.map(r => r.duration_ms).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  // Write TRACE.json
  const trace = {
    eval: 'tooling-mcp',
    version,
    date: new Date().toISOString().slice(0, 10),
    gad_version: require('../../package.json').version,
    eval_type: 'mcp',
    trace_schema_version: 2,
    scenario: 'golden-tools',

    timing: {
      started: new Date(startTime).toISOString(),
      ended: new Date().toISOString(),
      duration_ms: totalDuration,
    },

    mcp: {
      tools_tested: toolResults.length,
      tools_passed: toolResults.filter(r => r.pass).length,
      cold_start_ms: results.find(r => r.tool === 'cold-start')?.duration_ms || 0,
      per_tool: results.map(r => ({
        tool: r.tool,
        duration_ms: r.duration_ms,
        pass: r.pass,
      })),
    },

    metrics: { p50_ms: p50, p95_ms: p95, error_rate: failures / results.length },

    scores: {
      correctness: passes / results.length,
      latency: Math.max(0, 1 - (p95 / 5000)),
      mcp_composite: null,
    },
  };
  trace.scores.mcp_composite = (trace.scores.correctness * 0.60) + (trace.scores.latency * 0.40);

  fs.writeFileSync(path.join(runDir, 'TRACE.json'), JSON.stringify(trace, null, 2));
  console.log(`\nTRACE.json written: ${version}/TRACE.json`);
  console.log(`Composite: ${trace.scores.mcp_composite.toFixed(3)}`);

  process.exit(failures > 0 ? 1 : 0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
