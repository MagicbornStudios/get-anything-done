'use strict';
/**
 * lib/team/config.cjs — team config.json read/write + runtime resolution.
 *
 * Schema v2 (adds workers_spec):
 *   {
 *     workers: 3,                     // number of workers (redundant with workers_spec length)
 *     roles: ["executor", ...],       // legacy flat list, still honored as fallback
 *     workers_spec: [                 // NEW in M3.4 — preferred
 *       { id: "w1", role: "executor", lane: null,      runtime: "claude-code", runtime_cmd: null },
 *       { id: "w2", role: "reviewer", lane: "backend", runtime: "codex-cli",   runtime_cmd: null },
 *     ],
 *     runtime: "claude-code",         // team default, fallback when workers_spec entry omits runtime
 *     runtime_cmd: null,              // team default CLI override
 *     autopause_threshold: 20,
 *     tick_ms: 2000,
 *     created_at, supervisor_pid
 *   }
 */

const { readJsonSafe, writeJson } = require('./io.cjs');
const { configPath } = require('./paths.cjs');

const DEFAULT_TICK_MS = 2000;

function defaultRuntimeCmd(runtime) {
  if (runtime === 'codex-cli') return 'codex exec';
  if (runtime === 'gemini-cli') return 'gemini';
  return 'claude -p';
}

function readConfig(baseDir) {
  return readJsonSafe(configPath(baseDir), null);
}

function writeConfig(baseDir, cfg) {
  writeJson(configPath(baseDir), cfg);
}

function workerSpec(cfg, id) {
  if (cfg && Array.isArray(cfg.workers_spec)) {
    const hit = cfg.workers_spec.find(w => w.id === id);
    if (hit) return hit;
  }
  // Legacy path: derive from flat roles[] index
  const n = Number(String(id).replace(/^w/, '')) || 1;
  const role = (cfg && cfg.roles && cfg.roles[n - 1]) || 'executor';
  return { id, role, lane: null, runtime: (cfg && cfg.runtime) || 'claude-code', runtime_cmd: null };
}

function resolveRuntimeCmd(cfg, workerId) {
  // Precedence: env → per-worker runtime_cmd → team runtime_cmd → per-worker runtime default → team runtime default
  if (process.env.GAD_TEAM_RUNTIME_CMD) return process.env.GAD_TEAM_RUNTIME_CMD;
  const spec = workerId ? workerSpec(cfg, workerId) : null;
  if (spec && spec.runtime_cmd) return spec.runtime_cmd;
  if (cfg && cfg.runtime_cmd) return cfg.runtime_cmd;
  const runtime = (spec && spec.runtime) || (cfg && cfg.runtime) || 'claude-code';
  return defaultRuntimeCmd(runtime);
}

function resolveRuntime(cfg, workerId) {
  const spec = workerId ? workerSpec(cfg, workerId) : null;
  return (spec && spec.runtime) || (cfg && cfg.runtime) || 'claude-code';
}

function resolveTickMs(cfg) {
  return Number(process.env.GAD_TEAM_TICK_MS || (cfg && cfg.tick_ms) || DEFAULT_TICK_MS) || DEFAULT_TICK_MS;
}

module.exports = {
  DEFAULT_TICK_MS,
  defaultRuntimeCmd,
  readConfig,
  writeConfig,
  workerSpec,
  resolveRuntimeCmd,
  resolveRuntime,
  resolveTickMs,
};
