#!/usr/bin/env node
/**
 * GAD Stop hook — Claude Code Stop / SubagentStop handler.
 *
 * Phase 145 (slm-training-data-collection-v1) task GLOBAL-T-145-04.
 *
 * Invoked by Claude Code's hook runtime when the assistant ends a turn.
 * The existing PreToolUse/PostToolUse trace hook captures tool calls but
 * NOT assistant response text or reasoning streams — without those, the
 * SLM-training dataset has no model outputs to train on. This hook fills
 * the load-bearing gap.
 *
 * Reads the Stop payload from stdin. Walks the transcript_path, extracts
 * the most recent assistant turn(s) since the last Stop event, emits
 * `kind=assistant_response` and `kind=assistant_reasoning` events into
 * <project-root>/.planning/.trace-events.jsonl. Adapter S2 (phase 145
 * task T-145-02) lifts those into envelopes with role=response /
 * role=reasoning.
 *
 * Stdin contract (Claude Code hook format):
 *   {
 *     "hook_event_name": "Stop" | "SubagentStop",
 *     "session_id": "...",
 *     "transcript_path": "C:/.../session-<id>.jsonl",
 *     "cwd": "...",
 *     "stop_hook_active": false  // or true if we re-blocked
 *   }
 *
 * Exit codes:
 *   0 = event written (or skipped silently for no-op cases)
 *   never block the agent — Stop hook should not exit non-zero
 *
 * Wired by `gad install hooks` once T-145-04 install integration lands;
 * until then, operator can install manually via ~/.claude/settings.json:
 *   "hooks": {
 *     "Stop": [{
 *       "matcher": "",
 *       "hooks": [{ "type": "command",
 *         "command": "node <abs-path>/vendor/get-anything-done/bin/gad-stop-hook.cjs" }]
 *     }]
 *   }
 *
 * Referenced by phase 145 plan T-145-04, decisions GLOBAL-D-58/59/60.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TRACE_FILE = '.planning/.trace-events.jsonl';
const SEQ_FILE = '.planning/.trace-seq';
const STOP_CURSOR_FILE = '.planning/.stop-hook-cursor.json';
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_REASONING_BYTES = 256 * 1024;

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

function nextSeq(projectRoot) {
  const p = path.join(projectRoot, SEQ_FILE);
  let cur = 0;
  try {
    if (fs.existsSync(p)) {
      cur = Number(fs.readFileSync(p, 'utf8').trim()) || 0;
    }
  } catch (e) {}
  const n = cur + 1;
  try { fs.writeFileSync(p, String(n)); } catch (e) {}
  return n;
}

function loadCursor(projectRoot, sessionId) {
  const p = path.join(projectRoot, STOP_CURSOR_FILE);
  try {
    const all = JSON.parse(fs.readFileSync(p, 'utf8'));
    return all[sessionId] || { last_line: 0, last_uuid: null };
  } catch (e) {
    return { last_line: 0, last_uuid: null };
  }
}

function saveCursor(projectRoot, sessionId, cursor) {
  const p = path.join(projectRoot, STOP_CURSOR_FILE);
  let all = {};
  try {
    all = JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch (e) {}
  all[sessionId] = cursor;
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(all, null, 2));
  } catch (e) {}
}

function truncate(text, maxBytes) {
  if (typeof text !== 'string') return { text: '', truncated: false };
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= maxBytes) return { text, truncated: false };
  return { text: buf.slice(0, maxBytes).toString('utf8') + '\n...[truncated]', truncated: true };
}

/**
 * Walk a Claude Code transcript JSONL, return assistant turns added
 * since the cursor. Each line is `{ type: "user"|"assistant"|...,
 * message: { content: [...] }, uuid, ... }`.
 */
function readNewAssistantTurns(transcriptPath, cursor) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { turns: [], newCursor: cursor };
  }
  const content = fs.readFileSync(transcriptPath, 'utf8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const turns = [];
  let lineNum = 0;
  for (const line of lines) {
    lineNum += 1;
    if (lineNum <= cursor.last_line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch (e) { continue; }
    if (!entry || entry.type !== 'assistant') continue;
    if (!entry.message || !Array.isArray(entry.message.content)) continue;
    turns.push({ entry, lineNum });
  }
  const newCursor = { last_line: lineNum, last_uuid: lines.length > 0 ? null : cursor.last_uuid };
  // Track last seen uuid for fwd-compat (in case line numbers shift on
  // transcript compaction).
  if (turns.length > 0) {
    const last = turns[turns.length - 1];
    if (last.entry.uuid) newCursor.last_uuid = last.entry.uuid;
  }
  return { turns, newCursor };
}

/**
 * Extract response text and reasoning blocks from an assistant turn.
 * Claude Code transcript content blocks shape:
 *   { type: "text", text: "..." }
 *   { type: "thinking", thinking: "..." }
 *   { type: "tool_use", name, input, id } — already captured by trace hook, skip
 */
function extractAssistantOutputs(messageContent) {
  const responseTexts = [];
  const reasoningTexts = [];
  for (const block of messageContent) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'text' && typeof block.text === 'string') {
      responseTexts.push(block.text);
    } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
      reasoningTexts.push(block.thinking);
    }
  }
  return {
    response: responseTexts.join('\n'),
    reasoning: reasoningTexts.join('\n'),
  };
}

function appendEvent(traceFile, event) {
  try {
    fs.mkdirSync(path.dirname(traceFile), { recursive: true });
    fs.appendFileSync(traceFile, JSON.stringify(event) + '\n');
  } catch (e) {
    // Hook must never block agent — log to stderr and move on.
    process.stderr.write(`[gad-stop-hook] append failed: ${e.message}\n`);
  }
}

// --------------------------------------------------------------------
// Main
// --------------------------------------------------------------------

function main() {
  const raw = readStdinSync();
  if (!raw.trim()) {
    process.exit(0);
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[gad-stop-hook] bad payload: ${e.message}\n`);
    process.exit(0);
  }

  const sessionId = payload.session_id || 'unknown-session';
  const transcriptPath = payload.transcript_path || '';
  const hookName = payload.hook_event_name || 'Stop';
  const cwd = payload.cwd || process.cwd();
  const projectRoot = findProjectRoot(cwd);
  const traceFile = path.join(projectRoot, TRACE_FILE);

  // Sample raw payload to tmp on first run for fixture-building per
  // phase 145 risk #1 (Stop payload shape undocumented). Only on first
  // ever run (fixture file absence).
  const fixtureDir = path.join(projectRoot, '.planning', '.stop-hook-fixtures');
  const fixtureFile = path.join(fixtureDir, 'first-payload.json');
  if (!fs.existsSync(fixtureFile)) {
    try {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(fixtureFile, JSON.stringify(payload, null, 2));
    } catch (e) {}
  }

  const cursor = loadCursor(projectRoot, sessionId);
  const { turns, newCursor } = readNewAssistantTurns(transcriptPath, cursor);

  for (const { entry } of turns) {
    const { response, reasoning } = extractAssistantOutputs(entry.message.content);
    const ts = entry.timestamp || new Date().toISOString();
    const baseEvent = {
      ts,
      seq: nextSeq(projectRoot),
      runtime: { id: 'claude-code', source: 'stop-hook', model: entry.message.model || null, session_id: sessionId },
      agent: {
        agent_id: null, agent_role: null,
        parent_agent_id: null, root_agent_id: null,
        depth: null, model_profile: null, resolved_model: null,
      },
      hook: hookName,
      message_uuid: entry.uuid || null,
    };
    if (response.trim().length > 0) {
      const t = truncate(response, MAX_RESPONSE_BYTES);
      appendEvent(traceFile, {
        ...baseEvent,
        type: 'assistant_response',
        seq: baseEvent.seq,
        content: { text: t.text },
        truncated: t.truncated,
      });
    }
    if (reasoning.trim().length > 0) {
      const t = truncate(reasoning, MAX_REASONING_BYTES);
      appendEvent(traceFile, {
        ...baseEvent,
        type: 'assistant_reasoning',
        seq: nextSeq(projectRoot),
        content: { text: t.text },
        truncated: t.truncated,
      });
    }
  }

  saveCursor(projectRoot, sessionId, newCursor);

  process.exit(0);
}

main();
