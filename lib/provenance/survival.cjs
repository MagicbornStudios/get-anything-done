'use strict';
/**
 * lib/provenance/survival.cjs — survival tracker.
 *
 * For each enriched event, compute "is the new_string still in the file
 * at HEAD?" as a quality signal. v1 uses substring presence at file-level
 * (simple, fast, ~80% accurate). v2 could blame line-by-line.
 *
 * Output: adds `survival` field to each event in place:
 *   {
 *     in_head: true|false|null,            // file exists in HEAD?
 *     content_present_pct: 0..100|null,    // how much of new_string survived
 *     last_commit_touching_file: "<sha>"|null,
 *     untouched_seconds: number|null,      // since last commit on this file
 *   }
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { readJsonl, provenanceDir, provenanceFilePath } = require('./index.cjs');

function git(baseDir, args) {
  try {
    return execSync(`git ${args}`, {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (e) {
    return '';
  }
}

function relativeToRepo(baseDir, absPath) {
  return path.relative(baseDir, absPath).replace(/\\/g, '/');
}

/**
 * For a single event, compute the survival fields.
 */
function computeSurvival(baseDir, event) {
  const filePath = event.file_path;
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      in_head: false,
      content_present_pct: 0,
      last_commit_touching_file: null,
      untouched_seconds: null,
    };
  }

  const repoRel = relativeToRepo(baseDir, filePath);

  // Last commit touching this file
  const lastSha = git(baseDir, `log --max-count=1 --format=%H -- "${repoRel}"`);
  const lastTs = lastSha ? git(baseDir, `log --max-count=1 --format=%cI -- "${repoRel}"`) : null;
  const untouched = lastTs ? Math.max(0, Math.floor((Date.now() - new Date(lastTs).getTime()) / 1000)) : null;

  // Substring presence in current file
  let presentPct = 0;
  let target = '';
  if (event.diff && event.diff.kind === 'edit') {
    target = event.diff.new_string || '';
  } else if (event.diff && event.diff.kind === 'write') {
    target = event.diff.content || '';
  } else if (event.diff && event.diff.kind === 'multiedit' && Array.isArray(event.diff.edits) && event.diff.edits.length > 0) {
    target = event.diff.edits.map((e) => e.new_string || '').join('\n');
  } else if (event.diff && event.diff.kind === 'notebook') {
    target = event.diff.cell_source || '';
  }

  if (target) {
    try {
      const current = fs.readFileSync(filePath, 'utf8');
      // Simple full-string presence first
      if (target.length > 0 && current.includes(target)) {
        presentPct = 100;
      } else {
        // Line-level intersection: how many of the target's lines are in current?
        const targetLines = target.split(/\r?\n/).filter((l) => l.trim());
        if (targetLines.length === 0) {
          presentPct = 0;
        } else {
          // O(n*m) but n,m small for typical edits
          const currentSet = new Set(current.split(/\r?\n/).map((l) => l.trim()));
          let hits = 0;
          for (const l of targetLines) {
            if (currentSet.has(l.trim())) hits++;
          }
          presentPct = Math.round((hits / targetLines.length) * 100);
        }
      }
    } catch (e) {
      presentPct = 0;
    }
  }

  return {
    in_head: true,
    content_present_pct: presentPct,
    last_commit_touching_file: lastSha || null,
    untouched_seconds: untouched,
  };
}

/**
 * Walk every per-day provenance JSONL file and add survival fields.
 * Idempotent (re-running just refreshes survival data).
 */
function annotateSurvival({ planningDir, baseDir }) {
  const dir = provenanceDir(planningDir);
  if (!fs.existsSync(dir)) return { files_processed: 0, events_annotated: 0 };

  let filesProcessed = 0;
  let eventsAnnotated = 0;

  for (const f of fs.readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) continue;
    const filePath = path.join(dir, f);
    const events = [];
    for (const evt of readJsonl(filePath)) {
      evt.survival = computeSurvival(baseDir, evt);
      events.push(evt);
      eventsAnnotated++;
    }
    fs.writeFileSync(filePath, events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''), 'utf8');
    filesProcessed++;
  }

  return { files_processed: filesProcessed, events_annotated: eventsAnnotated };
}

module.exports = { annotateSurvival, computeSurvival };
