'use strict';
/**
 * gad team scale - add/remove workers without hand-editing config.json.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

const { readConfig, resolveRuntimeCmd } = require('../../../lib/team/config.cjs');
const { appendJsonl } = require('../../../lib/team/io.cjs');
const { stopFlagPath, supervisorLog, workerMailbox, workerOutDir, workerStatus } = require('../../../lib/team/paths.cjs');
const { readStatus, writeStatus, compareWorkerIds } = require('../../../lib/team/status.cjs');
const { spawnWorker } = require('../../../lib/team/spawn.cjs');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseWorkerNumber(id) {
  const match = /^w(\d+)$/.exec(String(id || ''));
  return match ? Number(match[1]) : null;
}

function collectWorkerSpecs(cfg) {
  if (cfg && Array.isArray(cfg.workers_spec) && cfg.workers_spec.length > 0) {
    return cfg.workers_spec.map((spec) => ({ ...spec }));
  }
  const count = Math.max(
    Number.parseInt(String(cfg && cfg.workers), 10) || 0,
    Array.isArray(cfg && cfg.roles) ? cfg.roles.length : 0,
  );
  const specs = [];
  for (let i = 1; i <= count; i += 1) {
    specs.push({
      id: `w${i}`,
      role: (cfg && cfg.roles && cfg.roles[i - 1]) || 'executor',
      lane: null,
      runtime: (cfg && cfg.runtime) || 'claude-code',
      runtime_cmd: null,
    });
  }
  return specs;
}

function buildConfig(cfg, workersSpec) {
  const nextSpec = workersSpec.slice().sort((a, b) => compareWorkerIds(a.id, b.id));
  return {
    ...cfg,
    workers: nextSpec.length,
    roles: nextSpec.map((spec) => spec.role || 'executor'),
    workers_spec: nextSpec,
  };
}

function writeConfigAtomic(baseDir, cfg) {
  const file = path.join(baseDir, '.planning', 'team', 'config.json');
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, file);
}

function summarizeTeam(cfg) {
  const counts = new Map();
  for (const spec of collectWorkerSpecs(cfg)) {
    const runtime = spec.runtime || cfg.runtime || 'claude-code';
    counts.set(runtime, (counts.get(runtime) || 0) + 1);
  }
  const breakdown = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([runtime, count]) => `${runtime}=${count}`)
    .join(', ');
  return `${cfg.workers} worker${cfg.workers === 1 ? '' : 's'}${breakdown ? ` (${breakdown})` : ''}`;
}

function ensureExclusiveModes(args, outputError) {
  const used = [];
  if (String(args.add) !== '') used.push('--add');
  if (String(args.remove || '').trim()) used.push('--remove');
  if (String(args.to) !== '') used.push('--to');
  if (used.length !== 1) {
    outputError('Pass exactly one of --add <N>, --remove <ids>, or --to <N>.');
    process.exit(1);
  }
}

function parseNonNegativeInt(value, flag, outputError) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) {
    outputError(`${flag} must be a non-negative integer.`);
    process.exit(1);
  }
  return n;
}

function parseRemoveIds(csv, validIds, outputError) {
  const ids = String(csv)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    outputError('--remove requires one or more worker ids, e.g. --remove w4,w5.');
    process.exit(1);
  }
  const seen = new Set();
  for (const id of ids) {
    if (!/^w\d+$/.test(id)) {
      outputError(`Invalid worker id: ${id}. Expected w<N>.`);
      process.exit(1);
    }
    if (!validIds.has(id)) {
      outputError(`Unknown worker: ${id}`);
      process.exit(1);
    }
    if (seen.has(id)) {
      outputError(`Duplicate worker id in --remove: ${id}`);
      process.exit(1);
    }
    seen.add(id);
  }
  return ids.sort(compareWorkerIds);
}

function nextWorkerId(specs) {
  let max = 0;
  for (const spec of specs) {
    const n = parseWorkerNumber(spec.id);
    if (n != null && n > max) max = n;
  }
  return `w${max + 1}`;
}

function makeNewWorkerSpec(id, runtime, extras = {}) {
  const spec = {
    id,
    role: extras.role || 'executor',
    lane: extras.lane || null,
    runtime,
    runtime_cmd: null,
  };
  // GLOBAL-D-406: persist per-worker agent-profile + overrides so the model
  // is no longer dropped and soul/skills resolve at spawn time.
  if (extras.agentProfile) spec.agent_profile = extras.agentProfile;
  if (extras.soul) spec.soul = extras.soul;
  if (extras.model) spec.model = extras.model;
  if (Array.isArray(extras.skills) && extras.skills.length) spec.skills = extras.skills;
  return spec;
}

async function waitForWorkerStop(baseDir, id, waitMs) {
  const deadline = Date.now() + Math.max(0, waitMs);
  while (Date.now() < deadline) {
    const status = readStatus(baseDir, id);
    if (!status || status.state === 'STOPPED') return true;
    await sleep(300);
  }
  const finalStatus = readStatus(baseDir, id);
  return !finalStatus || finalStatus.state === 'STOPPED';
}

function forceTerminateWorker(baseDir, id) {
  const status = readStatus(baseDir, id);
  if (!status || !status.pid) return false;
  try {
    process.kill(status.pid);
    return true;
  } catch {
    return false;
  }
}

function cleanupRemovedWorkerState(baseDir, id) {
  try { fs.rmSync(workerStatus(baseDir, id), { force: true }); } catch {}
  try { fs.rmSync(workerMailbox(baseDir, id), { recursive: true, force: true }); } catch {}
}

function spawnConfiguredWorker(baseDir, cfg, id, gadBinary, options = {}) {
  const spec = collectWorkerSpecs(cfg).find((entry) => entry.id === id);
  if (!spec) throw new Error(`Cannot spawn unknown worker ${id}`);
  fs.mkdirSync(workerMailbox(baseDir, id), { recursive: true });
  fs.mkdirSync(workerOutDir(baseDir, id), { recursive: true });
  writeStatus(baseDir, id, {
    id,
    role: spec.role || 'executor',
    lane: spec.lane || null,
    runtime: spec.runtime || cfg.runtime,
    runtime_cmd: resolveRuntimeCmd(cfg, id, baseDir),
    pid: null,
    started_at: null,
    last_heartbeat: null,
    current_ref: null,
    state: 'NOT_STARTED',
  });
  return spawnWorker(baseDir, id, gadBinary, options);
}

function createScaleCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  function resolveTeamTarget(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return { baseDir: repoRoot, projectid: pidArg || '' };
    return { baseDir: path.join(repoRoot, root.path), projectid: root.id || pidArg || '' };
  }

  return defineCommand({
    meta: { name: 'scale', description: 'Add, remove, or resize team workers.' },
    args: {
      projectid: { type: 'string', description: 'Target project id (resolves .planning/team/ path)', default: '' },
      add: { type: 'string', description: 'Add N workers.', default: '' },
      remove: { type: 'string', description: 'Remove worker ids, comma-separated.', default: '' },
      to: { type: 'string', description: 'Scale to N total workers.', default: '' },
      runtime: { type: 'string', description: 'Runtime override for newly added workers.', default: '' },
      lane: { type: 'string', description: 'Lane for newly added workers.', default: '' },
      'agent-profile': { type: 'string', description: 'Agent-profile preset id for new workers (GLOBAL-D-406).', default: '' },
      soul: { type: 'string', description: 'Soul slug for new workers (overrides profile).', default: '' },
      model: { type: 'string', description: 'Model id for new workers (overrides profile).', default: '' },
      role: { type: 'string', description: 'Role for new workers (executor|reasoner).', default: '' },
      skills: { type: 'string', description: 'Comma-separated skill slugs for new workers.', default: '' },
      'wait-ms': { type: 'string', description: 'Graceful shutdown wait before force cleanup.', default: '10000' },
    },
    async run({ args }) {
      ensureExclusiveModes(args, outputError);
      const { baseDir, projectid } = resolveTeamTarget(args);
      const cfg = readConfig(baseDir);
      if (!cfg) {
        outputError('No team configured. Run `gad team start` first.');
        process.exit(1);
      }

      const currentSpec = collectWorkerSpecs(cfg);
      const validIds = new Set(currentSpec.map((spec) => spec.id));
      const runtimeForNewWorkers = String(args.runtime || '').trim() || cfg.runtime || 'claude-code';
      const newWorkerExtras = {
        lane: String(args.lane || '').trim() || null,
        agentProfile: String(args['agent-profile'] || '').trim() || null,
        soul: String(args.soul || '').trim() || null,
        model: String(args.model || '').trim() || null,
        role: String(args.role || '').trim() || null,
        skills: String(args.skills || '').split(',').map((s) => s.trim()).filter(Boolean),
      };
      const waitMs = parseNonNegativeInt(args['wait-ms'], '--wait-ms', outputError);

      let removeIds = [];
      const nextSpec = currentSpec.slice();

      if (String(args.add) !== '') {
        const addCount = parseNonNegativeInt(args.add, '--add', outputError);
        for (let i = 0; i < addCount; i += 1) {
          const id = nextWorkerId(nextSpec);
          nextSpec.push(makeNewWorkerSpec(id, runtimeForNewWorkers, newWorkerExtras));
        }
      } else if (String(args.to) !== '') {
        const target = parseNonNegativeInt(args.to, '--to', outputError);
        if (target > nextSpec.length) {
          const addCount = target - nextSpec.length;
          for (let i = 0; i < addCount; i += 1) {
            const id = nextWorkerId(nextSpec);
            nextSpec.push(makeNewWorkerSpec(id, runtimeForNewWorkers, newWorkerExtras));
          }
        } else if (target < nextSpec.length) {
          removeIds = nextSpec
            .map((spec) => spec.id)
            .sort((a, b) => compareWorkerIds(b, a))
            .slice(0, nextSpec.length - target);
        }
      } else {
        removeIds = parseRemoveIds(args.remove, validIds, outputError);
      }

      if (removeIds.length > 0) {
        const removeSet = new Set(removeIds);
        for (let i = nextSpec.length - 1; i >= 0; i -= 1) {
          if (removeSet.has(nextSpec[i].id)) nextSpec.splice(i, 1);
        }
      }

      const addedIds = nextSpec
        .map((spec) => spec.id)
        .filter((id) => !validIds.has(id));
      const postCfg = buildConfig(cfg, nextSpec);

      if (addedIds.length > 0 || removeIds.length > 0) {
        writeConfigAtomic(baseDir, postCfg);
      }

      const gadBinary = path.resolve(__dirname, '..', '..', 'gad.cjs');
      const spawned = [];
      for (const id of addedIds) {
        const pid = spawnConfiguredWorker(baseDir, postCfg, id, gadBinary, { cliArgs: projectid ? ['--projectid', projectid] : [] });
        spawned.push({ id, pid });
      }

      for (const id of removeIds) {
        fs.mkdirSync(path.dirname(stopFlagPath(baseDir, id)), { recursive: true });
        fs.writeFileSync(stopFlagPath(baseDir, id), new Date().toISOString());
        appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'scale-stop', worker_id: id });
        const stopped = await waitForWorkerStop(baseDir, id, waitMs);
        if (!stopped) {
          const killed = forceTerminateWorker(baseDir, id);
          appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'scale-force-stop', worker_id: id, killed });
          if (killed) await sleep(300);
        }
        cleanupRemovedWorkerState(baseDir, id);
      }

      appendJsonl(supervisorLog(baseDir), {
        ts: new Date().toISOString(),
        kind: 'scale',
        added: addedIds,
        removed: removeIds,
        workers: postCfg.workers,
      });

      console.log(`Team scaled: ${summarizeTeam(postCfg)}`);
    },
  });
}

module.exports = {
  createScaleCommand,
  collectWorkerSpecs,
  buildConfig,
  writeConfigAtomic,
  summarizeTeam,
  waitForWorkerStop,
  forceTerminateWorker,
  cleanupRemovedWorkerState,
  spawnConfiguredWorker,
};
