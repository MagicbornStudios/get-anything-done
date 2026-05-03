'use strict';
/**
 * lib/team/rate-limit.cjs — detect runtime rate-limit signals + manage cooldown.
 *
 * Patterns to detect from stderr / stdout:
 *   - codex-cli   : "You've hit your usage limit", "Upgrade to Pro"
 *   - gemini-cli  : "exhausted your capacity on this model", "quota will reset",
 *                   "RESOURCE_EXHAUSTED", "429"
 *   - cursor-cli  : "rate limit", "exceeded", "402", "429"
 *   - opencode    : "rate limit", "429", "quota"
 *   - generic     : "rate limit", "rate-limited", "429"
 *
 * When detected, the worker should:
 *   1. NOT mark the handoff failed (it should go back to open/ for another runtime).
 *   2. Park the runtime in cooldown for cooldownMs (default 15 min).
 *   3. Continue the worker loop with the next available runtime per the
 *      fallback chain in `.planning/team/runtime-fallbacks.json`.
 */

const fs = require('fs');
const path = require('path');

const RATE_LIMIT_PATTERNS = [
  // codex
  /You've hit your usage limit/i,
  /usage limit/i,
  /Upgrade to Pro/i,
  // gemini
  /exhausted your capacity on this model/i,
  /quota will reset/i,
  /RESOURCE_EXHAUSTED/i,
  /Quota exceeded/i,
  // cursor
  /Plan limit reached/i,
  // generic
  /\b429\b/,
  /rate[\s-]?limit/i,
  /Too Many Requests/i,
];

/**
 * Returns true if the captured output suggests the runtime is rate-limited.
 */
function isRateLimited(stderr, stdout) {
  const haystack = `${stderr || ''}\n${stdout || ''}`;
  return RATE_LIMIT_PATTERNS.some((re) => re.test(haystack));
}

/**
 * Cooldown registry — runtime → unix-ms expiry. JSON file at
 * `<baseDir>/.planning/team/runtime-cooldown.json`.
 */
function cooldownPath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-cooldown.json');
}

function loadCooldown(baseDir) {
  try {
    const raw = fs.readFileSync(cooldownPath(baseDir), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCooldown(baseDir, registry) {
  const p = cooldownPath(baseDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(registry, null, 2) + '\n', 'utf8');
}

/**
 * Park a runtime in cooldown until `now + cooldownMs`. Default 15 minutes.
 * Reasoning: providers' per-minute caps usually clear in 60s, but a paid-tier
 * "usage limit hit, try again at <hour>" might be much longer. 15 min is a
 * pragmatic middle — recovers fast from per-minute caps, gives space if it's
 * a real cap.
 */
function parkRuntime(baseDir, runtime, cooldownMs = 15 * 60 * 1000) {
  const reg = loadCooldown(baseDir);
  reg[runtime] = {
    until: Date.now() + cooldownMs,
    parked_at: new Date().toISOString(),
  };
  saveCooldown(baseDir, reg);
  return reg[runtime];
}

/**
 * True if this runtime is currently parked in cooldown.
 */
function isParked(baseDir, runtime) {
  const reg = loadCooldown(baseDir);
  const entry = reg[runtime];
  if (!entry) return false;
  if (Date.now() > entry.until) {
    // Cooldown expired — clean up.
    delete reg[runtime];
    saveCooldown(baseDir, reg);
    return false;
  }
  return true;
}

/**
 * Default runtime fallback chain. Reads from
 * `<baseDir>/.planning/team/runtime-fallbacks.json` if present, else returns
 * a hardcoded sensible default.
 */
function loadFallbackChain(baseDir, primary) {
  const p = path.join(baseDir, '.planning', 'team', 'runtime-fallbacks.json');
  let chains = null;
  try {
    chains = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    chains = {
      'codex-cli': ['gemini-cli', 'cursor-cli', 'opencode'],
      'gemini-cli': ['codex-cli', 'cursor-cli', 'opencode'],
      'cursor-cli': ['codex-cli', 'gemini-cli', 'opencode'],
      'opencode': ['gemini-cli', 'codex-cli', 'cursor-cli'],
    };
  }
  return chains[primary] || [];
}

/**
 * Pick the next available runtime from the fallback chain that isn't parked.
 * Returns null if all are parked.
 */
function nextAvailableRuntime(baseDir, primary) {
  if (!isParked(baseDir, primary)) return primary;
  const chain = loadFallbackChain(baseDir, primary);
  for (const candidate of chain) {
    if (!isParked(baseDir, candidate)) return candidate;
  }
  return null;
}

module.exports = {
  isRateLimited,
  parkRuntime,
  isParked,
  nextAvailableRuntime,
  loadFallbackChain,
  cooldownPath,
  RATE_LIMIT_PATTERNS,
};
