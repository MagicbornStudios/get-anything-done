'use strict';
/**
 * gad provenance — code-edit provenance pipeline.
 *
 * Subcommands:
 *   build   — joiner + survival + frequency + labeler over a date range
 *   show    — inspect a single event by file:line or event_id
 *   export  — emit training corpus (default: ../slm_learning/data/)
 *   stats   — summary numbers (counts by label, by model, by project)
 *   lookup  — `gad provenance lookup <file>:<line>` — who/what/when
 *
 * Decisions: GLOBAL-D-300..305 (Phase 153).
 */

const fs = require('node:fs');
const path = require('node:path');
const { defineCommand } = require('citty');

const { buildProvenance } = require('../../lib/provenance/join.cjs');
const { annotateSurvival } = require('../../lib/provenance/survival.cjs');
const { annotateFrequency } = require('../../lib/provenance/frequency.cjs');
const { annotateLabels } = require('../../lib/provenance/label.cjs');
const { exportCorpus } = require('../../lib/provenance/export.cjs');
const { provenanceDir, readJsonl, parseDateRange } = require('../../lib/provenance/index.cjs');

function resolveProjectInfo(deps) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  const projects = (config.roots || []).map((r) => ({
    projectId: r.id,
    rootPath: path.resolve(baseDir, r.path || '.'),
    planningDir: r.planningDir || '.planning',
  }));
  return { baseDir, config, projects };
}

function createProvenanceCommand(deps) {
  const buildCmd = defineCommand({
    meta: {
      name: 'build',
      description: 'Run joiner + survival + frequency + labeler over a date range. Idempotent.',
    },
    args: {
      projectid: { type: 'string', description: 'Scope to one project (default: all roots)', default: '' },
      since: { type: 'string', description: 'ISO date (YYYY-MM-DD) — defaults to 7 days ago', default: '' },
      until: { type: 'string', description: 'ISO date — defaults to now', default: '' },
      'skip-survival': { type: 'boolean', description: 'Skip git-blame pass (faster)', default: false },
      'skip-frequency': { type: 'boolean', description: 'Skip rolling-window count', default: false },
      'skip-labels': { type: 'boolean', description: 'Skip quality classification', default: false },
    },
    run({ args }) {
      const { baseDir, config, projects } = resolveProjectInfo(deps);
      const targets = args.projectid
        ? projects.filter((p) => p.projectId === args.projectid)
        : projects;
      if (targets.length === 0) {
        deps.outputError(`No matching projects. Tried projectid=${args.projectid || '<all>'}`);
        process.exit(1);
        return;
      }

      const summary = { projects: {} };
      for (const project of targets) {
        const planningDir = path.join(project.rootPath, project.planningDir);
        const traceJsonlPath = path.join(planningDir, '.trace-events.jsonl');
        if (!fs.existsSync(traceJsonlPath)) {
          summary.projects[project.projectId] = { skipped: 'no .trace-events.jsonl' };
          continue;
        }
        console.log(`\n[provenance] building ${project.projectId} from ${path.relative(baseDir, traceJsonlPath)}`);

        const joinResult = buildProvenance({
          planningDir,
          traceJsonlPath,
          projects,
          since: args.since || undefined,
          until: args.until || undefined,
        });
        console.log(`  joiner: scanned ${joinResult.events_total} events, kept ${joinResult.events_kept}, wrote ${joinResult.files_written} per-day files`);

        let survivalResult = null;
        if (!args['skip-survival']) {
          survivalResult = annotateSurvival({ planningDir, baseDir });
          console.log(`  survival: annotated ${survivalResult.events_annotated} events across ${survivalResult.files_processed} files`);
        }

        let freqResult = null;
        if (!args['skip-frequency']) {
          freqResult = annotateFrequency({ planningDir });
          console.log(`  frequency: annotated ${freqResult.events_annotated} events across ${freqResult.files_processed} files`);
        }

        let labelResult = null;
        if (!args['skip-labels']) {
          labelResult = annotateLabels({ planningDir, config });
          const c = labelResult.by_label;
          console.log(`  labels: good=${c.good} churn=${c.churn} in_progress=${c.in_progress} neutral=${c.neutral}`);
        }

        summary.projects[project.projectId] = {
          join: joinResult,
          survival: survivalResult,
          frequency: freqResult,
          labels: labelResult,
        };
      }

      console.log('\n[provenance] build complete.');
      return summary;
    },
  });

  const showCmd = defineCommand({
    meta: {
      name: 'show',
      description: 'Show enriched events for a file (most recent first). Use --event-id for a specific one.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id', required: true },
      file: { type: 'string', description: 'File path (absolute or repo-relative) to filter', default: '' },
      'event-id': { type: 'string', description: 'Specific event_id', default: '' },
      limit: { type: 'string', description: 'Max events to show', default: '5' },
      json: { type: 'boolean', description: 'Emit full JSON', default: false },
    },
    run({ args }) {
      const { baseDir, projects } = resolveProjectInfo(deps);
      const project = projects.find((p) => p.projectId === args.projectid);
      if (!project) {
        deps.outputError(`Project not found: ${args.projectid}`);
        process.exit(1);
        return;
      }
      const planningDir = path.join(project.rootPath, project.planningDir);
      const dir = provenanceDir(planningDir);
      if (!fs.existsSync(dir)) {
        deps.outputError(`No provenance data yet. Run \`gad provenance build --projectid ${args.projectid}\` first.`);
        return;
      }
      const targetFile = args.file ? path.resolve(args.file) : null;
      const limit = parseInt(args.limit, 10) || 5;

      const matches = [];
      const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort().reverse();
      for (const f of files) {
        for (const evt of readJsonl(path.join(dir, f))) {
          if (args['event-id'] && evt.event_id !== args['event-id']) continue;
          if (targetFile && path.resolve(evt.file_path) !== targetFile) continue;
          matches.push(evt);
          if (matches.length >= limit) break;
        }
        if (matches.length >= limit) break;
      }

      if (matches.length === 0) {
        console.log('No matching events.');
        return;
      }

      if (args.json) {
        console.log(JSON.stringify(matches, null, 2));
        return;
      }

      for (const evt of matches) {
        console.log(`\n${evt.ts}  ${evt.tool}  ${path.relative(baseDir, evt.file_path)}`);
        console.log(`  event_id:  ${evt.event_id}`);
        console.log(`  runtime:   ${evt.runtime.id}  model: ${evt.runtime.model_id || 'unknown'}  session: ${(evt.runtime.session_id || '').slice(0, 8)}`);
        if (evt.handoff) console.log(`  handoff:   ${evt.handoff.id}  phase ${evt.handoff.phase}  task ${evt.handoff.task_id}`);
        if (evt.task) console.log(`  task:      ${evt.task.id}  skill ${evt.task.skill || '-'}`);
        if (evt.project) console.log(`  project:   ${evt.project.id}`);
        if (evt.survival) console.log(`  survival:  in_head=${evt.survival.in_head}  ${evt.survival.content_present_pct}% present  untouched ${Math.round((evt.survival.untouched_seconds || 0) / 86400)}d`);
        if (evt.frequency) console.log(`  frequency: ${evt.frequency.edits_prev_1h}/h  ${evt.frequency.edits_prev_24h}/24h  ${evt.frequency.edits_prev_7d}/7d`);
        if (evt.label) console.log(`  label:     ${evt.label.verdict.toUpperCase()} (${evt.label.reason})`);
      }
    },
  });

  const exportCmd = defineCommand({
    meta: {
      name: 'export',
      description: 'Emit training corpus from labeled events. Default sink: ../slm_learning/data/',
    },
    args: {
      projectid: { type: 'string', description: 'Filter to one project (default: all)', default: '' },
      to: { type: 'string', description: 'Output directory (default: ../slm_learning/data/)', default: '' },
      labels: { type: 'string', description: 'Comma-separated labels to include (default: good,churn)', default: 'good,churn' },
    },
    run({ args }) {
      const { baseDir, projects } = resolveProjectInfo(deps);
      const targets = args.projectid
        ? projects.filter((p) => p.projectId === args.projectid)
        : projects;
      if (targets.length === 0) {
        deps.outputError(`No matching projects.`);
        return;
      }
      const outDir = args.to
        ? path.resolve(args.to)
        : path.resolve(baseDir, '..', 'slm_learning', 'data');
      const labelList = args.labels ? args.labels.split(',').map((s) => s.trim()).filter(Boolean) : null;

      let totalTuples = 0;
      const writtenManifests = [];
      for (const project of targets) {
        const planningDir = path.join(project.rootPath, project.planningDir);
        if (!fs.existsSync(provenanceDir(planningDir))) continue;
        const result = exportCorpus({
          planningDir,
          outDir,
          projectid: args.projectid || project.projectId,
          labels: labelList,
        });
        console.log(`[export] ${project.projectId}: ${result.tuples_emitted} tuples in ${result.files_written} files`);
        totalTuples += result.tuples_emitted;
        writtenManifests.push(result.manifest_path);
      }
      console.log(`\n[export] total: ${totalTuples} tuples to ${outDir}`);
      for (const m of writtenManifests) console.log(`  manifest: ${path.relative(baseDir, m)}`);
    },
  });

  const statsCmd = defineCommand({
    meta: {
      name: 'stats',
      description: 'Summary counts by label, model, project.',
    },
    args: {
      projectid: { type: 'string', description: 'Filter to one project', default: '' },
    },
    run({ args }) {
      const { baseDir, projects } = resolveProjectInfo(deps);
      const targets = args.projectid
        ? projects.filter((p) => p.projectId === args.projectid)
        : projects;

      const aggByProject = {};
      const aggByModel = {};
      const aggByLabel = { good: 0, churn: 0, in_progress: 0, neutral: 0, unlabeled: 0 };
      let total = 0;

      for (const project of targets) {
        const planningDir = path.join(project.rootPath, project.planningDir);
        const dir = provenanceDir(planningDir);
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
          if (!/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) continue;
          for (const evt of readJsonl(path.join(dir, f))) {
            total++;
            const projId = (evt.project && evt.project.id) || project.projectId;
            const modelId = (evt.runtime && evt.runtime.model_id) || 'unknown';
            const label = (evt.label && evt.label.verdict) || 'unlabeled';
            aggByProject[projId] = (aggByProject[projId] || 0) + 1;
            aggByModel[modelId] = (aggByModel[modelId] || 0) + 1;
            aggByLabel[label] = (aggByLabel[label] || 0) + 1;
          }
        }
      }

      console.log(`\n[stats] ${total} provenance events`);
      console.log(`\nBy project:`);
      Object.entries(aggByProject).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v}`));
      console.log(`\nBy model:`);
      Object.entries(aggByModel).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${(k || 'unknown').padEnd(24)} ${v}`));
      console.log(`\nBy label:`);
      Object.entries(aggByLabel).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v}`));
    },
  });

  const lookupCmd = defineCommand({
    meta: {
      name: 'lookup',
      description: 'Find which event(s) wrote a given file. Use <file>[:<line>] target.',
    },
    args: {
      target: { type: 'positional', description: 'file or file:line', required: true },
      projectid: { type: 'string', description: 'Project id', required: true },
      limit: { type: 'string', description: 'Max events', default: '3' },
    },
    run({ args }) {
      const { baseDir, projects } = resolveProjectInfo(deps);
      const project = projects.find((p) => p.projectId === args.projectid);
      if (!project) {
        deps.outputError(`Project not found: ${args.projectid}`);
        process.exit(1);
        return;
      }
      const colon = String(args.target).lastIndexOf(':');
      const isLineColon = colon > 1 && /^\d+$/.test(String(args.target).slice(colon + 1));
      const file = isLineColon ? String(args.target).slice(0, colon) : String(args.target);
      const lineNum = isLineColon ? parseInt(String(args.target).slice(colon + 1), 10) : null;

      const planningDir = path.join(project.rootPath, project.planningDir);
      const dir = provenanceDir(planningDir);
      if (!fs.existsSync(dir)) {
        deps.outputError('No provenance data. Run `gad provenance build` first.');
        return;
      }

      const targetAbs = path.isAbsolute(file) ? file : path.resolve(baseDir, file);
      const limit = parseInt(args.limit, 10) || 3;

      // For line lookups: read current file, extract the line content, then scan
      // events for ones whose new_string contains that line.
      let lineContent = null;
      if (lineNum != null && fs.existsSync(targetAbs)) {
        const lines = fs.readFileSync(targetAbs, 'utf8').split(/\r?\n/);
        lineContent = lines[lineNum - 1] || null;
      }

      const matches = [];
      const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort().reverse();
      for (const f of files) {
        for (const evt of readJsonl(path.join(dir, f))) {
          if (path.resolve(evt.file_path) !== targetAbs) continue;
          if (lineContent && evt.diff) {
            const target = (evt.diff.kind === 'edit' ? evt.diff.new_string :
                            evt.diff.kind === 'write' ? evt.diff.content :
                            evt.diff.kind === 'multiedit' ? evt.diff.edits.map((e) => e.new_string).join('\n') :
                            '') || '';
            if (!target.includes(lineContent.trim())) continue;
          }
          matches.push(evt);
          if (matches.length >= limit) break;
        }
        if (matches.length >= limit) break;
      }

      if (matches.length === 0) {
        console.log(`No events found for ${args.target}.`);
        if (lineNum != null) console.log(`  (line content: ${JSON.stringify(lineContent || '')})`);
        return;
      }

      console.log(`\n${matches.length} event(s) for ${args.target}:`);
      for (const evt of matches) {
        console.log(`  ${evt.ts}  ${evt.tool}  model=${evt.runtime.model_id || '?'}  task=${(evt.task && evt.task.id) || '-'}  phase=${(evt.task && evt.task.phase) || '-'}  label=${(evt.label && evt.label.verdict) || '?'}`);
      }
    },
  });

  return defineCommand({
    meta: {
      name: 'provenance',
      description: 'Code-edit provenance pipeline (Phase 153) — every agent edit traceable to model+runtime+handoff+task+phase, with quality labels for SFT corpus emission.',
    },
    subCommands: {
      build: buildCmd,
      show: showCmd,
      export: exportCmd,
      stats: statsCmd,
      lookup: lookupCmd,
    },
  });
}

module.exports = { createProvenanceCommand };
module.exports.register = (ctx) => {
  const cmd = createProvenanceCommand(ctx.common);
  return { provenance: cmd };
};
