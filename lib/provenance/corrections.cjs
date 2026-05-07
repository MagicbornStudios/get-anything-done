'use strict';
/**
 * lib/provenance/corrections.cjs — operator-correction signal extractor.
 *
 * The most valuable training signal we have isn't surviving code — it's
 * operator pushback. Every "no", "stop", "wrong", "don't", "actually"
 * message tells the model what NOT to do. Pairing the correction with
 * the agent's previous attempt produces a (bad_attempt, correction,
 * fixed_attempt) tuple that's gold for fine-tuning.
 *
 * Source: Stop-hook events in .trace-archive/*.jsonl. Each Stop hook
 * fires after an assistant turn, so we can walk:
 *   user_message_N        ← contains correction phrase
 *   assistant_response_N  ← agent's response to correction
 *   (and look back for) assistant_response_(N-1)  ← what was being corrected
 *
 * Output: provenance events with kind="correction" appended to per-day
 * provenance JSONL. Labeler treats them as label="correction" — distinct
 * verdict from good/churn/in-progress.
 */

const fs = require('node:fs');
const path = require('node:path');
const { readJsonl, ymd, provenanceFilePath, ensureProvenanceDir } = require('./index.cjs');

const CORRECTION_PATTERNS = [
  /\bno\b/i,
  /\bstop\b/i,
  /\bwrong\b/i,
  /\bdon'?t\b/i,
  /\bnot like that\b/i,
  /\bactually\b/i,
  /\bwhy (would|did|do) you\b/i,
  /\bthat'?s not\b/i,
  /\bwhat the\s*(fuck|hell)\b/i,
  /\bwtf\b/i,
  /\bdumb\b/i,
  /\bbroken\b/i,
  /\bregression\b/i,
  /\brevert\b/i,
  /\bundo\b/i,
];

function isCorrection(text) {
  if (!text || typeof text !== 'string') return false;
  // Only consider the first 500 chars — operator typically corrects at the start
  const head = text.slice(0, 500);
  return CORRECTION_PATTERNS.some((re) => re.test(head));
}

/**
 * Walk archive + live trace, find Stop-hook events with model id, build
 * an in-order timeline of (user_message, assistant_response) per session.
 * For each user_message that matches a correction pattern, emit a
 * `correction` provenance event with the prior assistant response as
 * `bad_attempt` and the next assistant response as `fixed_attempt`.
 */
function extractCorrections({ planningDir }) {
  const archiveDir = path.join(planningDir, '.trace-archive');
  const traceJsonlPath = path.join(planningDir, '.trace-events.jsonl');
  const sources = [];
  if (fs.existsSync(archiveDir)) {
    for (const f of fs.readdirSync(archiveDir)) {
      if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) sources.push(path.join(archiveDir, f));
    }
  }
  if (fs.existsSync(traceJsonlPath)) sources.push(traceJsonlPath);

  // Walk all sources, build per-session message timeline
  // Stop-hook events have type ∈ {assistant_response, assistant_reasoning, user_message}
  // Some runtimes only emit assistant_response — user messages may not be in trace at all.
  // For projects where user messages ARE captured (Claude Code Stop hook), we get the gold.
  const bySession = new Map();  // session_id -> [{ts, type, text}]
  const seen = new Set();
  for (const src of sources) {
    for (const evt of readJsonl(src)) {
      const sid = evt.runtime && evt.runtime.session_id;
      const dedup = `${evt.seq || ''}:${sid || ''}:${evt.type || ''}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      if (!sid) continue;
      const t = evt.type;
      if (t !== 'assistant_response' && t !== 'assistant_reasoning' && t !== 'user_message') continue;
      const text = (typeof evt.message === 'string') ? evt.message
                 : (typeof evt.content === 'string') ? evt.content
                 : (typeof evt.text === 'string') ? evt.text
                 : (evt.message && typeof evt.message.content === 'string') ? evt.message.content
                 : null;
      if (!text) continue;
      if (!bySession.has(sid)) bySession.set(sid, []);
      bySession.get(sid).push({
        ts: evt.ts,
        type: t,
        text,
        model: (evt.runtime && evt.runtime.model) || null,
      });
    }
  }

  // Sort each session by ts
  for (const arr of bySession.values()) {
    arr.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }

  // Walk each session looking for user_message corrections
  const byDate = new Map();
  let corrections = 0;
  let userMessages = 0;
  let assistantMessages = 0;

  for (const [sid, msgs] of bySession.entries()) {
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].type === 'user_message') userMessages++;
      else assistantMessages++;
      if (msgs[i].type !== 'user_message') continue;
      if (!isCorrection(msgs[i].text)) continue;

      // Find preceding assistant_response (the bad attempt)
      let prev = null;
      for (let j = i - 1; j >= 0; j--) {
        if (msgs[j].type === 'assistant_response') { prev = msgs[j]; break; }
      }
      // Find following assistant_response (the fix)
      let next = null;
      for (let j = i + 1; j < msgs.length; j++) {
        if (msgs[j].type === 'assistant_response') { next = msgs[j]; break; }
      }

      const enriched = {
        event_id: `correction-${sid}-${i}-${msgs[i].ts}`,
        ts: msgs[i].ts,
        tool: 'correction',
        file_path: null,
        diff: {
          kind: 'correction',
          correction_text: msgs[i].text.slice(0, 4000),
          bad_attempt: prev ? prev.text.slice(0, 8000) : null,
          fixed_attempt: next ? next.text.slice(0, 8000) : null,
        },
        runtime: {
          id: 'claude-code',  // Stop-hook is Claude-only today
          model_id: msgs[i].model || (prev && prev.model) || (next && next.model) || null,
          session_id: sid,
          source: 'corrections-extractor',
        },
        agent: { id: null, role: null, parent: null, root: null, depth: null, model_profile: null, resolved_model: null },
        handoff: null,
        task: null,
        project: null,
        label: {
          verdict: 'correction',
          reason: `operator pushback matched pattern; ${prev ? 'has bad_attempt' : 'no prior'}; ${next ? 'has fixed_attempt' : 'no follow-up'}`,
          confidence: prev && next ? 0.95 : 0.7,
        },
      };
      const dateKey = ymd(new Date(msgs[i].ts));
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey).push(enriched);
      corrections++;
    }
  }

  // Append (de-dupe by event_id within each per-day file)
  ensureProvenanceDir(planningDir);
  let filesWritten = 0;
  for (const [dateKey, events] of byDate.entries()) {
    const outPath = provenanceFilePath(planningDir, dateKey);
    const existing = new Set();
    if (fs.existsSync(outPath)) {
      for (const e of readJsonl(outPath)) {
        if (e.event_id) existing.add(e.event_id);
      }
    }
    const fresh = events.filter((e) => !existing.has(e.event_id));
    if (fresh.length === 0) continue;
    fs.appendFileSync(outPath, fresh.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    filesWritten++;
  }

  return {
    sessions_scanned: bySession.size,
    user_messages: userMessages,
    assistant_messages: assistantMessages,
    corrections_found: corrections,
    files_written: filesWritten,
  };
}

module.exports = { extractCorrections, isCorrection, CORRECTION_PATTERNS };
