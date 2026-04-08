/**
 * GAD eval SCORE.md generator (v2).
 *
 * Reads TRACE.json (implementation trace format) and produces a comprehensive
 * SCORE.md with all metrics: timing, tokens, git discipline, planning quality,
 * skill accuracy, requirement coverage, and cross-version comparison.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Trace reader
// ---------------------------------------------------------------------------

function loadTrace(runDir) {
  const p = path.join(runDir, 'TRACE.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function loadRunMd(runDir) {
  const p = path.join(runDir, 'RUN.md');
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, 'utf8');
  const field = (key) => {
    const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : null;
  };
  return { project: field('project'), started: field('started'), ended: field('ended'), status: field('status') };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pct(n) { return n != null && !isNaN(n) ? `${(n * 100).toFixed(1)}%` : '—'; }
function num(n) { return n != null ? String(n) : '—'; }
function dur(n) { return n != null ? `${n} min` : '—'; }
function tok(n) { return n != null ? n.toLocaleString() : '—'; }
function score3(n) { return n != null ? n.toFixed(3) : '—'; }
function delta(a, b) {
  if (a == null || b == null) return '—';
  const d = b - a;
  return (d >= 0 ? '+' : '') + d.toFixed(3);
}

// ---------------------------------------------------------------------------
// SCORE.md generation
// ---------------------------------------------------------------------------

function generateScore(projectDir, version) {
  const runDir = path.join(projectDir, version);
  if (!fs.existsSync(runDir)) throw new Error(`Run directory not found: ${runDir}`);

  const trace = loadTrace(runDir);
  const run = loadRunMd(runDir);
  const projectName = path.basename(projectDir);

  // Find baseline (previous version with a trace)
  const allVersions = fs.readdirSync(projectDir)
    .filter(n => /^v\d+$/.test(n))
    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  let baseTrace = null;
  let baseVersion = null;
  for (const v of allVersions) {
    if (v === version) break;
    const t = loadTrace(path.join(projectDir, v));
    if (t) { baseTrace = t; baseVersion = v; }
  }

  const lines = [];
  lines.push(`# Eval Score — ${projectName} ${version}`);
  lines.push('');

  // -- Run info --
  lines.push('## Run info');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Project | ${projectName} |`);
  lines.push(`| Version | ${version} |`);
  lines.push(`| Date | ${trace?.date || run.started?.split('T')[0] || '—'} |`);
  lines.push(`| GAD version | ${trace?.gad_version || '—'} |`);
  lines.push(`| Eval type | ${trace?.eval_type || '—'} |`);
  lines.push(`| Context mode | ${trace?.context_mode || '—'} |`);
  lines.push(`| Trace source | ${trace?.source || 'agent-reported'} |`);
  lines.push(`| Baseline | ${baseVersion || 'none (first scored run)'} |`);
  lines.push('');

  if (!trace) {
    lines.push('**No TRACE.json found.** Run the eval and write a trace before scoring.');
    lines.push('');
    const scorePath = path.join(runDir, 'SCORE.md');
    fs.writeFileSync(scorePath, lines.join('\n'));
    return scorePath;
  }

  // -- Timing --
  const t = trace.timing || {};
  lines.push('## Timing');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Duration | ${dur(t.duration_minutes)} |`);
  lines.push(`| Phases completed | ${num(t.phases_completed)} |`);
  lines.push(`| Tasks completed | ${num(t.tasks_completed)} |`);
  lines.push('');

  // -- Token usage --
  const tu = trace.token_usage || {};
  lines.push('## Token usage');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total tokens | ${tok(tu.total_tokens)} |`);
  lines.push(`| Tool uses | ${num(tu.tool_uses)} |`);
  if (tu.total_tokens && t.tasks_completed) {
    lines.push(`| Tokens per task | ${tok(Math.round(tu.total_tokens / t.tasks_completed))} |`);
  }
  lines.push('');

  // -- Git discipline --
  const ga = trace.git_analysis || {};
  lines.push('## Git discipline');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total commits | ${num(ga.total_commits)} |`);
  lines.push(`| Task-ID commits | ${num(ga.task_id_commits)} |`);
  lines.push(`| Batch commits | ${num(ga.batch_commits)} |`);
  lines.push(`| Source files created | ${num(ga.source_files_created)} |`);
  lines.push(`| State updates | ${num(ga.state_updates)} |`);
  lines.push(`| Decisions captured | ${num(ga.decisions_added)} |`);
  lines.push(`| **Per-task discipline** | **${score3(ga.per_task_discipline)}** |`);
  lines.push('');

  // -- Planning quality --
  const pq = trace.planning_quality || {};
  lines.push('## Planning quality');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Phases planned | ${num(pq.phases_planned)} |`);
  lines.push(`| Tasks planned | ${num(pq.tasks_planned)} |`);
  lines.push(`| Tasks completed | ${num(pq.tasks_completed)} |`);
  lines.push(`| Tasks blocked | ${num(pq.tasks_blocked)} |`);
  lines.push(`| State stale count | ${num(pq.state_stale_count)} |`);
  lines.push(`| **Planning score** | **${score3(trace.scores?.planning_quality)}** |`);
  lines.push('');

  // -- Requirement coverage --
  const rc = trace.requirement_coverage || {};
  if (rc.total_criteria) {
    lines.push('## Requirement coverage');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total criteria | ${num(rc.total_criteria)} |`);
    lines.push(`| Fully met | ${num(rc.fully_met)} |`);
    lines.push(`| Partially met | ${num(rc.partially_met)} |`);
    lines.push(`| Not met | ${num(rc.not_met)} |`);
    lines.push(`| **Coverage** | **${pct(rc.coverage_ratio)}** |`);
    if (rc.partial_criteria?.length > 0) {
      lines.push(`| Partial criteria | ${rc.partial_criteria.join(', ')} |`);
    }
    lines.push('');
  }

  // -- Skill accuracy --
  const sa = trace.skill_accuracy || {};
  lines.push('## Skill accuracy');
  lines.push('');
  if (sa.expected_triggers?.length > 0) {
    lines.push('| Skill | When | Triggered |');
    lines.push('|-------|------|-----------|');
    for (const et of sa.expected_triggers) {
      const mark = et.triggered ? '✓' : '✗';
      lines.push(`| ${et.skill} | ${et.when} | ${mark} |`);
    }
    lines.push('');
  }
  lines.push(`| **Skill accuracy** | **${pct(sa.accuracy)}** |`);
  lines.push('');

  // -- Architecture alignment --
  const aa = trace.architecture_alignment || {};
  if (aa.total_decisions) {
    lines.push('## Architecture alignment');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Reference decisions | ${num(aa.total_decisions)} |`);
    lines.push(`| Decisions followed | ${num(aa.decisions_followed)} |`);
    lines.push(`| **Alignment** | **${pct(aa.alignment_ratio)}** |`);
    lines.push('');
  }

  // -- Log stats (if from-log trace) --
  const ls = trace.log_stats || {};
  if (ls.total_entries) {
    lines.push('## Call log stats');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total log entries | ${num(ls.total_entries)} |`);
    lines.push(`| GAD CLI calls | ${num(ls.gad_cli_calls)} |`);
    lines.push(`| Tool calls | ${num(ls.tool_calls)} |`);
    lines.push(`| Skill triggers | ${num(ls.skill_triggers)} |`);
    lines.push(`| Agent spawns | ${num(ls.agent_spawns)} |`);
    lines.push(`| Bash calls | ${num(ls.bash_calls)} |`);
    lines.push(`| Read calls | ${num(ls.read_calls)} |`);
    lines.push(`| Write calls | ${num(ls.write_calls)} |`);
    lines.push(`| Edit calls | ${num(ls.edit_calls)} |`);
    lines.push('');
  }

  // -- Composite scores --
  const sc = trace.scores || {};
  lines.push('## Composite scores');
  lines.push('');
  lines.push('| Dimension | Weight | Score |');
  lines.push('|-----------|--------|-------|');
  if (sc.requirement_coverage != null) lines.push(`| Requirement coverage | 0.40 | ${score3(sc.requirement_coverage)} |`);
  lines.push(`| Planning quality | 0.30 | ${score3(sc.planning_quality)} |`);
  lines.push(`| Per-task discipline | 0.25 | ${score3(sc.per_task_discipline)} |`);
  lines.push(`| Skill accuracy | 0.25 | ${score3(sc.skill_accuracy)} |`);
  lines.push(`| Time efficiency | 0.20 | ${score3(sc.time_efficiency)} |`);
  if (sc.architecture_alignment != null) lines.push(`| Architecture alignment | — | ${score3(sc.architecture_alignment)} |`);
  lines.push('');
  lines.push(`### **Composite: ${score3(sc.composite)}**`);
  lines.push('');

  // -- Cross-version comparison --
  if (baseTrace) {
    const bs = baseTrace.scores || {};
    const bg = baseTrace.git_analysis || {};
    const bt = baseTrace.timing || {};
    const btu = baseTrace.token_usage || {};

    lines.push(`## vs Baseline (${baseVersion})`);
    lines.push('');
    lines.push('| Metric | ' + baseVersion + ' | ' + version + ' | Delta |');
    lines.push('|--------|------|------|-------|');
    lines.push(`| Composite | ${score3(bs.composite)} | ${score3(sc.composite)} | ${delta(bs.composite, sc.composite)} |`);
    lines.push(`| Discipline | ${score3(bg.per_task_discipline)} | ${score3(ga.per_task_discipline)} | ${delta(bg.per_task_discipline, ga.per_task_discipline)} |`);
    lines.push(`| Planning | ${score3(bs.planning_quality)} | ${score3(sc.planning_quality)} | ${delta(bs.planning_quality, sc.planning_quality)} |`);
    lines.push(`| Skill accuracy | ${pct(bs.skill_accuracy)} | ${pct(sc.skill_accuracy)} | ${delta(bs.skill_accuracy, sc.skill_accuracy)} |`);
    lines.push(`| Duration | ${dur(bt.duration_minutes)} | ${dur(t.duration_minutes)} | ${delta(bt.duration_minutes, t.duration_minutes)} min |`);
    lines.push(`| Tokens | ${tok(btu.total_tokens)} | ${tok(tu.total_tokens)} | ${delta(btu.total_tokens, tu.total_tokens)} |`);
    lines.push(`| Tasks | ${num(baseTrace.planning_quality?.tasks_completed)} | ${num(pq.tasks_completed)} | — |`);
    lines.push('');
  }

  // -- Notes --
  if (trace.notes) {
    lines.push('## Notes');
    lines.push('');
    lines.push(trace.notes);
    lines.push('');
  }

  const scorePath = path.join(runDir, 'SCORE.md');
  fs.writeFileSync(scorePath, lines.join('\n'));

  // Write machine-readable scores.json alongside SCORE.md
  const scoresJson = {
    eval: projectName,
    version,
    eval_type: trace.eval_type || 'implementation',
    trace_schema_version: trace.trace_schema_version || 2,
    composite: sc.composite || null,
    dimensions: {},
  };
  if (sc.requirement_coverage != null) scoresJson.dimensions.requirement_coverage = sc.requirement_coverage;
  if (sc.planning_quality != null) scoresJson.dimensions.planning_quality = sc.planning_quality;
  if (sc.per_task_discipline != null) scoresJson.dimensions.per_task_discipline = sc.per_task_discipline;
  if (sc.skill_accuracy != null) scoresJson.dimensions.skill_accuracy = sc.skill_accuracy;
  if (sc.time_efficiency != null) scoresJson.dimensions.time_efficiency = sc.time_efficiency;
  if (sc.architecture_alignment != null) scoresJson.dimensions.architecture_alignment = sc.architecture_alignment;
  // Tooling-specific
  if (sc.correctness != null) scoresJson.dimensions.correctness = sc.correctness;
  if (sc.latency != null) scoresJson.dimensions.latency = sc.latency;
  if (sc.tooling_composite != null) scoresJson.dimensions.tooling_composite = sc.tooling_composite;
  if (sc.mcp_composite != null) scoresJson.dimensions.mcp_composite = sc.mcp_composite;

  const scoresJsonPath = path.join(runDir, 'scores.json');
  fs.writeFileSync(scoresJsonPath, JSON.stringify(scoresJson, null, 2));

  return scorePath;
}

/**
 * Diff two versions by comparing their TRACE.json scores.
 */
function diffVersions(projectDir, v1, v2) {
  const t1 = loadTrace(path.join(projectDir, v1));
  const t2 = loadTrace(path.join(projectDir, v2));

  const lines = [
    `# Eval Diff — ${path.basename(projectDir)} ${v1} vs ${v2}`,
    '',
    '| Metric | ' + v1 + ' | ' + v2 + ' | Delta |',
    '|--------|------|------|-------|',
  ];

  if (!t1 || !t2) {
    lines.push('| (no trace data) | — | — | — |');
    return lines.join('\n') + '\n';
  }

  const s1 = t1.scores || {};
  const s2 = t2.scores || {};
  const g1 = t1.git_analysis || {};
  const g2 = t2.git_analysis || {};
  const tm1 = t1.timing || {};
  const tm2 = t2.timing || {};
  const tu1 = t1.token_usage || {};
  const tu2 = t2.token_usage || {};

  lines.push(`| Composite | ${score3(s1.composite)} | ${score3(s2.composite)} | ${delta(s1.composite, s2.composite)} |`);
  lines.push(`| Discipline | ${score3(g1.per_task_discipline)} | ${score3(g2.per_task_discipline)} | ${delta(g1.per_task_discipline, g2.per_task_discipline)} |`);
  lines.push(`| Planning | ${score3(s1.planning_quality)} | ${score3(s2.planning_quality)} | ${delta(s1.planning_quality, s2.planning_quality)} |`);
  lines.push(`| Skill accuracy | ${pct(s1.skill_accuracy)} | ${pct(s2.skill_accuracy)} | ${delta(s1.skill_accuracy, s2.skill_accuracy)} |`);
  lines.push(`| Duration | ${dur(tm1.duration_minutes)} | ${dur(tm2.duration_minutes)} | ${delta(tm1.duration_minutes, tm2.duration_minutes)} min |`);
  lines.push(`| Tokens | ${tok(tu1.total_tokens)} | ${tok(tu2.total_tokens)} | ${delta(tu1.total_tokens, tu2.total_tokens)} |`);
  lines.push(`| Tasks | ${num(t1.planning_quality?.tasks_completed)} | ${num(t2.planning_quality?.tasks_completed)} | — |`);

  return lines.join('\n') + '\n';
}

function parseRunMd(runDir) { return loadRunMd(runDir); }
function computeDrift() { return {}; }

module.exports = { generateScore, diffVersions, parseRunMd, computeDrift };
