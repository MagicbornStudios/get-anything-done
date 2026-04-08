#!/usr/bin/env node
'use strict';

/**
 * Tooling eval harness for gad dev / watch-planning.
 *
 * Runs against a fixed fixture directory with known good and bad file paths.
 * Asserts correctness (missing paths detected) and measures latency.
 * Produces TRACE.json with eval_type: "tooling".
 *
 * Usage: node harness.cjs [--version vN]
 */

const fs = require('fs');
const path = require('path');
const { verifyPlanningXmlRefs } = require('../../lib/planning-ref-verify.cjs');

const fixtureDir = path.join(__dirname, 'fixture');
const evalsDir = __dirname;

// Parse args
const args = process.argv.slice(2);
const versionArg = args.find(a => a.startsWith('--version'));
const versionIdx = args.indexOf('--version');
let version = 'v1';
if (versionIdx >= 0 && args[versionIdx + 1]) {
  version = args[versionIdx + 1];
} else {
  // Auto-increment
  const existing = fs.readdirSync(evalsDir).filter(n => /^v\d+$/.test(n)).map(n => parseInt(n.slice(1)));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  version = `v${next}`;
}

const runDir = path.join(evalsDir, version);
fs.mkdirSync(runDir, { recursive: true });

console.log(`Tooling eval: tooling-watch ${version}`);
console.log(`Fixture: ${fixtureDir}\n`);

// --- Run tests ---

const results = [];
const startTime = Date.now();

// Test 1: Verify detects the known-bad path
{
  const start = Date.now();
  const result = verifyPlanningXmlRefs(fixtureDir);
  const duration = Date.now() - start;

  const hasMissing = result.missing.some(m => m.path === 'src/does-not-exist.ts');
  const hasGood = !result.missing.some(m => m.path === 'src/index.ts');

  results.push({
    test: 'detect-missing-path',
    pass: hasMissing,
    duration_ms: duration,
    detail: `missing=${result.missing.length}, expected bad path detected: ${hasMissing}`,
  });

  results.push({
    test: 'accept-good-path',
    pass: hasGood,
    duration_ms: duration,
    detail: `good path src/index.ts not in missing list: ${hasGood}`,
  });
}

// Test 2: Latency — run verify 10 times, measure p50/p95
{
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    verifyPlanningXmlRefs(fixtureDir);
    times.push(Date.now() - start);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

  results.push({
    test: 'latency-p50',
    pass: p50 < 200,
    duration_ms: p50,
    detail: `p50=${p50}ms (threshold: 200ms)`,
  });

  results.push({
    test: 'latency-p95',
    pass: p95 < 500,
    duration_ms: p95,
    detail: `p95=${p95}ms (threshold: 500ms)`,
  });

  results.push({
    test: 'latency-avg',
    pass: true,
    duration_ms: avg,
    detail: `avg=${avg}ms over 10 runs`,
  });
}

// Test 3: XML file count (fixture should have exactly 1)
{
  const start = Date.now();
  const result = verifyPlanningXmlRefs(fixtureDir);
  const duration = Date.now() - start;

  results.push({
    test: 'xml-file-count',
    pass: result.xmlFileCount === 1,
    duration_ms: duration,
    detail: `found ${result.xmlFileCount} XML files (expected 1)`,
  });
}

const totalDuration = Date.now() - startTime;
const passes = results.filter(r => r.pass).length;
const failures = results.filter(r => !r.pass).length;

// --- Output results ---

console.log('Results:');
for (const r of results) {
  const mark = r.pass ? '✓' : '✗';
  console.log(`  ${mark} ${r.test} (${r.duration_ms}ms) — ${r.detail}`);
}
console.log(`\n${passes}/${results.length} passed, ${failures} failed, ${totalDuration}ms total`);

// --- Write TRACE.json ---

const trace = {
  eval: 'tooling-watch',
  version,
  date: new Date().toISOString().slice(0, 10),
  gad_version: require('../../package.json').version,
  eval_type: 'tooling',
  trace_schema_version: 2,
  scenario: 'watch-verify-fixture',

  timing: {
    started: new Date(startTime).toISOString(),
    ended: new Date().toISOString(),
    duration_ms: totalDuration,
  },

  tooling: {
    invocations: results.length,
    passes,
    failures,
    per_invocation: results.map(r => ({
      command: r.test,
      duration_ms: r.duration_ms,
      pass: r.pass,
    })),
  },

  metrics: {
    p50_ms: results.find(r => r.test === 'latency-p50')?.duration_ms || null,
    p95_ms: results.find(r => r.test === 'latency-p95')?.duration_ms || null,
    error_rate: failures / results.length,
  },

  scores: {
    correctness: passes / results.length,
    latency: 1 - ((results.find(r => r.test === 'latency-p95')?.duration_ms || 0) / 500),
    tooling_composite: null,
  },
};

// Compute tooling composite
trace.scores.tooling_composite = (trace.scores.correctness * 0.60) + (Math.max(0, trace.scores.latency) * 0.40);

fs.writeFileSync(path.join(runDir, 'TRACE.json'), JSON.stringify(trace, null, 2));
console.log(`\nTRACE.json written: ${version}/TRACE.json`);
console.log(`Composite: ${trace.scores.tooling_composite.toFixed(3)}`);

process.exit(failures > 0 ? 1 : 0);
