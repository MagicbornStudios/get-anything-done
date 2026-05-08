'use strict';
/**
 * scripts/claude-session-emit.cjs — Phase 89-02 producer hook.
 *
 * Designed to be invoked as a claude-code hook (SessionStart, SessionEnd,
 * PreToolUse, PostToolUse, etc.). Reads a single JSON event from stdin
 * (or from CLAUDE_HOOK_EVENT env var), emits it to the project's raw
 * events file, then ALSO appends it to the session-telemetry JSONL so
 * agents can query it via `gad sessions stats/tail`.
 *
 * Usage (in claude hooks config):
 *   { "command": "node vendor/get-anything-done/scripts/claude-session-emit.cjs" }
 *
 * Env vars honoured:
 *   CLAUDE_HOOK_EVENT   — JSON string of the hook payload (fallback when stdin
 *                         is not a piped stream)
 *   GAD_SESSION_TELEMETRY_ROOT — override project root (optional)
 *
 * Telemetry append is fire-and-forget: any error is swallowed so that
 * the hook never delays or breaks the claude-code workflow.
 *
 * Raw events are also written to:
 *   <projectRoot>/.planning/.sessions/<sessionId>/events.jsonl
 * (same as pre-89 behaviour — not removed).
 */

const fs = require('node:fs');
const path = require('node:path');

// ── relative require of telemetry substrate ──────────────────────────────────
// __dirname is vendor/get-anything-done/scripts/
const TELEMETRY_INDEX = path.resolve(__dirname, '..', 'lib', 'session-telemetry', 'index.cjs');
const ADAPTER_PATH   = path.resolve(__dirname, '..', 'lib', 'session-telemetry', 'adapters', 'claude-code.cjs');

let appendTelemetryEvent;
let adaptClaudeCodeEmit;
try {
  ({ appendTelemetryEvent } = require(TELEMETRY_INDEX));
  ({ adaptClaudeCodeEmit }  = require(ADAPTER_PATH));
} catch {
  // Substrate not available — hook still works for raw emit, telemetry silently skipped.
}

// ── helpers ──────────────────────────────────────────────────────────────────

function nowIso() { return new Date().toISOString(); }

function findProjectRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function rawEventsFile(projectRoot, sessionId) {
  return path.join(projectRoot, '.planning', '.sessions', sessionId, 'events.jsonl');
}

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

// ── read hook payload ─────────────────────────────────────────────────────────

function readPayload() {
  // Try CLAUDE_HOOK_EVENT env var first (set by claude-code in some modes)
  const envRaw = process.env.CLAUDE_HOOK_EVENT;
  if (envRaw) {
    try { return JSON.parse(envRaw); } catch {}
  }

  // Fall back to reading all of stdin synchronously
  let raw = '';
  try {
    // Only attempt sync read if stdin is actually piped
    if (process.stdin.isTTY) return null;
    raw = fs.readFileSync('/dev/stdin', 'utf8');
    // Windows: /dev/stdin not available; buffer 0 for TTY
  } catch {
    try {
      // Windows fallback: try fd 0 directly
      const buf = Buffer.alloc(65536);
      let total = 0;
      let n;
      while ((n = fs.readSync(0, buf, total, buf.length - total, null)) > 0) {
        total += n;
      }
      raw = buf.slice(0, total).toString('utf8');
    } catch {}
  }

  raw = (raw || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── append to raw events file (pre-89 behaviour, preserved) ──────────────────

function appendRawEvent(projectRoot, event) {
  try {
    const sessionId = String(event.session_id || event.sessionId || 'unknown');
    const file = rawEventsFile(projectRoot, sessionId);
    ensureDir(path.dirname(file));
    fs.appendFileSync(file, JSON.stringify(event) + '\n', 'utf8');
  } catch {}
}

// ── append to session telemetry (89-02 addition) ─────────────────────────────

function appendToTelemetry(projectRoot, rawEvent) {
  if (!appendTelemetryEvent || !adaptClaudeCodeEmit) return;
  try {
    const records = adaptClaudeCodeEmit(rawEvent);
    for (const rec of records) {
      try {
        appendTelemetryEvent({ ...rec, projectRoot });
      } catch {}
    }
  } catch {}
}

// ── main ──────────────────────────────────────────────────────────────────────

function main() {
  const event = readPayload();
  if (!event || typeof event !== 'object') {
    // Nothing to do — not a JSON event
    process.exit(0);
  }

  // Normalise timestamp
  if (!event.ts) event.ts = nowIso();

  const projectRoot = process.env.GAD_SESSION_TELEMETRY_ROOT || findProjectRoot(process.cwd());

  if (!projectRoot) {
    // Can't resolve root — exit cleanly so claude-code isn't blocked
    process.exit(0);
  }

  // 1. Raw emit (pre-89 behaviour — preserved)
  appendRawEvent(projectRoot, event);

  // 2. Telemetry append (89-02 addition — fire-and-forget)
  appendToTelemetry(projectRoot, event);

  process.exit(0);
}

main();
