'use strict';
/**
 * lib/provenance/export.cjs — corpus emitter.
 *
 * Reads enriched + labeled provenance events and emits a training-grade
 * corpus tuple per event:
 *
 *   { input, output, label, model_id, runtime, project, phase, task_id, ts, file_path }
 *
 * Where input is reconstructed context (preceding assistant text +
 * surrounding code) and output is the diff or written content.
 *
 * Default sink: <slm_learning_path>/data/agent_corpus_<projectid>_<YYYY-MM-DD>.jsonl
 * Per decision GLOBAL-D-304 (dual sink — local + slm_learning).
 */

const fs = require('node:fs');
const path = require('node:path');
const { readJsonl, provenanceDir } = require('./index.cjs');

function eventToTuple(evt) {
  // Input reconstruction is intentionally simple in v1: file_path + diff kind.
  // The training script in slm_learning will further hydrate this with the
  // assistant_response from same-session Stop-hook events when needed.
  let inputText = `tool=${evt.tool} file=${evt.file_path}`;
  let outputText = '';

  if (evt.diff) {
    if (evt.diff.kind === 'edit') {
      inputText += `\n--- old ---\n${evt.diff.old_string || ''}`;
      outputText = evt.diff.new_string || '';
    } else if (evt.diff.kind === 'write') {
      outputText = evt.diff.content || '';
    } else if (evt.diff.kind === 'multiedit' && Array.isArray(evt.diff.edits)) {
      outputText = evt.diff.edits
        .map((e) => `# Edit\nold:\n${e.old_string || ''}\nnew:\n${e.new_string || ''}`)
        .join('\n---\n');
    } else if (evt.diff.kind === 'notebook') {
      inputText += `\n--- old ---\n${evt.diff.old_source || ''}`;
      outputText = evt.diff.cell_source || '';
    }
  }

  return {
    input: inputText,
    output: outputText,
    label: (evt.label && evt.label.verdict) || 'unlabeled',
    label_confidence: (evt.label && evt.label.confidence) || 0,
    label_reason: (evt.label && evt.label.reason) || '',
    model_id: (evt.runtime && evt.runtime.model_id) || null,
    runtime: (evt.runtime && evt.runtime.id) || null,
    session_id: (evt.runtime && evt.runtime.session_id) || null,
    project_id: (evt.project && evt.project.id) || (evt.handoff && evt.handoff.projectid) || null,
    phase: (evt.task && evt.task.phase) || (evt.handoff && evt.handoff.phase) || null,
    task_id: (evt.task && evt.task.id) || (evt.handoff && evt.handoff.task_id) || null,
    skill: (evt.task && evt.task.skill) || null,
    handoff_id: (evt.handoff && evt.handoff.id) || null,
    file_path: evt.file_path,
    ts: evt.ts,
    survival_pct: (evt.survival && evt.survival.content_present_pct) || null,
    edits_prev_1h: (evt.frequency && evt.frequency.edits_prev_1h) || 0,
    untouched_seconds: (evt.survival && evt.survival.untouched_seconds) || null,
  };
}

/**
 * Export filtered tuples to a slm_learning corpus path.
 * @param {object} opts
 * @param {string} opts.planningDir - source .planning/ directory
 * @param {string} opts.outDir      - destination directory (e.g. ../slm_learning/data/)
 * @param {string|null} opts.projectid - filter to one project (optional)
 * @param {string[]|null} opts.labels  - filter to specific verdicts ['good', 'churn', ...]
 */
function exportCorpus({ planningDir, outDir, projectid, labels }) {
  const dir = provenanceDir(planningDir);
  if (!fs.existsSync(dir)) return { files_written: 0, tuples_emitted: 0 };
  fs.mkdirSync(outDir, { recursive: true });

  const labelFilter = labels && labels.length > 0 ? new Set(labels) : null;
  const buckets = new Map();  // <projectid>__<date> -> tuples[]

  let tuplesEmitted = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) continue;
    const dateStr = f.replace(/\.jsonl$/, '');
    for (const evt of readJsonl(path.join(dir, f))) {
      const tuple = eventToTuple(evt);
      if (projectid && tuple.project_id !== projectid) continue;
      if (labelFilter && !labelFilter.has(tuple.label)) continue;
      const projKey = tuple.project_id || 'unscoped';
      const bucketKey = `${projKey}__${dateStr}`;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey).push(tuple);
      tuplesEmitted++;
    }
  }

  let filesWritten = 0;
  const manifest = {};
  for (const [bucketKey, tuples] of buckets.entries()) {
    const [projKey, dateStr] = bucketKey.split('__');
    const outFile = path.join(outDir, `agent_corpus_${projKey}_${dateStr}.jsonl`);
    fs.writeFileSync(outFile, tuples.map((t) => JSON.stringify(t)).join('\n') + '\n', 'utf8');
    manifest[outFile] = tuples.length;
    filesWritten++;
  }

  // Write a manifest.json next to the corpus files
  const manifestPath = path.join(outDir, `agent_corpus_manifest_${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    exported_at: new Date().toISOString(),
    tuples_emitted: tuplesEmitted,
    files: manifest,
    filters: { projectid: projectid || null, labels: labels || null },
  }, null, 2));

  return {
    files_written: filesWritten,
    tuples_emitted: tuplesEmitted,
    manifest_path: manifestPath,
  };
}

module.exports = { exportCorpus, eventToTuple };
