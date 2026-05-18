'use strict';
/**
 * gad team profile — save / list / show team profiles.
 *
 * Profiles are reusable workers_spec blueprints saved under
 * `.planning/team/profiles/<name>.json`. `gad team start --profile <name>`
 * loads one.
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');
const { readProfile, writeProfile, listProfiles } = require('../../../lib/team/profiles.cjs');
const { writeConfig, readConfig, resolveRuntimeCmd } = require('../../../lib/team/config.cjs');
const { writeStatus, readStatus } = require('../../../lib/team/status.cjs');
const { spawnWorker } = require('../../../lib/team/spawn.cjs');
const { workerMailbox, workerOutDir, workerLog, supervisorLog, configPath, stopFlagPath, workerDir } = require('../../../lib/team/paths.cjs');
const { appendJsonl } = require('../../../lib/team/io.cjs');

const KNOWN_RUNTIMES = ['claude-code', 'codex-cli', 'gemini-cli', 'opencode', 'cursor-cli'];

function createProfileCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  /**
   * Resolve the project-specific base dir for .planning/team/ operations.
   * Fallback order: (a) --projectid flag; (b) active session projectid via
   * resolveRoots session logic; (c) getLastActiveProjectid(); (d) cwd autodetect.
   */
  function resolveTeamBaseDir(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    // Pass projectid if present; resolveRoots handles session + cwd fallbacks.
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return repoRoot;
    return path.join(repoRoot, root.path);
  }

  const PROJECTID_ARG = { type: 'string', description: 'Target project id (resolves .planning/team/ path)', default: '' };

  function loadProfileConfig(baseDir, projectid, profile, { noSpawn = false } = {}) {
    const cfg = {
      workers: (profile.workers_spec || []).length,
      roles: (profile.workers_spec || []).map((worker) => worker.role || 'executor'),
      workers_spec: profile.workers_spec || [],
      runtime: profile.runtime || 'claude-code',
      runtime_cmd: profile.runtime_cmd || null,
      autopause_threshold: profile.autopause_threshold || Number(process.env.GAD_AUTOPAUSE_THRESHOLD || 20),
      tick_ms: profile.tick_ms || 2000,
      runtime_tick_overrides: profile.runtime_tick_overrides || undefined,
      created_at: new Date().toISOString(),
      supervisor_pid: process.pid,
      from_profile: profile.name || null,
    };
    writeConfig(baseDir, cfg);

    const gadBinary = path.resolve(__dirname, '..', '..', 'gad.cjs');
    const spawned = [];
    for (const spec of cfg.workers_spec) {
      const id = spec.id;
      fs.mkdirSync(workerMailbox(baseDir, id), { recursive: true });
      fs.mkdirSync(workerOutDir(baseDir, id), { recursive: true });
      writeStatus(baseDir, id, {
        id,
        role: spec.role,
        lane: spec.lane || null,
        runtime: spec.runtime || cfg.runtime,
        runtime_cmd: resolveRuntimeCmd(cfg, id),
        pid: null,
        started_at: null,
        last_heartbeat: null,
        current_ref: null,
        state: 'NOT_STARTED',
      });
      if (noSpawn) continue;
      const pid = spawnWorker(baseDir, id, gadBinary, { cliArgs: projectid ? ['--projectid', projectid] : [] });
      spawned.push({ id, pid });
    }
    appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'profile-load', config: cfg, spawned });
    return { cfg, spawned };
  }

  const save = defineCommand({
    meta: { name: 'save', description: 'Save a team profile from an inline spec.' },
    args: {
      projectid: PROJECTID_ARG,
      name: { type: 'string', required: true },
      description: { type: 'string', default: '' },
      spec: { type: 'string', description: 'JSON workers_spec array, e.g. \'[{"id":"w1","role":"executor","lane":"frontend","runtime":"codex-cli"}]\'', required: true },
      runtime: { type: 'string', description: 'Team-default runtime when a spec entry omits its own', default: 'claude-code' },
    },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      let workers_spec;
      try { workers_spec = JSON.parse(String(args.spec)); }
      catch (e) { outputError(`Invalid --spec JSON: ${e.message}`); process.exit(1); }
      if (!Array.isArray(workers_spec) || workers_spec.length === 0) {
        outputError('--spec must be a non-empty JSON array.'); process.exit(1);
      }
      for (const w of workers_spec) {
        if (!w || !w.id) { outputError(`Each spec entry needs an id: ${JSON.stringify(w)}`); process.exit(1); }
      }
      const profile = writeProfile(baseDir, String(args.name), {
        description: String(args.description || ''),
        runtime: String(args.runtime),
        workers_spec,
      });
      console.log(`Saved profile: ${profile.name} (${workers_spec.length} workers)`);
    },
  });

  const list = defineCommand({
    meta: { name: 'list', description: 'List saved team profiles.' },
    args: { projectid: PROJECTID_ARG },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const names = listProfiles(baseDir);
      if (names.length === 0) { console.log('No profiles saved yet.'); return; }
      console.log(`Profiles (${names.length}):`);
      for (const n of names) {
        const p = readProfile(baseDir, n) || {};
        const w = (p.workers_spec || []).length;
        console.log(`  ${n}  — ${w} worker${w === 1 ? '' : 's'}${p.description ? `, ${p.description}` : ''}`);
      }
    },
  });

  const show = defineCommand({
    meta: { name: 'show', description: 'Print one profile as JSON.' },
    args: {
      projectid: PROJECTID_ARG,
      name: { type: 'string', required: true },
    },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const p = readProfile(baseDir, String(args.name));
      if (!p) { outputError(`Profile not found: ${args.name}`); process.exit(1); }
      console.log(JSON.stringify(p, null, 2));
    },
  });

  const load = defineCommand({
    meta: { name: 'load', description: 'Load a saved team profile into config.json and spawn workers.' },
    args: {
      projectid: PROJECTID_ARG,
      name: { type: 'string', required: true },
      'no-spawn': { type: 'boolean', description: 'Write config/status only; do not spawn workers.', default: false },
    },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const projectid = args && args.projectid ? String(args.projectid) : '';
      const p = readProfile(baseDir, String(args.name));
      if (!p) { outputError(`Profile not found: ${args.name}`); process.exit(1); }
      if (fs.existsSync(configPath(baseDir))) {
        outputError(`Team already configured under ${path.relative(baseDir, configPath(baseDir))}. Run \`gad team stop --all\` first.`);
        process.exit(1);
      }
      const { cfg, spawned } = loadProfileConfig(baseDir, projectid, p, { noSpawn: !!args['no-spawn'] });
      console.log(`Loaded profile: ${p.name} (${cfg.workers} workers, runtime=${cfg.runtime})`);
      if (args['no-spawn']) {
        console.log('--no-spawn: config written, workers NOT started.');
        return;
      }
      for (const s of spawned) {
        const spec = cfg.workers_spec.find((worker) => worker.id === s.id) || {};
        const tag = spec.lane ? ` lane=${spec.lane}` : '';
        console.log(`  ${s.id}  pid=${s.pid}  runtime=${spec.runtime || cfg.runtime}${tag}  log=${path.relative(baseDir, workerLog(baseDir, s.id))}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // switch — change a running worker's runtime without losing its mailbox.
  // GLOBAL-T-87-04. Pause (stop.flag), patch config.json workers_spec entry,
  // patch worker status.json, respawn. Mailbox dir is on disk and untouched
  // by stop+respawn, so queued .msg.json files are preserved across the swap.
  // -------------------------------------------------------------------------

  const switchCmd = defineCommand({
    meta: {
      name: 'switch',
      description: 'Swap a standing worker to a different runtime without losing its mailbox queue. Pauses worker, updates workers_spec, respawns.',
    },
    args: {
      projectid: PROJECTID_ARG,
      'worker-id': { type: 'string', required: true, description: 'Worker id (e.g. w2)' },
      to: { type: 'string', required: true, description: `Target runtime: ${KNOWN_RUNTIMES.join('|')}` },
      'runtime-cmd': { type: 'string', description: 'Optional runtime_cmd override for this worker', default: '' },
      'wait-ms': { type: 'string', description: 'Stop wait deadline (default 10000ms)', default: '10000' },
    },
    async run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const projectid = args && args.projectid ? String(args.projectid) : '';
      const id = String(args['worker-id']);
      const toRuntime = String(args.to);
      if (!KNOWN_RUNTIMES.includes(toRuntime)) {
        outputError(`Unknown runtime: ${toRuntime}. Known: ${KNOWN_RUNTIMES.join(', ')}`);
        process.exit(1);
      }
      const cfg = readConfig(baseDir);
      if (!cfg) { outputError('No team configured under .planning/team/. Run `gad team start` first.'); process.exit(1); }
      if (!Array.isArray(cfg.workers_spec)) {
        outputError('Team config has no workers_spec array — legacy config, switch unsupported.');
        process.exit(1);
      }
      const specIdx = cfg.workers_spec.findIndex((s) => s && s.id === id);
      if (specIdx === -1) { outputError(`Unknown worker: ${id}`); process.exit(1); }
      const prevSpec = cfg.workers_spec[specIdx];
      const fromRuntime = prevSpec.runtime || cfg.runtime || 'claude-code';
      if (fromRuntime === toRuntime && !args['runtime-cmd']) {
        console.log(`No-op: worker ${id} already on runtime=${toRuntime}.`);
        return;
      }
      if (!fs.existsSync(workerDir(baseDir, id))) {
        outputError(`Worker dir missing: ${workerDir(baseDir, id)}`);
        process.exit(1);
      }

      // 1. Pause: write stop.flag and wait for STOPPED state.
      fs.writeFileSync(stopFlagPath(baseDir, id), new Date().toISOString());
      appendJsonl(supervisorLog(baseDir), {
        ts: new Date().toISOString(),
        kind: 'profile-switch-stop',
        worker_id: id,
        from_runtime: fromRuntime,
        to_runtime: toRuntime,
      });
      console.log(`stop.flag written for ${id} (was ${fromRuntime}), waiting...`);
      const waitMs = Number.parseInt(String(args['wait-ms']), 10) || 10000;
      const deadline = Date.now() + waitMs;
      while (Date.now() < deadline) {
        const s = readStatus(baseDir, id);
        if (s && s.state === 'STOPPED') break;
        await new Promise((r) => setTimeout(r, 300));
      }

      // 2. Patch workers_spec entry. Optional runtime_cmd override; null
      //    clears to runtime default. Mailbox dir on disk is unchanged —
      //    .planning/team/workers/<id>/mailbox/ retains all queued .msg.json.
      const nextSpec = {
        ...prevSpec,
        runtime: toRuntime,
        runtime_cmd: args['runtime-cmd'] ? String(args['runtime-cmd']) : null,
      };
      cfg.workers_spec[specIdx] = nextSpec;
      writeConfig(baseDir, cfg);

      // 3. Patch status.json so observers see the new runtime immediately.
      const curStatus = readStatus(baseDir, id) || {};
      writeStatus(baseDir, id, {
        ...curStatus,
        id,
        runtime: toRuntime,
        runtime_cmd: resolveRuntimeCmd(cfg, id),
        state: 'NOT_STARTED',
        stopped_at: curStatus.stopped_at || new Date().toISOString(),
      });

      // 4. Respawn worker pointed at the new runtime.
      const gadBinary = path.resolve(__dirname, '..', '..', 'gad.cjs');
      const pid = spawnWorker(baseDir, id, gadBinary, { cliArgs: projectid ? ['--projectid', projectid] : [] });
      appendJsonl(supervisorLog(baseDir), {
        ts: new Date().toISOString(),
        kind: 'profile-switch-spawn',
        worker_id: id,
        from_runtime: fromRuntime,
        to_runtime: toRuntime,
        pid,
      });

      // Count preserved mailbox messages for the operator report.
      let preserved = 0;
      try {
        preserved = fs.readdirSync(workerMailbox(baseDir, id))
          .filter((name) => name.endsWith('.msg.json'))
          .length;
      } catch {}

      console.log(`Switched ${id}: ${fromRuntime} -> ${toRuntime}  pid=${pid}  mailbox preserved=${preserved}`);
    },
  });

  return defineCommand({
    meta: { name: 'profile', description: 'Manage saved team profiles; switch a worker between runtimes.' },
    subCommands: { save, list, show, load, switch: switchCmd },
  });
}

module.exports = { createProfileCommand };
