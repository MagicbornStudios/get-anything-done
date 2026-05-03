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
const { writeConfig, resolveRuntimeCmd } = require('../../../lib/team/config.cjs');
const { writeStatus } = require('../../../lib/team/status.cjs');
const { spawnWorker } = require('../../../lib/team/spawn.cjs');
const { workerMailbox, workerOutDir, workerLog, supervisorLog, configPath } = require('../../../lib/team/paths.cjs');
const { appendJsonl } = require('../../../lib/team/io.cjs');

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

  return defineCommand({
    meta: { name: 'profile', description: 'Manage saved team profiles.' },
    subCommands: { save, list, show, load },
  });
}

module.exports = { createProfileCommand };
