'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { loadTrace } = require('../../../lib/eval-trace-core.cjs');

function createEvalTraceWriteCommand({ listEvalProjectsHint, resolveOrDefaultEvalProjectDir, outputError }) {
  return defineCommand({
    meta: { name: 'write', description: 'Record a TRACE.json for an eval run' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      version: { type: 'string', description: 'Run version (default: latest)', default: '' },
      workflow: { type: 'string', description: 'Workflow: A, B, or both', default: 'A' },
      completeness: { type: 'string', description: 'Completeness score (0-1)', default: '' },
      tokens: { type: 'string', description: 'Total tokens consumed', default: '' },
      units: { type: 'string', description: 'Unit fidelity JSON e.g. {"U1":"Full","U6":"Truncated"}', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .map((r) => r.name)
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
      if (runs.length === 0) { outputError(`No runs found for '${args.project}'.`); return; }

      const version = args.version || runs[runs.length - 1];
      if (!runs.includes(version)) { outputError(`Version '${version}' not found.`); return; }

      let unitCoverage = {};
      if (args.units) {
        try { unitCoverage = JSON.parse(args.units); }
        catch { outputError('--units must be valid JSON: {"U1":"Full","U6":"Truncated",...}'); return; }
      }

      const entries = Object.entries(unitCoverage);
      const unitsFull = entries.filter(([, v]) => v === 'Full' || v === 'Referenced').length;
      const unitsPartial = entries.filter(([, v]) => v === 'Truncated' || v === 'Approximated').length;
      const unitsAbsent = entries.filter(([, v]) => v === 'Absent').length;
      const completeness = args.completeness ? parseFloat(args.completeness)
        : entries.length > 0 ? (unitsFull + 0.5 * unitsPartial) / entries.length : null;
      const tokens = args.tokens ? parseInt(args.tokens, 10) : null;

      const traceFile = path.join(projDir, version, 'TRACE.json');
      const existing = loadTrace(projDir, version) || {};

      const trace = {
        ...existing,
        version,
        project: args.project,
        workflow: args.workflow,
        methodology_version: '1.0.0',
        recorded: existing.recorded || new Date().toISOString(),
        updated: new Date().toISOString(),
        unit_coverage: { ...(existing.unit_coverage || {}), ...unitCoverage },
        totals: {
          ...(existing.totals || {}),
          ...(tokens != null ? { tokens } : {}),
          units_full: unitsFull,
          units_partial: unitsPartial,
          units_absent: unitsAbsent,
          completeness,
        },
      };

      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
      console.log(`\nTRACE.json written: evals/${args.project}/${version}/TRACE.json`);
      console.log(`  workflow=${trace.workflow}  completeness=${completeness?.toFixed(3) ?? '-'}  tokens=${tokens ?? '-'}`);
      console.log(`\nView:  gad eval trace show --project ${args.project} --version ${version}`);
    },
  });
}

function createEvalTraceInitCommand({
  listEvalProjectsHint,
  resolveOrDefaultEvalProjectDir,
  outputError,
  detectRuntimeIdentity,
  summarizeAgentLineage,
  pkg,
}) {
  return defineCommand({
    meta: { name: 'init', description: 'Initialize a TRACE.json for an implementation eval run' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      mode: { type: 'string', description: 'Context mode: fresh or loaded', default: 'fresh' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .map((r) => parseInt(r.name.slice(1)))
        .sort((a, b) => a - b);
      const nextVersion = runs.length > 0 ? runs[runs.length - 1] + 1 : 1;
      const versionDir = path.join(projDir, `v${nextVersion}`);
      fs.mkdirSync(versionDir, { recursive: true });

      const { getFrameworkVersion } = require('../../../lib/framework-version.cjs');
      const fv = getFrameworkVersion();
      const runtimeIdentity = detectRuntimeIdentity();

      const trace = {
        eval: args.project,
        version: `v${nextVersion}`,
        date: new Date().toISOString().split('T')[0],
        gad_version: pkg.version || '1.0.0',
        framework_version: fv.version,
        framework_commit: fv.commit,
        framework_branch: fv.branch,
        framework_commit_ts: fv.commit_ts,
        framework_stamp: fv.stamp,
        trace_schema_version: 4,
        runtime_identity: runtimeIdentity,
        agent_lineage: summarizeAgentLineage({ runtimeIdentity }),
        eval_type: 'implementation',
        context_mode: args.mode,
        timing: {
          started: new Date().toISOString(),
          ended: null,
          duration_minutes: null,
          phases_completed: 0,
          tasks_completed: 0,
        },
        gad_commands: [],
        skill_triggers: [],
        planning_quality: {
          phases_planned: 0,
          tasks_planned: 0,
          tasks_completed: 0,
          tasks_blocked: 0,
          decisions_captured: 0,
          state_updates: 0,
          state_stale_count: 0,
        },
        cli_efficiency: {
          total_gad_commands: 0,
          total_gad_tokens: 0,
          manual_file_reads: 0,
          manual_file_tokens: 0,
          token_reduction_vs_manual: null,
        },
        skill_accuracy: { expected_triggers: [], accuracy: null },
        scores: {
          cli_efficiency: null,
          skill_accuracy: null,
          planning_quality: null,
          time_efficiency: null,
          composite: null,
        },
        human_review: { score: null, notes: null, reviewed_by: null, reviewed_at: null },
      };

      const traceFile = path.join(versionDir, 'TRACE.json');
      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
      console.log(`\nImplementation trace initialized: evals/${args.project}/v${nextVersion}/TRACE.json`);
      console.log(`  context_mode=${args.mode}  started=${trace.timing.started}`);
      console.log(`\nLog commands:  gad eval trace log-cmd --project ${args.project} --cmd "gad snapshot"`);
      console.log(`Log skills:    gad eval trace log-skill --project ${args.project} --skill "/gad:plan-phase" --phase 01`);
      console.log(`Finalize:      gad eval trace finalize --project ${args.project}`);
    },
  });
}

function latestTraceFile(projectDir, outputError) {
  const runs = fs.readdirSync(projectDir, { withFileTypes: true })
    .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
    .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
  if (runs.length === 0) {
    outputError('No runs found. Run gad eval trace init first.');
    return null;
  }
  return {
    run: runs[0].name,
    traceFile: path.join(projectDir, runs[0].name, 'TRACE.json'),
  };
}

function createEvalTraceLogCmdCommand({ resolveOrDefaultEvalProjectDir, outputError }) {
  return defineCommand({
    meta: { name: 'log-cmd', description: 'Log a gad command to the active implementation trace' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      cmd: { type: 'string', description: 'Command that was run', default: '' },
      tokens: { type: 'string', description: 'Token count of output', default: '0' },
    },
    run({ args }) {
      if (!args.project || !args.cmd) { outputError('Usage: gad eval trace log-cmd --project <name> --cmd "<command>" [--tokens N]'); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      const latest = latestTraceFile(projDir, outputError);
      if (!latest) return;
      const trace = JSON.parse(fs.readFileSync(latest.traceFile, 'utf8'));
      trace.gad_commands.push({ cmd: args.cmd, at: new Date().toISOString(), tokens: parseInt(args.tokens) || 0 });
      trace.cli_efficiency.total_gad_commands = trace.gad_commands.length;
      trace.cli_efficiency.total_gad_tokens = trace.gad_commands.reduce((s, c) => s + (c.tokens || 0), 0);
      fs.writeFileSync(latest.traceFile, JSON.stringify(trace, null, 2));
    },
  });
}

function createEvalTraceLogSkillCommand({ resolveOrDefaultEvalProjectDir, outputError }) {
  return defineCommand({
    meta: { name: 'log-skill', description: 'Log a skill trigger to the active implementation trace' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      skill: { type: 'string', description: 'Skill name (e.g. /gad:plan-phase)', default: '' },
      phase: { type: 'string', description: 'Phase number', default: '' },
      result: { type: 'string', description: 'Result summary', default: '' },
    },
    run({ args }) {
      if (!args.project || !args.skill) { outputError('Usage: gad eval trace log-skill --project <name> --skill "<skill>" [--phase N] [--result "..."]'); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      const latest = latestTraceFile(projDir, outputError);
      if (!latest) return;
      const trace = JSON.parse(fs.readFileSync(latest.traceFile, 'utf8'));
      trace.skill_triggers.push({
        skill: args.skill,
        phase: args.phase || '',
        at: new Date().toISOString(),
        result: args.result || '',
      });
      fs.writeFileSync(latest.traceFile, JSON.stringify(trace, null, 2));
    },
  });
}

function createEvalTraceFinalizeCommand({ listEvalProjectsHint, resolveOrDefaultEvalProjectDir, outputError }) {
  return defineCommand({
    meta: { name: 'finalize', description: 'Finalize an implementation trace - compute scores' },
    args: { project: { type: 'string', description: 'Eval project name', default: '' } },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      const latest = latestTraceFile(projDir, outputError);
      if (!latest) return;
      const trace = JSON.parse(fs.readFileSync(latest.traceFile, 'utf8'));

      trace.timing.ended = new Date().toISOString();
      const startMs = new Date(trace.timing.started).getTime();
      const endMs = new Date(trace.timing.ended).getTime();
      trace.timing.duration_minutes = Math.round((endMs - startMs) / 60000);

      const totalTokens = trace.cli_efficiency.total_gad_tokens + trace.cli_efficiency.manual_file_tokens;
      if (totalTokens > 0) {
        trace.cli_efficiency.token_reduction_vs_manual = 1 - (trace.cli_efficiency.total_gad_tokens / totalTokens);
        trace.scores.cli_efficiency = trace.cli_efficiency.token_reduction_vs_manual;
      }

      const expected = trace.skill_accuracy.expected_triggers;
      if (expected.length > 0) {
        const correct = expected.filter((e) => e.triggered).length;
        trace.skill_accuracy.accuracy = correct / expected.length;
        trace.scores.skill_accuracy = trace.skill_accuracy.accuracy;
      }

      const pq = trace.planning_quality;
      if (pq.tasks_planned > 0) {
        const taskRatio = pq.tasks_completed / pq.tasks_planned;
        const stalePenalty = pq.state_updates > 0 ? (1 - pq.state_stale_count / pq.state_updates) : 1;
        trace.scores.planning_quality = taskRatio * stalePenalty;
      }

      const expectedDuration = 480;
      if (trace.timing.duration_minutes != null) {
        trace.scores.time_efficiency = Math.max(0, Math.min(1, 1 - (trace.timing.duration_minutes / expectedDuration)));
      }

      const s = trace.scores;
      const hr = trace.human_review?.score ?? null;
      s.human_review = hr;
      if (s.requirement_coverage != null && s.planning_quality != null && s.per_task_discipline != null && s.skill_accuracy != null && s.time_efficiency != null) {
        if (hr != null) {
          s.composite = (s.requirement_coverage * 0.15) + (s.planning_quality * 0.15) + (s.per_task_discipline * 0.15) + (s.skill_accuracy * 0.10) + (s.time_efficiency * 0.05) + (hr * 0.30);
          if (hr < 0.10) s.composite = Math.min(s.composite, 0.25);
          else if (hr < 0.20) s.composite = Math.min(s.composite, 0.40);
          s.auto_composite = null;
        } else {
          s.auto_composite = (s.requirement_coverage * 0.25) + (s.planning_quality * 0.25) + (s.per_task_discipline * 0.25) + (s.skill_accuracy * 0.167) + (s.time_efficiency * 0.083);
          s.composite = s.auto_composite;
        }
      }

      trace.trace_schema_version = 3;
      fs.writeFileSync(latest.traceFile, JSON.stringify(trace, null, 2));
      console.log(`\nTrace finalized: evals/${args.project}/${latest.run}/TRACE.json`);
      console.log(`\n  Duration:          ${trace.timing.duration_minutes} min`);
      console.log(`  Phases completed:  ${trace.timing.phases_completed}`);
      console.log(`  Tasks completed:   ${trace.timing.tasks_completed}`);
      console.log(`  Req coverage:      ${s.requirement_coverage?.toFixed(3) ?? '-'}`);
      console.log(`  Planning quality:  ${s.planning_quality?.toFixed(3) ?? '-'}`);
      console.log(`  Task discipline:   ${s.per_task_discipline?.toFixed(3) ?? '-'}`);
      console.log(`  Skill accuracy:    ${s.skill_accuracy?.toFixed(3) ?? '-'}`);
      console.log(`  Time efficiency:   ${s.time_efficiency?.toFixed(3) ?? '-'}`);
      console.log(`  Human review:      ${hr?.toFixed(3) ?? '(pending)'}`);
      console.log(`  Composite:         ${s.composite?.toFixed(3) ?? '-'}${hr == null ? ' (auto)' : ''}`);
    },
  });
}

module.exports = {
  createEvalTraceWriteCommand,
  createEvalTraceInitCommand,
  createEvalTraceLogCmdCommand,
  createEvalTraceLogSkillCommand,
  createEvalTraceFinalizeCommand,
};
