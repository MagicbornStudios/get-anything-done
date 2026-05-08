/**
 * scripts/runtime-adapters/opencode.mjs
 *
 * Response parser for the opencode runtime (OpenCode AI IDE / CLI).
 *
 * Opencode is primarily interactive and does not expose a standardized
 * --json output format in the same way claude/codex/gemini do. Model
 * identification for opencode follows this priority order:
 *
 *   1. Stdout JSON with a `model` field (if opencode produces structured output)
 *   2. Config file at ~/.config/opencode/config.json (provider.model field)
 *   3. OPENCODE_MODEL env var (user-set override)
 *   4. null (genuinely unknown — do not guess)
 *
 * Token counts are similarly best-effort: opencode may embed usage in a
 * structured JSON block at the end of stdout. If not present, tokens_in
 * and tokens_out remain null.
 *
 * Config file shape (common):
 *   { "model": "anthropic/claude-sonnet-4-6" }
 *   { "provider": { "model": "openai/gpt-5" } }
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Parse a raw stdout string from opencode into a
 * { model_id, tokens_in, tokens_out } telemetry payload.
 *
 * @param {string} stdout         - raw stdout captured from opencode invocation
 * @param {object} [opts]
 * @param {string} [opts.configPath] - override path to opencode config.json
 * @param {object} [opts.env]        - env vars (default: process.env)
 * @returns {{ model_id: string|null, tokens_in: number|null, tokens_out: number|null }}
 */
export function parseResponse(stdout, opts = {}) {
  const result = {
    model_id: null,
    tokens_in: null,
    tokens_out: null,
  };

  // 1. Try to extract from stdout JSON
  if (typeof stdout === 'string' && stdout.trim()) {
    _extractFromStdout(stdout, result);
  }

  // 2. If still no model_id, read from config file
  if (!result.model_id) {
    const configPath = opts.configPath || _defaultConfigPath();
    _extractFromConfig(configPath, result);
  }

  // 3. Env var override for model_id (highest precedence for model only)
  const env = opts.env || process.env;
  if (env.OPENCODE_MODEL) {
    result.model_id = String(env.OPENCODE_MODEL);
  }

  return result;
}

/**
 * Read model_id from opencode config file without touching stdout.
 * Returns null if config is absent or unreadable.
 *
 * @param {string} [configPath]
 * @returns {string|null}
 */
export function readModelFromConfig(configPath) {
  const p = configPath || _defaultConfigPath();
  return _extractModelFromConfigPath(p);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _defaultConfigPath() {
  return path.join(os.homedir(), '.config', 'opencode', 'config.json');
}

function _extractFromStdout(stdout, result) {
  // Scan JSONL lines; accept any line with a model field
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || typeof entry !== 'object') continue;

    if (entry.model && !result.model_id) {
      result.model_id = String(entry.model);
    }
    // Token usage in opencode structured output
    const usage = entry.usage || null;
    if (usage && typeof usage === 'object') {
      if (usage.input_tokens != null && result.tokens_in === null) {
        result.tokens_in = Number(usage.input_tokens) || null;
      } else if (usage.prompt_tokens != null && result.tokens_in === null) {
        result.tokens_in = Number(usage.prompt_tokens) || null;
      }
      if (usage.output_tokens != null && result.tokens_out === null) {
        result.tokens_out = Number(usage.output_tokens) || null;
      } else if (usage.completion_tokens != null && result.tokens_out === null) {
        result.tokens_out = Number(usage.completion_tokens) || null;
      }
    }
    if (result.model_id) break;
  }
}

function _extractFromConfig(configPath, result) {
  const modelId = _extractModelFromConfigPath(configPath);
  if (modelId && !result.model_id) {
    result.model_id = modelId;
  }
}

function _extractModelFromConfigPath(configPath) {
  if (!configPath) return null;
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    return null;
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!config || typeof config !== 'object') return null;

  // model at top level
  if (config.model && typeof config.model === 'string') return config.model;
  // provider.model nested
  if (config.provider && typeof config.provider === 'object' && config.provider.model) {
    return String(config.provider.model);
  }
  // providers array (opencode 0.x)
  if (Array.isArray(config.providers)) {
    for (const p of config.providers) {
      if (p && p.default && p.model) return String(p.model);
    }
    // first provider with a model field
    for (const p of config.providers) {
      if (p && p.model) return String(p.model);
    }
  }

  return null;
}
