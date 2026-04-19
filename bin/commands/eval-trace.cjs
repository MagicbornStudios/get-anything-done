'use strict';
/**
 * `gad eval trace …` subcommand family.
 * Subcommands: list, show, diff, report, write, init, log-cmd, log-skill,
 *   finalize, reconstruct, from-log
 *
 * Required deps: listAllEvalProjects, listEvalProjectsHint,
 *   resolveOrDefaultEvalProjectDir, outputError, output, shouldUseJson,
 *   summarizeAgentLineage, detectRuntimeIdentity, readXmlFile, findRepoRoot,
 *   pkg.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvalTraceCommand(deps) {
  const {
    listAllEvalProjects,
    listEvalProjectsHint,
    resolveOrDefaultEvalProjectDir,
    outputError,
    output,
    shouldUseJson,
    summarizeAgentLineage,
    detectRuntimeIdentity,
    readXmlFile,
    findRepoRoot,
    pkg,
  } = deps;

  const FIDELITY_SCORE = { Full: 1.0, Referenced: 1.0, Truncated: 0.5, Approximated: 0.5, Absent: 0 };
  const ALL_UNITS = ['U1','U2','U3','U4','U5','U6','U7','U8','U9','U10','U11','U12'];

  const UNIT_LABELS = {
    U1: 'Current phase ID', U2: 'Milestone / plan name', U3: 'Project status',
    U4: 'Open task count', U5: 'Next action (full text)', U6: 'In-progress task IDs + goals',
    U7: 'Phase history', U8: 'Last activity date', U9: 'Active session ID + phase',
    U10: 'Files to read (refs)', U11: 'Agent loop steps', U12: 'Build / verify commands',
  };

  function loadTrace(projectDir, version) {
    const traceFile = path.join(projectDir, version, 'TRACE.json');
    if (!fs.existsSync(traceFile)) return null;
    try { return JSON.parse(fs.readFileSync(traceFile, 'utf8')); } catch { return null; }
  }

  function computeCompleteness(unitCoverage) {
    const units = Object.entries(unitCoverage);
    if (units.length === 0) return null;
    const full = units.filter(([, v]) => v === 'Full' || v === 'Referenced').length;
    const partial = units.filter(([, v]) => v === 'Truncated' || v === 'Approximated').length;
    return (full + 0.5 * partial) / units.length;
  }

  const evalTraceList = defineCommand({
    meta: { name: 'list', description: 'List eval runs that have a TRACE.json' },
    args: { project: { type: 'string', description: 'Eval project name (default: all)', default: '' } },
    run({ args }) {
      let allProjects;
      try { allProjects = listAllEvalProjects(); }
      catch (err) { outputError(err.message); return; }
      if (allProjects.length === 0) { console.log('No eval projects found.'); return; }

      const selected = args.project ? allProjects.filter((p) => p.name === args.project) : allProjects;

      const rows = [];
      for (const { name: proj, projectDir: projDir } of selected) {
        if (!fs.existsSync(projDir)) continue;
        const runs = fs.readdirSync(projDir, { withFileTypes: true })
          .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
          .map((r) => r.name)
          .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        for (const v of runs) {
          const trace = loadTrace(projDir, v);
          if (!trace) { rows.push({ project: proj, version: v, workflow: '—', completeness: '—', tokens: '—', traced: 'no' }); continue; }
          const completeness = trace.totals?.completeness ?? computeCompleteness(trace.unit_coverage ?? {});
          rows.push({
            project: proj, version: v,
            workflow: trace.workflow || '—',
            completeness: completeness != null ? completeness.toFixed(3) : '—',
            tokens: trace.totals?.tokens ?? '—',
            traced: 'yes',
          });
        }
      }

      output(rows, { title: 'Eval Traces' });
      const traced = rows.filter((r) => r.traced === 'yes').length;
      console.log(`\n${traced}/${rows.length} run(s) have traces.  Missing: run \`gad eval trace write\` after each run.`);
    },
  });

  const evalTraceShow = defineCommand({
    meta: { name: 'show', description: 'Show TRACE.json for an eval run' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      version: { type: 'string', description: 'Version (default: latest)', default: '' },
      json: { type: 'boolean', description: 'Raw JSON output', default: false },
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
      if (!runs.includes(version)) { outputError(`Version '${version}' not found. Available: ${runs.join(', ')}`); return; }

      const trace = loadTrace(projDir, version);
      if (!trace) {
        console.log(`No TRACE.json for ${args.project} ${version}.`);
        console.log(`Write one with: gad eval trace write --project ${args.project} --version ${version}`);
        return;
      }

      if (args.json || shouldUseJson()) { console.log(JSON.stringify(trace, null, 2)); return; }

      console.log(`\nTrace: ${args.project}  ${version}  (workflow ${trace.workflow || '?'})`);
      console.log(`Recorded: ${trace.recorded || '—'}  Method version: ${trace.methodology_version || '—'}\n`);

      console.log(`Unit Coverage\n${'─'.repeat(60)}`);
      const cov = trace.unit_coverage || {};
      const unitRows = ALL_UNITS.filter((u) => cov[u] || trace.commands?.some((c) => c.units?.[u])).map((u) => ({
        unit: u, description: UNIT_LABELS[u] || '?', fidelity: cov[u] || '—',
        score: cov[u] ? FIDELITY_SCORE[cov[u]] ?? '?' : '—',
      }));
      if (unitRows.length > 0) output(unitRows, {});

      if (trace.commands?.length > 0) {
        console.log(`\nCommands / Reads  (${trace.commands.length} total)\n${'─'.repeat(60)}`);
        for (const c of trace.commands) {
          const label = c.type === 'cli' ? `CLI  ${c.cmd}` : `FILE ${c.path}`;
          const units = c.units ? `  [${Object.keys(c.units).join(', ')}]` : '';
          console.log(`  ${c.seq}. ${label}  ${c.tokens ?? '?'}tok${units}`);
        }
      }

      if (trace.totals) {
        const t = trace.totals;
        const c = t.completeness != null ? t.completeness.toFixed(3) : computeCompleteness(cov)?.toFixed(3) ?? '—';
        console.log(`\nTotals: ${t.chars ?? '—'} chars / ${t.tokens ?? '—'} tokens`);
        console.log(`  full=${t.units_full ?? '—'}  partial=${t.units_partial ?? '—'}  absent=${t.units_absent ?? '—'}  completeness=${c}`);
      }
      console.log('');
    },
  });

  const evalTraceDiff = defineCommand({
    meta: { name: 'diff', description: 'Diff unit coverage between two traced runs' },
    args: {
      v1: { type: 'positional', description: 'First version (e.g. v2)', required: false },
      v2: { type: 'positional', description: 'Second version (e.g. v3)', required: false },
      project: { type: 'string', description: 'Eval project name', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      if (!args.v1 || !args.v2) {
        console.error(`\nUsage: gad eval trace diff v1 v2 --project ${args.project || '<name>'}\n`);
        process.exit(1);
      }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const t1 = loadTrace(projDir, args.v1);
      const t2 = loadTrace(projDir, args.v2);
      if (!t1) { console.error(`No TRACE.json for ${args.v1}.`); process.exit(1); }
      if (!t2) { console.error(`No TRACE.json for ${args.v2}.`); process.exit(1); }

      const cov1 = t1.unit_coverage || {};
      const cov2 = t2.unit_coverage || {};
      const allUnits = [...new Set([...Object.keys(cov1), ...Object.keys(cov2)])].sort();

      const rows = allUnits.map((u) => {
        const f1 = cov1[u] || 'Absent';
        const f2 = cov2[u] || 'Absent';
        const s1 = FIDELITY_SCORE[f1] ?? 0;
        const s2 = FIDELITY_SCORE[f2] ?? 0;
        const change = s2 > s1 ? '↑' : s2 < s1 ? '↓' : '=';
        return { unit: u, [args.v1]: f1, [args.v2]: f2, change };
      });

      console.log(`\nTrace diff: ${args.project}  ${args.v1} → ${args.v2}\n`);
      output(rows, {});

      const c1 = computeCompleteness(cov1);
      const c2 = computeCompleteness(cov2);
      const tok1 = t1.totals?.tokens ?? '—';
      const tok2 = t2.totals?.tokens ?? '—';
      console.log(`\nCompleteness: ${c1?.toFixed(3) ?? '—'} → ${c2?.toFixed(3) ?? '—'}`);
      console.log(`Tokens:       ${tok1} → ${tok2}`);

      const improved = rows.filter((r) => r.change === '↑').length;
      const regressed = rows.filter((r) => r.change === '↓').length;
      console.log(`Units improved: ${improved}  regressed: ${regressed}`);
      console.log('');
    },
  });

  const evalTraceReport = defineCommand({
    meta: { name: 'report', description: 'Aggregate trace stats across all runs for a project' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .map((r) => r.name)
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

      const traced = runs.map((v) => ({ v, trace: loadTrace(projDir, v) })).filter((r) => r.trace);
      if (traced.length === 0) {
        console.log(`No traces found for '${args.project}'. Run \`gad eval trace write\` after each eval run.`);
        return;
      }

      const unitTrend = {};
      for (const u of ALL_UNITS) {
        unitTrend[u] = traced.map(({ v, trace }) => ({
          v, fidelity: trace.unit_coverage?.[u] || 'Absent',
          score: FIDELITY_SCORE[trace.unit_coverage?.[u]] ?? 0,
        }));
      }

      if (args.json || shouldUseJson()) {
        const out = {
          project: args.project,
          runs: traced.map(({ v, trace }) => ({
            version: v, workflow: trace.workflow, tokens: trace.totals?.tokens,
            completeness: trace.totals?.completeness ?? computeCompleteness(trace.unit_coverage ?? {}),
          })),
          unitTrend,
        };
        console.log(JSON.stringify(out, null, 2));
        return;
      }

      console.log(`\nTrace Report: ${args.project}  (${traced.length} traced runs)\n`);

      const summaryRows = traced.map(({ v, trace }) => {
        const c = trace.totals?.completeness ?? computeCompleteness(trace.unit_coverage ?? {});
        return { version: v, workflow: trace.workflow || '—', completeness: c?.toFixed(3) ?? '—', tokens: trace.totals?.tokens ?? '—' };
      });
      output(summaryRows, { title: 'Run Summary' });

      console.log(`\nUnit Fidelity Trend\n${'─'.repeat(60)}`);
      const problemUnits = ALL_UNITS.filter((u) => {
        const scores = unitTrend[u].map((t) => t.score);
        return scores.some((s) => s < 1.0);
      });

      for (const u of problemUnits) {
        const trend = unitTrend[u].map((t) => `${t.v}:${t.fidelity[0]}`).join('  ');
        const latest = unitTrend[u][unitTrend[u].length - 1]?.fidelity || 'Absent';
        console.log(`  ${u}  ${UNIT_LABELS[u]?.slice(0, 28).padEnd(28)}  ${trend}  (latest: ${latest})`);
      }
      if (problemUnits.length === 0) console.log('  All units at Full/Referenced across all traced runs.');
      console.log('');
    },
  });

  const evalTraceWrite = defineCommand({
    meta: { name: 'write', description: 'Record a TRACE.json for an eval run' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      version: { type: 'string', description: 'Run version (default: latest)', default: '' },
      workflow: { type: 'string', description: 'Workflow: A, B, or both', default: 'A' },
      completeness: { type: 'string', description: 'Completeness score (0–1)', default: '' },
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
      console.log(`\n✓ TRACE.json written: evals/${args.project}/${version}/TRACE.json`);
      console.log(`  workflow=${trace.workflow}  completeness=${completeness?.toFixed(3) ?? '—'}  tokens=${tokens ?? '—'}`);
      console.log(`\nView:  gad eval trace show --project ${args.project} --version ${version}`);
    },
  });

  const evalTraceInit = defineCommand({
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

      // Framework version stamping (decisions gad-51, gad-54).
      const { getFrameworkVersion: _getFv } = require('../../lib/framework-version.cjs');
      const fv = _getFv();
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
      console.log(`\n✓ Implementation trace initialized: evals/${args.project}/v${nextVersion}/TRACE.json`);
      console.log(`  context_mode=${args.mode}  started=${trace.timing.started}`);
      console.log(`\nLog commands:  gad eval trace log-cmd --project ${args.project} --cmd "gad snapshot"`);
      console.log(`Log skills:    gad eval trace log-skill --project ${args.project} --skill "/gad:plan-phase" --phase 01`);
      console.log(`Finalize:      gad eval trace finalize --project ${args.project}`);
    },
  });

  const evalTraceLogCmd = defineCommand({
    meta: { name: 'log-cmd', description: 'Log a gad command to the active implementation trace' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      cmd: { type: 'string', description: 'Command that was run', default: '' },
      tokens: { type: 'string', description: 'Token count of output', default: '0' },
    },
    run({ args }) {
      if (!args.project || !args.cmd) { outputError('Usage: gad eval trace log-cmd --project <name> --cmd "<command>" [--tokens N]'); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
      if (runs.length === 0) { outputError('No runs found. Run gad eval trace init first.'); return; }
      const traceFile = path.join(projDir, runs[0].name, 'TRACE.json');
      const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
      trace.gad_commands.push({ cmd: args.cmd, at: new Date().toISOString(), tokens: parseInt(args.tokens) || 0 });
      trace.cli_efficiency.total_gad_commands = trace.gad_commands.length;
      trace.cli_efficiency.total_gad_tokens = trace.gad_commands.reduce((s, c) => s + (c.tokens || 0), 0);
      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
    },
  });

  const evalTraceLogSkill = defineCommand({
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
      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
      if (runs.length === 0) { outputError('No runs found. Run gad eval trace init first.'); return; }
      const traceFile = path.join(projDir, runs[0].name, 'TRACE.json');
      const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
      trace.skill_triggers.push({
        skill: args.skill,
        phase: args.phase || '',
        at: new Date().toISOString(),
        result: args.result || '',
      });
      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
    },
  });

  const evalTraceFinalize = defineCommand({
    meta: { name: 'finalize', description: 'Finalize an implementation trace — compute scores' },
    args: { project: { type: 'string', description: 'Eval project name', default: '' } },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
      if (runs.length === 0) { outputError('No runs found.'); return; }
      const traceFile = path.join(projDir, runs[0].name, 'TRACE.json');
      const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));

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

      // Composite (v3 formula — 6 dimensions, normalized when human_review absent)
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
      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));
      console.log(`\n✓ Trace finalized: evals/${args.project}/${runs[0].name}/TRACE.json`);
      console.log(`\n  Duration:          ${trace.timing.duration_minutes} min`);
      console.log(`  Phases completed:  ${trace.timing.phases_completed}`);
      console.log(`  Tasks completed:   ${trace.timing.tasks_completed}`);
      console.log(`  Req coverage:      ${s.requirement_coverage?.toFixed(3) ?? '—'}`);
      console.log(`  Planning quality:  ${s.planning_quality?.toFixed(3) ?? '—'}`);
      console.log(`  Task discipline:   ${s.per_task_discipline?.toFixed(3) ?? '—'}`);
      console.log(`  Skill accuracy:    ${s.skill_accuracy?.toFixed(3) ?? '—'}`);
      console.log(`  Time efficiency:   ${s.time_efficiency?.toFixed(3) ?? '—'}`);
      console.log(`  Human review:      ${hr?.toFixed(3) ?? '(pending)'}`);
      console.log(`  Composite:         ${s.composite?.toFixed(3) ?? '—'}${hr == null ? ' (auto)' : ''}`);
    },
  });

  const evalTraceReconstruct = defineCommand({
    meta: { name: 'reconstruct', description: 'Reconstruct TRACE.json from git history — no agent cooperation needed' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      path: { type: 'string', description: 'Path to eval worktree or project dir', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const { execSync } = require('child_process');
      const projDir = resolveOrDefaultEvalProjectDir(args.project);

      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .sort((a, b) => parseInt(b.name.slice(1)) - parseInt(a.name.slice(1)));
      if (runs.length === 0) { outputError('No runs found.'); return; }
      const version = runs[0].name;
      const traceFile = path.join(projDir, version, 'TRACE.json');

      let trace = {};
      if (fs.existsSync(traceFile)) trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));

      // Get git log for the eval directory — try from GAD repo (submodule) first, then parent
      let gitLog = '';
      const gadRepoDir = path.join(__dirname, '..', '..');
      const evalRelPath = path.relative(gadRepoDir, projDir);
      try {
        gitLog = execSync(`git log --all --format="%H|%aI|%s" --name-only -- "${evalRelPath}"`, {
          cwd: gadRepoDir, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
      } catch { /* try parent repo */ }
      if (!gitLog) {
        try {
          gitLog = execSync(`git log --all --format="%H|%aI|%s" --name-only -- "${path.relative(findRepoRoot(), projDir)}"`, {
            cwd: findRepoRoot(), encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();
        } catch { /* no git history */ }
      }

      if (!gitLog) { console.log('No git history found for this eval project.'); return; }

      const commits = [];
      let currentCommit = null;
      for (const line of gitLog.split('\n')) {
        if (line.includes('|')) {
          const [hash, date, ...msgParts] = line.split('|');
          currentCommit = { hash, date, message: msgParts.join('|'), files: [] };
          commits.push(currentCommit);
        } else if (line.trim() && currentCommit) {
          currentCommit.files.push(line.trim());
        }
      }

      let phasesCompleted = 0;
      let tasksCompleted = 0;
      let stateUpdates = 0;
      let decisionsAdded = 0;
      const taskIds = [];

      const templatePlanDir = path.join(projDir, 'template', '.planning');
      const taskRegXml = readXmlFile(path.join(templatePlanDir, 'TASK-REGISTRY.xml'));
      if (taskRegXml) {
        const doneMatches = taskRegXml.match(/status="done"/g);
        tasksCompleted = doneMatches ? doneMatches.length : 0;
        const taskIdMatches = taskRegXml.match(/id="([^"]+)"/g);
        if (taskIdMatches) {
          for (const m of taskIdMatches) {
            const id = m.match(/id="([^"]+)"/)[1];
            if (id && !id.startsWith('0')) taskIds.push(id);
          }
        }
      }

      const roadmapXml = readXmlFile(path.join(templatePlanDir, 'ROADMAP.xml'));
      if (roadmapXml) {
        const donePhases = roadmapXml.match(/status="done"/g) || roadmapXml.match(/status="complete"/g);
        phasesCompleted = donePhases ? donePhases.length : 0;
      }

      const decisionsXml = readXmlFile(path.join(templatePlanDir, 'DECISIONS.xml'));
      if (decisionsXml) {
        const decMatches = decisionsXml.match(/<decision\s/g);
        decisionsAdded = decMatches ? decMatches.length : 0;
      }

      stateUpdates = commits.filter((c) => c.files.some((f) => f.includes('STATE.xml') || f.includes('STATE.md'))).length;

      const taskCommits = commits.filter((c) => /\d+-\d+/.test(c.message));
      const batchCommits = commits.filter((c) => !(/\d+-\d+/.test(c.message)) && c.files.length > 3);

      const timestamps = commits.map((c) => new Date(c.date).getTime()).filter((t) => !isNaN(t));
      const started = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : trace.timing?.started;
      const ended = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : trace.timing?.ended;
      const durationMin = started && ended ? Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 60000) : null;

      const sourceFiles = new Set();
      for (const c of commits) {
        for (const f of c.files) {
          if (f.includes('/src/') || f.includes('/game/')) sourceFiles.add(f);
        }
      }

      const reconstructed = {
        ...trace,
        eval: args.project,
        version,
        eval_type: 'implementation',
        reconstructed: true,
        reconstructed_at: new Date().toISOString(),
        timing: {
          started: started || trace.timing?.started,
          ended: ended || trace.timing?.ended,
          duration_minutes: durationMin,
          phases_completed: phasesCompleted,
          tasks_completed: tasksCompleted,
        },
        git_analysis: {
          total_commits: commits.length,
          task_id_commits: taskCommits.length,
          batch_commits: batchCommits.length,
          source_files_created: sourceFiles.size,
          state_updates: stateUpdates,
          decisions_added: decisionsAdded,
          per_task_discipline: taskCommits.length > 0 ? (taskCommits.length / Math.max(tasksCompleted, 1)) : 0,
        },
        planning_quality: {
          phases_planned: roadmapXml ? (roadmapXml.match(/<phase/g) || []).length : 0,
          tasks_planned: taskRegXml ? (taskRegXml.match(/<task/g) || []).length : 0,
          tasks_completed: tasksCompleted,
          tasks_blocked: 0,
          decisions_captured: decisionsAdded,
          state_updates: stateUpdates,
          state_stale_count: Math.max(0, tasksCompleted - stateUpdates),
        },
      };

      const hasPhaseGoals = roadmapXml && (roadmapXml.match(/<goal>/g) || []).length > 0;
      const hasDoneTasks = tasksCompleted > 0;
      const hasPerTaskCommits = taskCommits.length > 0;
      const conventionsExists = fs.existsSync(path.join(templatePlanDir, 'CONVENTIONS.md'));
      const verificationExists = fs.existsSync(path.join(templatePlanDir, 'VERIFICATION.md'));
      const verifyCommits = commits.filter((c) => /^verify:/i.test(c));
      const hasVerification = verificationExists || verifyCommits.length > 0;
      const evalDecisions = readXmlFile(path.join(templatePlanDir, 'DECISIONS.xml'));
      const hasDecisions = evalDecisions && (evalDecisions.match(/<decision /g) || []).length > 0;
      const hasMultiplePhases = roadmapXml && (roadmapXml.match(/<phase /g) || []).length > 1;
      const evalState = readXmlFile(path.join(templatePlanDir, 'STATE.xml'));
      const hasStateNextAction = evalState && /<next-action>[^<]+<\/next-action>/.test(evalState);
      const hasPhaseDoneInRoadmap = roadmapXml && /<status>done<\/status>/.test(roadmapXml);
      const evalTaskReg = readXmlFile(path.join(templatePlanDir, 'TASK-REGISTRY.xml'));
      const hasInProgressToDone = evalTaskReg && /status="done"/.test(evalTaskReg);
      const worktreeRoot = path.dirname(templatePlanDir);
      const hasBuildArtifact = ['dist', 'demo', 'game/dist', 'build', 'out'].some((d) =>
        fs.existsSync(path.join(worktreeRoot, d)) && fs.statSync(path.join(worktreeRoot, d)).isDirectory()
      );
      const hasArchDoc = fs.existsSync(path.join(templatePlanDir, 'ARCHITECTURE.md'));

      reconstructed.skill_accuracy = {
        expected_triggers: [
          { skill: '/gad:plan-phase', when: 'before implementation', triggered: hasPhaseGoals, evidence: 'ROADMAP.xml has <goal> elements' },
          { skill: '/gad:execute-phase', when: 'per phase', triggered: hasDoneTasks, evidence: 'tasks marked done in TASK-REGISTRY.xml' },
          { skill: '/gad:task-checkpoint', when: 'between tasks', triggered: hasPerTaskCommits, evidence: 'commits reference task IDs' },
          { skill: '/gad:verify-work', when: 'after phase completion', triggered: hasVerification, evidence: 'VERIFICATION.md exists or verify: commits found' },
          { skill: '/gad:auto-conventions', when: 'after first code phase', triggered: conventionsExists, evidence: 'CONVENTIONS.md exists' },
          { skill: '/gad:check-todos', when: 'session start or between phases', triggered: hasStateNextAction, evidence: 'STATE.xml has non-empty next-action' },
          { skill: 'decisions-captured', when: 'during implementation', triggered: hasDecisions, evidence: 'DECISIONS.xml has <decision> entries' },
          { skill: 'multi-phase-planning', when: 'before execution', triggered: hasMultiplePhases, evidence: 'ROADMAP.xml has >1 phase' },
          { skill: 'phase-completion', when: 'during execution', triggered: hasPhaseDoneInRoadmap, evidence: 'at least one phase marked done in ROADMAP.xml' },
          { skill: 'task-lifecycle', when: 'per task', triggered: hasInProgressToDone, evidence: 'tasks transition from planned to done in TASK-REGISTRY.xml' },
          { skill: 'build-artifact', when: 'final phase', triggered: hasBuildArtifact, evidence: 'dist/ or demo/ directory exists with build output' },
          { skill: 'architecture-doc', when: 'before final commit', triggered: hasArchDoc, evidence: 'ARCHITECTURE.md exists in .planning/' },
        ],
        accuracy: null,
      };
      const expectedCount = reconstructed.skill_accuracy.expected_triggers.length;
      const triggeredCount = reconstructed.skill_accuracy.expected_triggers.filter((e) => e.triggered).length;
      reconstructed.skill_accuracy.accuracy = expectedCount > 0 ? triggeredCount / expectedCount : null;

      const pq = reconstructed.planning_quality;
      if (pq.tasks_planned > 0) {
        const taskRatio = pq.tasks_completed / pq.tasks_planned;
        const stalePenalty = pq.state_updates > 0 ? (1 - pq.state_stale_count / Math.max(pq.state_updates + pq.state_stale_count, 1)) : 0;
        reconstructed.scores = reconstructed.scores || {};
        reconstructed.scores.planning_quality = taskRatio * stalePenalty;
      }

      if (durationMin != null) {
        reconstructed.scores = reconstructed.scores || {};
        reconstructed.scores.time_efficiency = Math.max(0, Math.min(1, 1 - (durationMin / 480)));
      }

      const scores = reconstructed.scores || {};
      scores.skill_accuracy = reconstructed.skill_accuracy.accuracy;
      scores.per_task_discipline = reconstructed.git_analysis.per_task_discipline;
      scores.requirement_coverage = reconstructed.requirement_coverage?.coverage_ratio ?? null;
      scores.human_review = null;
      if (scores.requirement_coverage != null && scores.planning_quality != null && scores.skill_accuracy != null && scores.time_efficiency != null && scores.per_task_discipline != null) {
        scores.auto_composite = (scores.requirement_coverage * 0.25) + (scores.planning_quality * 0.25) + (scores.per_task_discipline * 0.25) + (scores.skill_accuracy * 0.167) + (scores.time_efficiency * 0.083);
        scores.composite = scores.auto_composite;
      }
      reconstructed.scores = scores;
      reconstructed.trace_schema_version = 3;

      fs.writeFileSync(traceFile, JSON.stringify(reconstructed, null, 2));

      console.log(`\n✓ Trace reconstructed: evals/${args.project}/${version}/TRACE.json`);
      console.log(`\n  Git commits analyzed:  ${commits.length}`);
      console.log(`  Phases completed:      ${phasesCompleted}`);
      console.log(`  Tasks completed:       ${tasksCompleted}`);
      console.log(`  Task-id commits:       ${taskCommits.length} / ${commits.length}`);
      console.log(`  State updates:         ${stateUpdates}`);
      console.log(`  Decisions captured:    ${decisionsAdded}`);
      console.log(`  Source files created:  ${sourceFiles.size}`);
      console.log(`  Per-task discipline:   ${reconstructed.git_analysis.per_task_discipline.toFixed(2)}`);
      console.log(`  Duration:              ${durationMin} min`);
      if (reconstructed.scores?.planning_quality != null) {
        console.log(`  Planning quality:      ${reconstructed.scores.planning_quality.toFixed(3)}`);
      }
    },
  });

  const evalTraceFromLog = defineCommand({
    meta: { name: 'from-log', description: 'Build TRACE.json from actual JSONL call logs (definitive, not git-reconstructed)' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      version: { type: 'string', description: 'Version (default: latest)', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projectDir = resolveOrDefaultEvalProjectDir(args.project);

      if (!fs.existsSync(projectDir)) outputError(`Eval project '${args.project}' not found.`);

      const versions = fs.readdirSync(projectDir)
        .filter((n) => /^v\d+$/.test(n))
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
      const version = args.version || versions[versions.length - 1];
      if (!version) outputError('No eval runs found.');

      const runDir = path.join(projectDir, version);
      const logDir = path.join(runDir, '.gad-log');

      if (!fs.existsSync(logDir)) {
        console.log(`No .gad-log/ directory in ${version}. Set GAD_LOG_DIR during eval runs.`);
        console.log(`Falling back to git-based reconstruction: gad eval trace reconstruct --project ${args.project}`);
        return;
      }

      const logFiles = fs.readdirSync(logDir).filter((f) => f.endsWith('.jsonl')).sort();
      const entries = [];
      for (const f of logFiles) {
        const lines = fs.readFileSync(path.join(logDir, f), 'utf8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try { entries.push(JSON.parse(line)); } catch {}
        }
      }

      if (entries.length === 0) { console.log('Log files exist but contain no entries.'); return; }

      const gadCommands = entries.filter((e) => e.cmd || e.gad_command);
      const toolCalls = entries.filter((e) => e.type === 'tool_call');
      const skillTriggers = entries.filter((e) => e.skill);
      const agentSpawns = entries.filter((e) => e.tool === 'Agent');
      const bashCalls = entries.filter((e) => e.tool === 'Bash');
      const readCalls = entries.filter((e) => e.tool === 'Read');
      const writeCalls = entries.filter((e) => e.tool === 'Write');
      const editCalls = entries.filter((e) => e.tool === 'Edit');
      const runtimeCounts = new Map();
      for (const entry of entries) {
        const runtimeId = entry.runtime?.id || entry.runtime_id || 'unknown';
        runtimeCounts.set(runtimeId, (runtimeCounts.get(runtimeId) || 0) + 1);
      }
      const runtimeEntries = Array.from(runtimeCounts.entries()).sort((a, b) => b[1] - a[1]);
      const primaryRuntime = runtimeEntries[0]?.[0] || 'unknown';

      const timestamps = entries.map((e) => new Date(e.ts).getTime()).filter((t) => !isNaN(t));
      const startTime = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null;
      const endTime = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
      const durationMin = startTime && endTime ? Math.round((new Date(endTime) - new Date(startTime)) / 60000) : null;

      const gadCmdList = [];
      for (const e of entries) {
        const cmd = e.gad_command || e.cmd;
        if (cmd && (cmd.includes('snapshot') || cmd.includes('state') || cmd.includes('tasks')
            || cmd.includes('phases') || cmd.includes('decisions') || cmd.includes('eval')
            || cmd.includes('sprint') || cmd.includes('verify'))) {
          gadCmdList.push({ cmd, at: e.ts, duration_ms: e.duration_ms || 0 });
        }
      }

      const trace = {
        eval: args.project,
        version,
        date: new Date().toISOString().slice(0, 10),
        gad_version: pkg.version,
        source: 'call-log',
        trace_schema_version: 5,
        runtime_identity: {
          id: primaryRuntime,
          source: 'log-derived',
          model: entries.find((e) => e.runtime?.model)?.runtime?.model || null,
        },
        runtimes_involved: runtimeEntries.map(([id, count]) => ({ id, count })),
        agent_lineage: summarizeAgentLineage({
          runtimeIdentity: {
            id: primaryRuntime,
            source: 'log-derived',
            model: entries.find((e) => e.runtime?.model)?.runtime?.model || null,
          },
          runtimesInvolved: runtimeEntries.map(([id, count]) => ({ id, count })),
        }),
        timing: { started: startTime, ended: endTime, duration_minutes: durationMin },
        log_stats: {
          total_entries: entries.length,
          gad_cli_calls: gadCommands.length,
          tool_calls: toolCalls.length,
          skill_triggers: skillTriggers.length,
          agent_spawns: agentSpawns.length,
          bash_calls: bashCalls.length,
          read_calls: readCalls.length,
          write_calls: writeCalls.length,
          edit_calls: editCalls.length,
        },
        gad_commands: gadCmdList.slice(0, 50),
        skill_triggers: skillTriggers.map((e) => ({ skill: e.skill, args: e.skill_args || '', at: e.ts })),
        agent_spawns: agentSpawns.map((e) => ({
          type: e.agent_type,
          description: e.agent_description,
          background: e.agent_background,
          isolated: e.agent_isolated,
          at: e.ts,
        })),
      };

      const traceFile = path.join(runDir, 'TRACE.json');
      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2));

      console.log(`\n✓ Trace built from logs: evals/${args.project}/${version}/TRACE.json`);
      console.log(`\n  Source:            call-log (${logFiles.length} file(s), ${entries.length} entries)`);
      console.log(`  Duration:          ${durationMin} min`);
      console.log(`  GAD CLI calls:     ${gadCommands.length}`);
      console.log(`  Tool calls:        ${toolCalls.length}`);
      console.log(`  Skill triggers:    ${skillTriggers.length}`);
      console.log(`  Agent spawns:      ${agentSpawns.length}`);
      console.log(`  Bash/Read/Write:   ${bashCalls.length}/${readCalls.length}/${writeCalls.length}`);
    },
  });

  const evalTraceCmd = defineCommand({
    meta: { name: 'trace', description: 'Inspect and compare eval traces (TRACE.json)' },
    subCommands: {
      list: evalTraceList, show: evalTraceShow, diff: evalTraceDiff, report: evalTraceReport,
      write: evalTraceWrite, init: evalTraceInit, 'log-cmd': evalTraceLogCmd, 'log-skill': evalTraceLogSkill,
      finalize: evalTraceFinalize, reconstruct: evalTraceReconstruct, 'from-log': evalTraceFromLog,
    },
  });

  return { evalTraceCmd };
}

module.exports = { createEvalTraceCommand };
