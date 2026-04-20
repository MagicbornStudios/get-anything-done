'use strict';
/**
 * gad team start — create team config + spawn N detached worker subprocesses.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

const { readConfig, writeConfig, resolveRuntimeCmd, DEFAULT_TICK_MS } = require('../../../lib/team/config.cjs');
const { writeStatus } = require('../../../lib/team/status.cjs');
const { spawnWorker } = require('../../../lib/team/spawn.cjs');
const { profilesRoot, workerDir, workerMailbox, workerOutDir, configPath, workerLog, teamRoot, supervisorLog } = require('../../../lib/team/paths.cjs');
const { appendJsonl } = require('../../../lib/team/io.cjs');
const { readProfile, profileToConfig, listProfiles } = require('../../../lib/team/profiles.cjs');

function createStartCommand(deps) {
  const { findRepoRoot, outputError } = deps;
  return defineCommand({
    meta: { name: 'start', description: 'Create team config + spawn N detached worker subprocesses. Idempotent: refuses if team already running.' },
    args: {
      n: { type: 'string', description: 'Number of workers (default 2). Ignored when --profile is given.', default: '2' },
      roles: { type: 'string', description: 'Comma-separated roles (default: executor for each). Ignored with --profile.', default: '' },
      runtime: { type: 'string', description: 'Team-default runtime (claude-code | codex-cli | gemini-cli)', default: 'claude-code' },
      'runtime-cmd': { type: 'string', description: 'Team-default CLI override (applies when a worker_spec entry omits its own)', default: '' },
      profile: { type: 'string', description: 'Load a saved team profile from .planning/team/profiles/<name>.json', default: '' },
      'no-spawn': { type: 'boolean', description: 'Write config only, do not spawn (for debug)', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      if (readConfig(baseDir)) {
        console.log(`Team already configured under ${path.relative(baseDir, teamRoot(baseDir))}.`);
        console.log(`Run \`gad team stop --all\` and remove ${path.relative(baseDir, configPath(baseDir))} before starting a new team.`);
        process.exit(1);
      }

      let cfg;
      if (args.profile) {
        const p = readProfile(baseDir, String(args.profile));
        if (!p) {
          const available = listProfiles(baseDir);
          outputError(`Profile not found: ${args.profile}. Available: ${available.length ? available.join(', ') : '(none — save one with `gad team profile save`)'}`);
          process.exit(1);
        }
        cfg = profileToConfig(p, { supervisorPid: process.pid });
      } else {
        const n = Math.max(1, Number.parseInt(String(args.n), 10) || 2);
        const roles = args.roles
          ? String(args.roles).split(',').map(s => s.trim())
          : Array.from({ length: n }, () => 'executor');
        while (roles.length < n) roles.push('executor');
        const workers_spec = [];
        for (let i = 1; i <= n; i++) {
          workers_spec.push({ id: `w${i}`, role: roles[i - 1], lane: null, runtime: String(args.runtime), runtime_cmd: null });
        }
        cfg = {
          workers: n,
          roles: roles.slice(0, n),
          workers_spec,
          runtime: String(args.runtime),
          runtime_cmd: args['runtime-cmd'] || null,
          autopause_threshold: Number(process.env.GAD_AUTOPAUSE_THRESHOLD || 20),
          tick_ms: Number(process.env.GAD_TEAM_TICK_MS || DEFAULT_TICK_MS),
          created_at: new Date().toISOString(),
          supervisor_pid: process.pid,
        };
      }
      writeConfig(baseDir, cfg);

      const gadBinary = path.resolve(__dirname, '..', '..', 'gad.cjs');
      const spawned = [];
      for (const spec of cfg.workers_spec) {
        const id = spec.id;
        fs.mkdirSync(workerMailbox(baseDir, id), { recursive: true });
        fs.mkdirSync(workerOutDir(baseDir, id), { recursive: true });
        writeStatus(baseDir, id, {
          id, role: spec.role, lane: spec.lane || null,
          runtime: spec.runtime || cfg.runtime,
          runtime_cmd: resolveRuntimeCmd(cfg, id),
          pid: null, started_at: null, last_heartbeat: null,
          current_ref: null, state: 'NOT_STARTED',
        });
        if (args['no-spawn']) continue;
        const pid = spawnWorker(baseDir, id, gadBinary);
        spawned.push({ id, pid });
      }
      appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'start', config: cfg, spawned });

      console.log(`Team online: ${cfg.workers} workers${cfg.from_profile ? ` (profile=${cfg.from_profile})` : ''}, runtime=${cfg.runtime}, autopause@${cfg.autopause_threshold}% remaining.`);
      if (args['no-spawn']) {
        console.log('--no-spawn: config written, workers NOT started.');
      } else {
        for (const s of spawned) {
          const spec = cfg.workers_spec.find(w => w.id === s.id) || {};
          const tag = spec.lane ? ` lane=${spec.lane}` : '';
          console.log(`  ${s.id}  pid=${s.pid}  runtime=${spec.runtime || cfg.runtime}${tag}  log=${path.relative(baseDir, workerLog(baseDir, s.id))}`);
        }
      }
      console.log('');
      console.log('Next:');
      console.log('  gad team status                — worker state table');
      console.log('  gad team tail --worker-id w1   — stream a worker log');
      console.log('  gad team dispatch              — pre-queue open handoffs');
      console.log('  gad team stop --all            — clean shutdown');
    },
  });
}

module.exports = { createStartCommand };
