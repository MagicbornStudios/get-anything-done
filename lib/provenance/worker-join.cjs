'use strict';
/**
 * lib/provenance/worker-join.cjs — pull codex/gemini/opencode worker output
 * into the provenance stream.
 *
 * Worker logs at .planning/team/workers/<id>/log.jsonl emit subproc-stdout
 * events with the model's full text response. Today's joiner only reads
 * Claude's hook-sourced trace events; the worker stream is invisible.
 *
 * v1 captures each subproc-stdout chunk as a `worker_action` provenance
 * event with full lineage — no parsing of code edits OUT of the text yet
 * (each runtime emits different shapes; v2 problem). The raw transcript
 * lands in the corpus; the SFT trainer in slm_learning can extract
 * model-specific code spans downstream.
 *
 * Critically: worker logs grow unbounded already (no rotation), so unlike
 * the trace-archive fix we don't need to add archiving here. We just
 * need to JOIN them.
 */

const fs = require('node:fs');
const path = require('node:path');
const { readJsonl, ymd, parseDateRange, provenanceFilePath } = require('./index.cjs');
const { parseHandoffFrontmatter } = require('./join.cjs');

/**
 * Walk .planning/team/workers/<id>/log.jsonl and emit enriched provenance
 * events for each subproc-stdout chunk.
 *
 * Emits per-day events APPENDED to .planning/.provenance/YYYY-MM-DD.jsonl
 * (the same files the Claude joiner writes). De-dupes by (worker_id, ts)
 * so re-running is idempotent.
 */
function buildWorkerProvenance({ planningDir, since, until }) {
  const teamDir = path.join(planningDir, 'team', 'workers');
  if (!fs.existsSync(teamDir)) {
    return { workers_scanned: 0, events_total: 0, events_kept: 0, by_date: {} };
  }

  const { sinceDate, untilDate } = parseDateRange({ since, until });

  // Pre-load handoffs for ref→{projectid,phase,task_id} lookup
  const handoffsById = new Map();
  for (const sub of ['open', 'claimed', 'closed']) {
    const dir = path.join(planningDir, 'handoffs', sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const fm = parseHandoffFrontmatter(path.join(dir, f));
      if (fm && fm.id) handoffsById.set(fm.id, fm);
    }
  }

  const byDate = new Map();
  let workersScanned = 0;
  let eventsTotal = 0;
  let eventsKept = 0;

  for (const workerDir of fs.readdirSync(teamDir)) {
    const logPath = path.join(teamDir, workerDir, 'log.jsonl');
    if (!fs.existsSync(logPath)) continue;
    workersScanned++;

    // First pass: find worker-start to discover runtime
    let workerRuntime = null;
    let workerLane = null;
    for (const evt of readJsonl(logPath)) {
      if (evt.kind === 'worker-start') {
        workerRuntime = evt.runtime || null;
        workerLane = evt.lane || null;
        break;
      }
    }

    // Second pass: emit subproc-stdout as code-attribution events
    let chunkBuffer = [];
    let chunkRef = null;
    let chunkStartTs = null;

    function flush() {
      if (!chunkBuffer.length || !chunkStartTs) {
        chunkBuffer = [];
        chunkRef = null;
        chunkStartTs = null;
        return;
      }
      const handoff = chunkRef ? handoffsById.get(chunkRef) : null;
      const text = chunkBuffer.join('');
      const enriched = {
        event_id: `worker-${workerDir}-${chunkStartTs}`,
        ts: chunkStartTs,
        tool: 'worker_action',
        file_path: null,
        diff: { kind: 'transcript', content: text },
        runtime: {
          id: workerRuntime || 'unknown',
          model_id: null,  // workers don't surface model id; v2 could parse runtime stderr
          session_id: null,
          source: 'worker-log',
          worker_id: workerDir,
          lane: workerLane,
        },
        agent: {
          id: workerDir,
          role: 'executor',
          parent: null, root: null, depth: null,
          model_profile: null, resolved_model: null,
        },
        handoff: handoff ? {
          id: handoff.id || null,
          projectid: handoff.projectid || null,
          phase: handoff.phase || null,
          task_id: handoff.task_id || null,
          claimed_by: handoff.claimed_by || null,
          runtime_preference: handoff.runtime_preference || null,
        } : (chunkRef ? { id: chunkRef, projectid: null, phase: null, task_id: null } : null),
        task: null,
        project: null,
      };
      const dateKey = ymd(new Date(chunkStartTs));
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey).push(enriched);
      eventsKept++;
      chunkBuffer = [];
      chunkRef = null;
      chunkStartTs = null;
    }

    for (const evt of readJsonl(logPath)) {
      eventsTotal++;
      if (evt.kind !== 'subproc-stdout') {
        // Different ref or boundary event — flush buffered chunk
        if (chunkBuffer.length && evt.ref && evt.ref !== chunkRef) flush();
        continue;
      }
      if (!evt.ts) continue;
      const evtDate = new Date(evt.ts);
      if (evtDate < sinceDate || evtDate > untilDate) continue;

      const ref = evt.ref || null;
      // Aggregate consecutive same-ref chunks into one transcript per handoff
      if (chunkRef && ref !== chunkRef) flush();
      if (!chunkRef) {
        chunkRef = ref;
        chunkStartTs = evt.ts;
      }
      if (typeof evt.data === 'string') {
        chunkBuffer.push(evt.data);
      }
    }
    flush();
  }

  // Append (don't overwrite — Claude joiner already wrote per-day files).
  // De-dupe by event_id within each file.
  let filesWritten = 0;
  const byDateSummary = {};
  for (const [dateKey, events] of byDate.entries()) {
    const outPath = provenanceFilePath(planningDir, dateKey);
    const existing = new Set();
    if (fs.existsSync(outPath)) {
      for (const evt of readJsonl(outPath)) {
        if (evt.event_id) existing.add(evt.event_id);
      }
    }
    const fresh = events.filter((e) => !existing.has(e.event_id));
    if (fresh.length === 0) {
      byDateSummary[dateKey] = 0;
      continue;
    }
    fs.appendFileSync(outPath, fresh.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    filesWritten++;
    byDateSummary[dateKey] = fresh.length;
  }

  return {
    workers_scanned: workersScanned,
    events_total: eventsTotal,
    events_kept: eventsKept,
    files_written: filesWritten,
    by_date: byDateSummary,
  };
}

module.exports = { buildWorkerProvenance };
