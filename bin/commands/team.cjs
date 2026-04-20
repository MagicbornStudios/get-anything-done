'use strict';
/**
 * gad team — mailbox-based multi-agent orchestration.
 *
 * Design: .planning/notes/2026-04-20-gad-team-mailbox-design.md
 *
 * MVP scope (M1 — 2026-04-20):
 *   start   — write config.json; spawn stub prints next steps
 *   stop    — write stop.flag files
 *   status  — table view of workers from status.json files
 *   enqueue — drop .msg.json into a worker mailbox
 *   dispatch (--once) — pull open gad handoffs, assign to free workers
 *   work    — worker loop entry (stubbed; real spawn in M2)
 *
 * Nothing under .omx/. Everything under .planning/team/. Workers set
 * GAD_TEAM_WORKER_ID so gad-context-monitor.js fires the autopause branch.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

const TEAM_DIR = path.join('.planning', 'team');
const WORKERS_DIR = path.join(TEAM_DIR, 'workers');

function teamRoot(baseDir) { return path.join(baseDir, TEAM_DIR); }
function workerDir(baseDir, id) { return path.join(baseDir, WORKERS_DIR, id); }
function configPath(baseDir) { return path.join(teamRoot(baseDir), 'config.json'); }
function supervisorLog(baseDir) { return path.join(teamRoot(baseDir), 'supervisor.log.jsonl'); }
function dispatchSeqPath(baseDir) { return path.join(teamRoot(baseDir), 'dispatch.seq'); }

function readJsonSafe(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
function appendJsonl(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(obj) + '\n');
}
function nextSeq(baseDir) {
  const p = dispatchSeqPath(baseDir);
  const cur = Number(fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '0') || 0;
  const n = cur + 1;
  fs.writeFileSync(p, String(n));
  return String(n).padStart(4, '0');
}
function listWorkerIds(baseDir) {
  const dir = path.join(baseDir, WORKERS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort();
}
function readStatus(baseDir, id) {
  return readJsonSafe(path.join(workerDir(baseDir, id), 'status.json'), null);
}
function mailboxDepth(baseDir, id) {
  const mbox = path.join(workerDir(baseDir, id), 'mailbox');
  if (!fs.existsSync(mbox)) return 0;
  return fs.readdirSync(mbox).filter(f => f.endsWith('.msg.json')).length;
}

function createTeamCommands(deps) {
  const { findRepoRoot, outputError } = deps;

  const teamStart = defineCommand({
    meta: { name: 'start', description: 'Initialize team config + scaffold worker dirs. Real spawn comes in M2.' },
    args: {
      n: { type: 'string', description: 'Number of workers (default 2)', default: '2' },
      roles: { type: 'string', description: 'Comma-separated roles, one per worker (default: all "executor")', default: '' },
      runtime: { type: 'string', description: 'Default runtime preference (claude-code | codex-cli)', default: 'claude-code' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const n = Math.max(1, Number.parseInt(String(args.n), 10) || 2);
      const roles = args.roles
        ? String(args.roles).split(',').map(s => s.trim())
        : Array.from({ length: n }, () => 'executor');
      if (roles.length < n) while (roles.length < n) roles.push('executor');

      const existing = readJsonSafe(configPath(baseDir), null);
      if (existing) {
        console.log(`Team already configured: ${existing.workers} workers. Edit ${configPath(baseDir)} or run \`gad team stop --all\` first.`);
        process.exit(1);
      }

      const cfg = {
        workers: n,
        roles: roles.slice(0, n),
        runtime: String(args.runtime),
        autopause_threshold: Number(process.env.GAD_AUTOPAUSE_THRESHOLD || 20),
        created_at: new Date().toISOString(),
        supervisor_pid: process.pid,
      };
      writeJson(configPath(baseDir), cfg);
      for (let i = 1; i <= n; i++) {
        const id = `w${i}`;
        const dir = workerDir(baseDir, id);
        fs.mkdirSync(path.join(dir, 'mailbox'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
        writeJson(path.join(dir, 'status.json'), {
          id, role: cfg.roles[i - 1], runtime: cfg.runtime,
          pid: null, started_at: null, last_heartbeat: null,
          current_ref: null, state: 'NOT_STARTED',
        });
      }
      appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'start', config: cfg });

      console.log(`Team scaffolded: ${n} workers under ${path.relative(baseDir, teamRoot(baseDir))}`);
      console.log('');
      console.log('To activate each worker, run ONE of these in a separate terminal:');
      for (let i = 1; i <= n; i++) {
        console.log(`  gad team work --worker-id w${i}`);
      }
      console.log('');
      console.log('Real spawn wiring lands in M2 (see .planning/notes/2026-04-20-gad-team-mailbox-design.md).');
      console.log('For now, observe via:  tail -f .planning/team/workers/w*/log.jsonl');
    },
  });

  const teamStop = defineCommand({
    meta: { name: 'stop', description: 'Signal worker(s) to exit after current iteration by writing stop.flag' },
    args: {
      'worker-id': { type: 'string', description: 'Target worker id (default: --all required if unset)', default: '' },
      all: { type: 'boolean', description: 'Stop every worker', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const ids = args.all ? listWorkerIds(baseDir) : (args['worker-id'] ? [String(args['worker-id'])] : []);
      if (ids.length === 0) {
        outputError('Pass --worker-id <id> or --all.');
        process.exit(1);
      }
      for (const id of ids) {
        const flag = path.join(workerDir(baseDir, id), 'stop.flag');
        fs.writeFileSync(flag, new Date().toISOString());
        appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'stop-signal', worker_id: id });
        console.log(`stop.flag written for ${id}`);
      }
    },
  });

  const teamStatus = defineCommand({
    meta: { name: 'status', description: 'Show state of every worker' },
    args: { json: { type: 'boolean', default: false } },
    run({ args }) {
      const baseDir = findRepoRoot();
      const cfg = readJsonSafe(configPath(baseDir), null);
      if (!cfg) {
        console.log('No team configured. Run `gad team start --n <N>` first.');
        return;
      }
      const rows = listWorkerIds(baseDir).map(id => {
        const s = readStatus(baseDir, id) || {};
        const ageMs = s.last_heartbeat ? Date.now() - Date.parse(s.last_heartbeat) : null;
        return {
          id,
          role: s.role || '?',
          state: s.state || 'UNKNOWN',
          mailbox: mailboxDepth(baseDir, id),
          current_ref: s.current_ref || '-',
          heartbeat_age_s: ageMs == null ? '-' : Math.round(ageMs / 1000),
          pid: s.pid || '-',
        };
      });
      if (args.json) { console.log(JSON.stringify({ config: cfg, workers: rows }, null, 2)); return; }
      console.log(`Team: ${cfg.workers} workers, runtime=${cfg.runtime}, autopause@${cfg.autopause_threshold}% remaining`);
      console.log('');
      console.log('  ID   ROLE      STATE         MAILBOX  CURRENT                           HB(s)  PID');
      console.log('  ──── ────────  ────────────  ───────  ────────────────────────────────  ─────  ─────');
      for (const r of rows) {
        const ref = String(r.current_ref).slice(0, 32).padEnd(32);
        console.log(`  ${r.id.padEnd(4)} ${r.role.padEnd(8)} ${r.state.padEnd(12)} ${String(r.mailbox).padStart(7)}  ${ref}  ${String(r.heartbeat_age_s).padStart(5)}  ${r.pid}`);
      }
    },
  });

  const teamEnqueue = defineCommand({
    meta: { name: 'enqueue', description: 'Drop a task or handoff into a worker mailbox' },
    args: {
      task: { type: 'string', description: 'Task id (e.g. 42.2-20)', default: '' },
      handoff: { type: 'string', description: 'Handoff id', default: '' },
      'worker-id': { type: 'string', description: 'Target worker (default: round-robin to least-loaded)', default: '' },
      projectid: { type: 'string', description: 'Project id', default: '' },
      priority: { type: 'string', description: 'low|normal|high|critical', default: 'normal' },
      'runtime-preference': { type: 'string', description: 'claude-code|codex-cli', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      if (!args.task && !args.handoff) { outputError('Pass --task <id> or --handoff <id>.'); process.exit(1); }
      if (args.task && args.handoff) { outputError('Pass exactly one of --task / --handoff.'); process.exit(1); }

      const ids = listWorkerIds(baseDir);
      if (ids.length === 0) { outputError('No workers configured. Run `gad team start` first.'); process.exit(1); }

      let target = String(args['worker-id'] || '').trim();
      if (!target) {
        const loads = ids.map(id => ({ id, depth: mailboxDepth(baseDir, id) }));
        loads.sort((a, b) => a.depth - b.depth);
        target = loads[0].id;
      }
      if (!ids.includes(target)) { outputError(`Unknown worker: ${target}. Known: ${ids.join(', ')}`); process.exit(1); }

      const seq = nextSeq(baseDir);
      const kind = args.task ? 'task' : 'handoff';
      const ref = args.task || args.handoff;
      const filename = `${seq}-${kind}-${ref.replace(/[^A-Za-z0-9._-]/g, '_')}.msg.json`;
      const msgPath = path.join(workerDir(baseDir, target), 'mailbox', filename);
      const msg = {
        kind, ref,
        projectid: args.projectid || null,
        priority: String(args.priority),
        runtime_preference: args['runtime-preference'] || null,
        enqueued_at: new Date().toISOString(),
        enqueued_by: process.env.GAD_AGENT_NAME || 'cli',
      };
      writeJson(msgPath, msg);
      appendJsonl(supervisorLog(baseDir), { ts: msg.enqueued_at, kind: 'enqueue', worker_id: target, ref, priority: msg.priority });
      console.log(`Enqueued ${kind}:${ref} → ${target} (${path.relative(baseDir, msgPath)})`);
    },
  });

  const teamDispatch = defineCommand({
    meta: { name: 'dispatch', description: 'Scan open gad handoffs and enqueue any not yet in a mailbox' },
    args: {
      once: { type: 'boolean', description: 'Run one pass and exit (default)', default: true },
      projectid: { type: 'string', default: '' },
    },
    run() {
      const baseDir = findRepoRoot();
      const ids = listWorkerIds(baseDir);
      if (ids.length === 0) { outputError('No workers configured. Run `gad team start` first.'); process.exit(1); }

      const { listHandoffs } = require('../../lib/handoffs.cjs');
      const { sortHandoffsForPickup } = require('../../lib/agent-detect.cjs');

      const open = listHandoffs({ baseDir, bucket: 'open' });
      const queued = new Set();
      for (const id of ids) {
        const mbox = path.join(workerDir(baseDir, id), 'mailbox');
        if (!fs.existsSync(mbox)) continue;
        for (const f of fs.readdirSync(mbox)) {
          if (!f.endsWith('.msg.json')) continue;
          const m = readJsonSafe(path.join(mbox, f), null);
          if (m && m.ref) queued.add(m.ref);
        }
      }

      const candidates = open.filter(h => !queued.has(h.id));
      if (candidates.length === 0) { console.log(`No new open handoffs to dispatch (${open.length} open, ${queued.size} already queued).`); return; }

      const cfg = readJsonSafe(configPath(baseDir), {});
      const runtimeHint = cfg.runtime || null;
      const sorted = sortHandoffsForPickup(candidates, runtimeHint);

      let assigned = 0;
      for (const h of sorted) {
        const loads = ids.map(id => ({ id, depth: mailboxDepth(baseDir, id) }));
        loads.sort((a, b) => a.depth - b.depth);
        const target = loads[0].id;
        const seq = nextSeq(baseDir);
        const filename = `${seq}-handoff-${h.id.replace(/[^A-Za-z0-9._-]/g, '_')}.msg.json`;
        const msg = {
          kind: 'handoff', ref: h.id,
          projectid: (h.frontmatter && h.frontmatter.projectid) || null,
          priority: (h.frontmatter && h.frontmatter.priority) || 'normal',
          runtime_preference: (h.frontmatter && h.frontmatter.runtime_preference) || null,
          enqueued_at: new Date().toISOString(),
          enqueued_by: 'dispatcher',
        };
        writeJson(path.join(workerDir(baseDir, target), 'mailbox', filename), msg);
        appendJsonl(supervisorLog(baseDir), { ts: msg.enqueued_at, kind: 'dispatch', worker_id: target, ref: h.id });
        console.log(`  → ${target}  ${h.id}  [${msg.priority}]`);
        assigned++;
      }
      console.log('');
      console.log(`Dispatched ${assigned} handoff(s).`);
    },
  });

  const teamWork = defineCommand({
    meta: { name: 'work', description: 'Worker loop entry (stub — real loop lands in M2). Sets GAD_TEAM_WORKER_ID for the autopause hook.' },
    args: {
      'worker-id': { type: 'string', description: 'Worker id (e.g. w1)', required: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const id = String(args['worker-id']);
      const cfg = readJsonSafe(configPath(baseDir), null);
      if (!cfg) { outputError('No team configured. Run `gad team start` first.'); process.exit(1); }
      const dir = workerDir(baseDir, id);
      if (!fs.existsSync(dir)) { outputError(`Worker dir missing: ${dir}`); process.exit(1); }

      process.env.GAD_TEAM_WORKER_ID = id;
      process.env.GAD_AGENT_NAME = `team-${id}`;
      writeJson(path.join(dir, 'status.json'), {
        id, role: cfg.roles[Number(id.slice(1)) - 1] || 'executor', runtime: cfg.runtime,
        pid: process.pid, started_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        current_ref: null, state: 'STUB_NOT_WIRED',
      });
      console.log(`[team ${id}] stub worker online. GAD_TEAM_WORKER_ID=${id}.`);
      console.log(`[team ${id}] mailbox: ${mailboxDepth(baseDir, id)} message(s).`);
      console.log(`[team ${id}] real loop is M2 — see .planning/notes/2026-04-20-gad-team-mailbox-design.md`);
      console.log(`[team ${id}] exiting stub.`);
    },
  });

  return defineCommand({
    meta: { name: 'team', description: 'Multi-agent orchestration via mailbox queue. See .planning/notes/2026-04-20-gad-team-mailbox-design.md' },
    subCommands: {
      start: teamStart,
      stop: teamStop,
      status: teamStatus,
      enqueue: teamEnqueue,
      dispatch: teamDispatch,
      work: teamWork,
    },
  });
}

module.exports = { createTeamCommands };
module.exports.register = (ctx) => {
  const cmd = createTeamCommands(ctx.common);
  return { team: cmd };
};
