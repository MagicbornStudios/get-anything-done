/**
 * GAD eval SCORE.md generator.
 *
 * Reads a versioned run directory and produces a structured SCORE.md
 * with primary metrics, drift scores vs baseline, and document drift summary.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseTrace, detectDocDrift, summarizeTrace } = require('./trace-writer.cjs');

// ---------------------------------------------------------------------------
// RUN.md reader
// ---------------------------------------------------------------------------

function parseRunMd(runDir) {
  const p = path.join(runDir, 'RUN.md');
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, 'utf8');
  const field = (key) => {
    const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : null;
  };
  return {
    project: field('project'),
    baseline: field('baseline'),
    started: field('started'),
    ended: field('ended'),
    status: field('status'),
    gadVersion: field('gad_version'),
    editCount: parseInt(field('edit_count') || '0', 10),
    skillCalls: parseInt(field('skill_calls') || '0', 10),
    totalTokens: parseInt(field('total_tokens') || '0', 10),
    taskCount: parseInt(field('task_count') || '0', 10),
    requirementCoverage: parseFloat(field('requirement_coverage') || '0'),
  };
}

// ---------------------------------------------------------------------------
// Drift calculation
// ---------------------------------------------------------------------------

function pct(n) {
  return n !== null && !isNaN(n) ? `${(n * 100).toFixed(1)}%` : 'n/a';
}

function signedPct(delta) {
  if (delta === null || isNaN(delta)) return 'n/a';
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${(delta * 100).toFixed(1)}%`;
}

/**
 * Compute drift between baseline run and current run.
 * Returns object with drift metrics.
 */
function computeDrift(baseline, current) {
  const safe = (b, c) => {
    if (!b || !c) return null;
    return (c - b) / (b || 1);
  };

  return {
    // positive = improved (coverage went up)
    drift_success: safe(baseline.requirementCoverage, current.requirementCoverage),
    // positive = regressed (counts went up)
    drift_edits: safe(baseline.editCount, current.editCount),
    drift_tokens: safe(baseline.totalTokens, current.totalTokens),
    drift_skills: safe(baseline.skillCalls, current.skillCalls),
    drift_tasks: safe(baseline.taskCount, current.taskCount),
  };
}

/**
 * Composite stability index: weighted average of per-metric improvements.
 * Higher = more stable / better.
 */
function compositeIndex(drift) {
  const weights = {
    drift_success: 0.40,
    drift_edits: 0.20,
    drift_tokens: 0.15,
    drift_skills: 0.15,
    drift_tasks: 0.10,
  };

  let total = 0;
  let w = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const v = drift[key];
    if (v === null || isNaN(v)) continue;
    // Convert: negative drift on efficiency metrics is good; positive on success is good.
    const score = key === 'drift_success' ? Math.max(0, 1 + v) : Math.max(0, 1 - Math.abs(v));
    total += score * weight;
    w += weight;
  }

  return w > 0 ? total / w : null;
}

// ---------------------------------------------------------------------------
// SCORE.md generation
// ---------------------------------------------------------------------------

/**
 * Generate SCORE.md for a single run.
 *
 * @param {string} projectDir  e.g. vendor/get-anything-done/evals/portfolio-bare
 * @param {string} version     e.g. 'v2'
 * @returns {string}  path to written SCORE.md
 */
function generateScore(projectDir, version) {
  const runDir = path.join(projectDir, version);
  if (!fs.existsSync(runDir)) {
    throw new Error(`Run directory not found: ${runDir}`);
  }

  const current = parseRunMd(runDir);
  const tracePath = path.join(runDir, 'GAD-TRACE.log');
  const traceEvents = parseTrace(tracePath);
  const traceCounts = summarizeTrace(traceEvents);
  const docDrift = detectDocDrift(runDir);

  // Find baseline (v1 or designated)
  const allVersions = fs.readdirSync(projectDir)
    .filter(n => /^v\d+$/.test(n))
    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  const baselineVersion = allVersions[0] || null;
  let baseline = null;
  let drift = { drift_success: null, drift_edits: null, drift_tokens: null, drift_skills: null, drift_tasks: null };

  if (baselineVersion && baselineVersion !== version) {
    baseline = parseRunMd(path.join(projectDir, baselineVersion));
    drift = computeDrift(baseline, current);
  }

  const ci = compositeIndex(drift);

  // Format
  const projectName = path.basename(projectDir);
  const lines = [
    `# Eval Score — ${projectName} ${version}`,
    '',
    '## Run info',
    `- Date: ${(current.started || '').split('T')[0] || 'unknown'}`,
    `- GAD version: ${current.gadVersion || 'unknown'}`,
    `- Baseline: ${baselineVersion || 'n/a (first run)'}`,
    `- Status: ${current.status || 'unknown'}`,
    '',
    '## Primary scores',
    '',
    '| Metric | ' + (baseline ? `Baseline (${baselineVersion}) | ` : '') + `This run (${version}) | Delta |`,
    '|--------|' + (baseline ? '--------------|' : '') + '---------------|-------|',
  ];

  const metrics = [
    ['Requirement coverage', 'requirementCoverage', pct, true],
    ['Edit count', 'editCount', v => String(v || 0), false],
    ['Skill calls', 'skillCalls', v => String(v || 0), false],
    ['Total tokens', 'totalTokens', v => String((v || 0).toLocaleString()), false],
    ['Task count', 'taskCount', v => String(v || 0), false],
  ];

  for (const [label, key, fmt, isGood] of metrics) {
    const cur = current[key];
    const bas = baseline?.[key];
    const delta = drift[`drift_${key.replace('Count', '').replace(/[A-Z]/g, l => '_' + l.toLowerCase()).replace(/^_/, '')}`];
    const deltaStr = delta !== null && !isNaN(delta) ? signedPct(isGood ? -delta : delta) : '—';
    if (baseline) {
      lines.push(`| ${label} | ${fmt(bas)} | ${fmt(cur)} | ${deltaStr} |`);
    } else {
      lines.push(`| ${label} | ${fmt(cur)} | — |`);
    }
  }

  lines.push('', '## Drift scores', '');

  if (!baseline) {
    lines.push('_No baseline available — this is the first run. It will serve as baseline for future runs._');
  } else {
    lines.push('| Metric | Score | Status |');
    lines.push('|--------|-------|--------|');
    const driftRows = [
      ['drift_success', 'Requirement coverage', true],
      ['drift_edits', 'Edit efficiency', false],
      ['drift_tokens', 'Token efficiency', false],
      ['drift_skills', 'Skill efficiency', false],
      ['drift_tasks', 'Task alignment', false],
    ];
    for (const [key, label, higherIsBetter] of driftRows) {
      const v = drift[key];
      if (v === null || isNaN(v)) {
        lines.push(`| ${label} | n/a | — |`);
        continue;
      }
      const improved = higherIsBetter ? v > 0 : v < 0;
      const stable = Math.abs(v) < 0.05;
      const icon = improved ? '✓ improved' : stable ? '✓ stable' : '⚠ regressed';
      lines.push(`| ${label} | ${signedPct(v)} | ${icon} |`);
    }
  }

  lines.push('', '## Document drift', '');
  if (docDrift.length === 0) {
    lines.push('No document drift detected. All files match standard artifact set.');
  } else {
    for (const { file, reason } of docDrift) {
      lines.push(`- \`DETECTED: ${file}\` — ${reason}`);
    }
  }

  lines.push('', '## Trace summary', '');
  if (traceEvents.length === 0) {
    lines.push('No TRACE events recorded (run without --trace or trace log missing).');
  } else {
    lines.push(`Total events: ${traceEvents.length}`);
    lines.push('');
    lines.push('| Event type | Count |');
    lines.push('|------------|-------|');
    for (const [type, count] of Object.entries(traceCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${type} | ${count} |`);
    }
  }

  if (ci !== null) {
    lines.push('', `## Composite stability index: ${ci.toFixed(2)}`);
  }

  lines.push('', '## Trace', ``, `See: [GAD-TRACE.log](./GAD-TRACE.log)`, '');

  const scoreContent = lines.join('\n');
  const scorePath = path.join(runDir, 'SCORE.md');
  fs.writeFileSync(scorePath, scoreContent);
  return scorePath;
}

/**
 * Diff two SCORE.md files by comparing their parsed RUN.md metrics.
 */
function diffVersions(projectDir, v1, v2) {
  const run1 = parseRunMd(path.join(projectDir, v1));
  const run2 = parseRunMd(path.join(projectDir, v2));

  const lines = [
    `# Eval Diff — ${path.basename(projectDir)} ${v1} vs ${v2}`,
    '',
    '| Metric | ' + v1 + ' | ' + v2 + ' | Delta |',
    '|--------|------|------|-------|',
  ];

  const metrics = [
    ['Requirement coverage', 'requirementCoverage', pct],
    ['Edit count', 'editCount', v => String(v || 0)],
    ['Skill calls', 'skillCalls', v => String(v || 0)],
    ['Total tokens', 'totalTokens', v => String((v || 0).toLocaleString())],
    ['Task count', 'taskCount', v => String(v || 0)],
  ];

  for (const [label, key, fmt] of metrics) {
    const a = run1[key];
    const b = run2[key];
    const delta = (a && b) ? signedPct((b - a) / (a || 1)) : '—';
    lines.push(`| ${label} | ${fmt(a)} | ${fmt(b)} | ${delta} |`);
  }

  return lines.join('\n') + '\n';
}

module.exports = { generateScore, diffVersions, parseRunMd, computeDrift };
