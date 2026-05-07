'use strict';
/**
 * lib/provenance/frequency.cjs — rolling-window edit frequency.
 *
 * For each enriched event, count how many other events touched the same
 * file within rolling windows (1h, 24h, 7d) BEFORE the event. This is the
 * raw signal for the "churn" label.
 *
 * Output: adds `frequency` field in place:
 *   {
 *     edits_prev_1h: number,
 *     edits_prev_24h: number,
 *     edits_prev_7d: number,
 *   }
 */

const fs = require('node:fs');
const path = require('node:path');
const { readJsonl, provenanceDir } = require('./index.cjs');

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const SEVEN_DAY_MS = 7 * ONE_DAY_MS;

function annotateFrequency({ planningDir }) {
  const dir = provenanceDir(planningDir);
  if (!fs.existsSync(dir)) return { files_processed: 0, events_annotated: 0 };

  // Pass 1: gather all events across all date files, sorted by ts
  const allEvents = [];
  const fileNames = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
  for (const f of fileNames) {
    for (const evt of readJsonl(path.join(dir, f))) {
      allEvents.push({ src_file: f, evt });
    }
  }
  allEvents.sort((a, b) => new Date(a.evt.ts).getTime() - new Date(b.evt.ts).getTime());

  // Pass 2: for each event, scan backwards over same file_path within window
  // Build per-file timestamp arrays for fast count
  const perFileTs = new Map();  // file_path -> sorted array of ts (ms)
  for (const { evt } of allEvents) {
    if (!evt.file_path) continue;
    if (!perFileTs.has(evt.file_path)) perFileTs.set(evt.file_path, []);
    perFileTs.get(evt.file_path).push(new Date(evt.ts).getTime());
  }

  function countInWindow(arr, target, windowMs) {
    // count entries in arr that are < target and >= target - windowMs
    let count = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] >= target) continue;
      if (arr[i] < target - windowMs) break;
      count++;
    }
    return count;
  }

  // Annotate each event
  for (const { evt } of allEvents) {
    if (!evt.file_path) continue;
    const tsMs = new Date(evt.ts).getTime();
    const arr = perFileTs.get(evt.file_path) || [];
    evt.frequency = {
      edits_prev_1h: countInWindow(arr, tsMs, ONE_HOUR_MS),
      edits_prev_24h: countInWindow(arr, tsMs, ONE_DAY_MS),
      edits_prev_7d: countInWindow(arr, tsMs, SEVEN_DAY_MS),
    };
  }

  // Write back per-day, preserving original date partitioning
  const grouped = new Map();
  for (const { src_file, evt } of allEvents) {
    if (!grouped.has(src_file)) grouped.set(src_file, []);
    grouped.get(src_file).push(evt);
  }
  for (const [src_file, events] of grouped.entries()) {
    fs.writeFileSync(
      path.join(dir, src_file),
      events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''),
      'utf8'
    );
  }

  return { files_processed: grouped.size, events_annotated: allEvents.length };
}

module.exports = { annotateFrequency };
