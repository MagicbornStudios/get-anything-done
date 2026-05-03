'use strict';
/**
 * lib/team/config.cjs - team config.json read/write + runtime resolution.
 *
 * Schema v2 (adds workers_spec):
 *   {
 *     workers: 3,                     // number of workers (redundant with workers_spec length)
 *     roles: ["executor", ...],       // legacy flat list, still honored as fallback
 *     workers_spec: [                 // NEW in M3.4 - preferred
 *       { id: "w1", role: "executor", lane: null,      runtime: "claude-code", runtime_cmd: null },
 *       { id: "w2", role: "reviewer", lane: "backend", runtime: "codex-cli",   runtime_cmd: null },
 *     ],
 *     runtime: "claude-code",         // team default, fallback when workers_spec entry omits runtime
 *     runtime_cmd: null,              // team default CLI override
 *     autopause_threshold: 20,
 *     tick_ms: 2000,
 *     runtime_tick_overrides: {       // optional per-runtime worker poll overrides
 *       "gemini-cli": 8000,
 *       "codex-cli": 2000
 *     },
 *     created_at, supervisor_pid
 *   }
 */

const { readJsonSafe, writeJson } = require('./io.cjs');
const { configPath } = require('./paths.cjs');

const DEFAULT_TICK_MS = 2000;
const DEFAULT_RUNTIME_TICK_OVERRIDES = Object.freeze({
  'gemini-cli': 8000,
  'codex-cli': 2000,
});

function defaultRuntimeCmd(runtime) {
  if (runtime === 'codex-cli') return 'codex exec';
  if (runtime === 'gemini-cli') return 'gemini';
  return 'claude -p';
}

function maybeWrapCodexTelemetry(runtime, runtimeCmd) {
  if (runtime !== 'codex-cli') return runtimeCmd;
  if (process.env.GAD_SESSION_TELEMETRY !== '1') return runtimeCmd;
  if (/\bcodex-session-emit\.cjs\b/i.test(runtimeCmd)) return runtimeCmd;
  return `node scripts/codex-session-emit.cjs -- ${runtimeCmd}`;
}

function readConfig(baseDir) {
  return readJsonSafe(configPath(baseDir), null);
}

function writeConfig(baseDir, cfg) {
  writeJson(configPath(baseDir), cfg);
}

function workerSpec(cfg, id) {
  if (cfg && Array.isArray(cfg.workers_spec)) {
    const hit = cfg.workers_spec.find((worker) => worker.id === id);
    if (hit) return hit;
  }
  const n = Number(String(id).replace(/^w/, '')) || 1;
  const role = (cfg && cfg.roles && cfg.roles[n - 1]) || 'executor';
  return { id, role, lane: null, runtime: (cfg && cfg.runtime) || 'claude-code', runtime_cmd: null };
}

function resolveRuntimeCmd(cfg, workerId) {
  const spec = workerId ? workerSpec(cfg, workerId) : null;
  const runtime = (spec && spec.runtime) || (cfg && cfg.runtime) || 'claude-code';
  const rawCmd = process.env.GAD_TEAM_RUNTIME_CMD
    || (spec && spec.runtime_cmd)
    || (cfg && cfg.runtime_cmd)
    || defaultRuntimeCmd(runtime);
  return maybeWrapCodexTelemetry(runtime, rawCmd);
}

function resolveRuntime(cfg, workerId) {
  const spec = workerId ? workerSpec(cfg, workerId) : null;
  return (spec && spec.runtime) || (cfg && cfg.runtime) || 'claude-code';
}

function normalizeRuntimeTickOverrides(cfg) {
  const merged = {
    ...DEFAULT_RUNTIME_TICK_OVERRIDES,
    ...((cfg && cfg.runtime_tick_overrides && typeof cfg.runtime_tick_overrides === 'object')
      ? cfg.runtime_tick_overrides
      : {}),
  };
  const normalized = {};
  for (const [runtime, rawMs] of Object.entries(merged)) {
    const ms = Number(rawMs);
    if (Number.isFinite(ms) && ms > 0) normalized[runtime] = ms;
  }
  return normalized;
}

function resolveTickMs(cfg, workerId) {
  if (process.env.GAD_TEAM_TICK_MS) {
    return Number(process.env.GAD_TEAM_TICK_MS) || DEFAULT_TICK_MS;
  }
  const runtime = workerId ? resolveRuntime(cfg, workerId) : null;
  const runtimeOverrides = normalizeRuntimeTickOverrides(cfg);
  if (runtime && runtimeOverrides[runtime]) return runtimeOverrides[runtime];
  return Number((cfg && cfg.tick_ms) || DEFAULT_TICK_MS) || DEFAULT_TICK_MS;
}

module.exports = {
  DEFAULT_TICK_MS,
  DEFAULT_RUNTIME_TICK_OVERRIDES,
  defaultRuntimeCmd,
  maybeWrapCodexTelemetry,
  readConfig,
  writeConfig,
  workerSpec,
  resolveRuntimeCmd,
  resolveRuntime,
  resolveTickMs,
  normalizeRuntimeTickOverrides,
};
