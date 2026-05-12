'use strict';
/**
 * spend-ledger.cjs — shared helper for appending rows to the cross-runtime
 * AI spend ledger at <repo-root>/.planning/datasets/ai-spend-ledger/<date>.jsonl
 *
 * Schema per row:
 *   { ts, runtime, model, prompt_tokens, completion_tokens, source, cwd }
 *
 * Phase 188-03 (GLOBAL-T-188-03).
 */

const fs = require('fs');
const path = require('path');

// Walk up from startDir looking for gad-config.toml or package.json to
// identify repo root. Falls back to startDir.
function findRepoRoot(startDir) {
  let dir = startDir || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, 'gad-config.toml')) ||
      fs.existsSync(path.join(dir, '.planning'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return startDir || process.cwd();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Append a spend row to the daily ledger file.
 *
 * @param {object} opts
 * @param {string} opts.runtime       — e.g. 'claude-code', 'codex-cli', 'gemini-cli'
 * @param {string|null} opts.model    — model id string or null if unknown
 * @param {number|null} opts.prompt_tokens
 * @param {number|null} opts.completion_tokens
 * @param {string} opts.source        — e.g. 'claude-stop-hook', 'codex-notify-hook'
 * @param {string} [opts.cwd]         — caller cwd; used for repo root walk
 */
function appendRow({ runtime, model, prompt_tokens, completion_tokens, source, cwd }) {
  try {
    const root = findRepoRoot(cwd || process.cwd());
    const ledgerDir = path.join(root, '.planning', 'datasets', 'ai-spend-ledger');
    fs.mkdirSync(ledgerDir, { recursive: true });
    const ledgerFile = path.join(ledgerDir, `${todayIso()}.jsonl`);
    const row = {
      ts: new Date().toISOString(),
      runtime: runtime || 'unknown',
      model: model || null,
      prompt_tokens: prompt_tokens != null ? prompt_tokens : null,
      completion_tokens: completion_tokens != null ? completion_tokens : null,
      source: source || 'unknown',
      cwd: cwd || process.cwd(),
    };
    fs.appendFileSync(ledgerFile, JSON.stringify(row) + '\n');
  } catch {
    // Never throw — spend logging must be best-effort
  }
}

module.exports = { appendRow, findRepoRoot };
