'use strict';
/**
 * gad team — mailbox-based multi-agent orchestration (M2).
 *
 * Design: .planning/notes/2026-04-20-gad-team-mailbox-design.md
 *
 * Subcommands:
 *   start    — write config + spawn N detached worker subprocesses
 *   stop     — signal worker(s) to exit via stop.flag
 *   status   — tabular view of every worker
 *   enqueue  — drop a task or handoff into a worker mailbox
 *   dispatch — one-shot scan of open handoffs, auto-assign by load+runtime
 *   work     — worker loop entry (invoked by supervised spawn)
 *   tail     — stream a worker's log.jsonl (JSONL pretty-print)
 *   restart  — stop.flag + wait + respawn a single worker
 *
 * Worker flow per tick (default 2s, tune via GAD_TEAM_TICK_MS):
 *   1. heartbeat (write last_heartbeat to status.json)
 *   2. if stop.flag exists → exit
 *   3. pop oldest .msg.json from mailbox
 *   4. else fall back to gad handoffs claim-next --runtime <mine>
 *   5. if still no work → sleep tick
 *   6. otherwise: compose prompt → spawn runtime CLI subprocess → log → loop
 *
 * Runtime CLI invocation is shell-delegated via bash -c so prompt can be
 * piped via stdin without worrying about Windows arg-length limits. The
 * runtime command comes from config.runtime_cmd or env GAD_TEAM_RUNTIME_CMD;
 * defaults pick sensible values per runtime.
 *
 * All artifacts under .planning/team/. Never .omx/.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { defineCommand } = require('citty');

const TEAM_DIR = path.join('.planning', 'team');
const WORKERS_DIR = path.join(TEAM_DIR, 'workers');
const DEFAULT_TICK_MS = 2000;

function teamRoot(baseDir) { return path.join(baseDir, TEAM_DIR); }
function workerDir(baseDir, id) { return path.join(baseDir, WORKERS_DIR, id); }
function configPath(baseDir) { return path.join(teamRoot(baseDir), 'config.json'); }
function supervisorLog(baseDir) { return path.join(teamRoot(baseDir), 'supervisor.log.jsonl'); }
function dispatchSeqPath(baseDir) { return path.join(teamRoot(baseDir), 'dispatch.seq'); }
function stopFlagPath(baseDir, id) { return path.join(workerDir(baseDir, id), 'stop.flag'); }
function workerLog(baseDir, id) { return path.join(workerDir(baseDir, id), 'log.jsonl'); }
function workerStatus(baseDir, id) { return path.join(workerDir(baseDir, id), 'status.json'); }
function workerMailbox(baseDir, id) { return path.join(workerDir(baseDir, id), 'mailbox'); }
function workerOutDir(baseDir, id) { return path.join(workerDir(baseDir, id), 'out'); }

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
function readStatus(baseDir, id) { return readJsonSafe(workerStatus(baseDir, id), null); }
function updateStatus(baseDir, id, patch) {
  const cur = readStatus(baseDir, id) || { id };
  writeJson(workerStatus(baseDir, id), { ...cur, ...patch });
}
function mailboxDepth(baseDir, id) {
  const mbox = workerMailbox(baseDir, id);
  if (!fs.existsSync(mbox)) return 0;
  return fs.readdirSync(mbox).filter(f => f.endsWith('.msg.json')).length;
}
function popMailboxOldest(baseDir, id) {
  const mbox = workerMailbox(baseDir, id);
  if (!fs.existsSync(mbox)) return null;
  const files = fs.readdirSync(mbox).filter(f => f.endsWith('.msg.json')).sort();
  if (files.length === 0) return null;
  const file = files[0];
  const full = path.join(mbox, file);
  const msg = readJsonSafe(full, null);
  if (!msg) { try { fs.unlinkSync(full); } catch {} return null; }
  return { msg, file, fullPath: full };
}

// Default runtime commands. Piped via `bash -c "cat promptFile | <cmd>"`.
// Operator can override via config.runtime_cmd or GAD_TEAM_RUNTIME_CMD env.
function defaultRuntimeCmd(runtime) {
  if (runtime === 'codex-cli') return 'codex exec';
  if (runtime === 'gemini-cli') return 'gemini';
  return 'claude -p';
}

function resolveRuntimeCmd(cfg, runtimeOverride) {
  if (process.env.GAD_TEAM_RUNTIME_CMD) return process.env.GAD_TEAM_RUNTIME_CMD;
  if (cfg && cfg.runtime_cmd) return cfg.runtime_cmd;
  return defaultRuntimeCmd(runtimeOverride || (cfg && cfg.runtime) || 'claude-code');
}

// Spawn a single detached worker. Returns pid.
function spawnWorker(baseDir, id, gadBinary) {
  fs.mkdirSync(workerDir(baseDir, id), { recursive: true });
  fs.mkdirSync(workerMailbox(baseDir, id), { recursive: true });
  fs.mkdirSync(workerOutDir(baseDir, id), { recursive: true });
  const logFd = fs.openSync(workerLog(baseDir, id), 'a');
  const child = spawn(
    process.execPath,
    [gadBinary, 'team', 'work', '--worker-id', id],
    {
      cwd: baseDir,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
      env: { ...process.env, GAD_TEAM_WORKER_ID: id },
    },
  );
  child.unref();
  fs.closeSync(logFd);
  return child.pid;
}

// Compose a prompt string for a given work item. Keep concise — the
// subprocess is a full agentic runtime, it can pull more context itself.
function composePrompt(baseDir, work) {
  const lines = [];
  lines.push(`# gad team worker task`);
  lines.push('');
  lines.push(`You are a gad team worker (${process.env.GAD_TEAM_WORKER_ID || 'unknown'}).`);
  lines.push('');
  if (work.kind === 'handoff') {
    lines.push(`Claim this handoff and execute it to completion:`);
    lines.push('');
    lines.push(`**Handoff ID:** ${work.ref}`);
    if (work.projectid) lines.push(`**Project:** ${work.projectid}`);
    lines.push('');
    lines.push('Body:');
    lines.push('');
    lines.push(work.body || '(body not loaded)');
  } else {
    lines.push(`Work on task ${work.ref}:`);
    if (work.projectid) lines.push(`**Project:** ${work.projectid}`);
    lines.push('');
    if (work.body) { lines.push(''); lines.push(work.body); }
    else lines.push(`Run \`gad tasks show ${work.ref}\` to read the task body, then proceed.`);
  }
  lines.push('');
  lines.push('---');
  lines.push('Discipline:');
  lines.push('- Run `gad snapshot` first to orient if unsure.');
  lines.push('- Commit each cohesive edit immediately (parallel-agent hygiene).');
  lines.push('- If context autopauses, call `gad pause-work --goal "..."` before exiting.');
  lines.push('- Complete the handoff/task via gad CLI before you finish.');
  return lines.join('\n');
}

// Run the runtime CLI against a prompt file. Resolves with { code, stdout, stderr }.
function runSubprocess(baseDir, id, runtimeCmd, promptFile, logWriteFn) {
  return new Promise((resolve) => {
    // Shell-delegate so stdin pipe works cross-platform (Git Bash on Windows).
    const shellCmd = `cat "${promptFile}" | ${runtimeCmd}`;
    const child = spawn('bash', ['-c', shellCmd], {
      cwd: baseDir,
      env: { ...process.env, GAD_TEAM_WORKER_ID: id, GAD_AGENT_NAME: `team-${id}` },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks = { stdout: [], stderr: [] };
    child.stdout.on('data', d => {
      const s = String(d);
      chunks.stdout.push(s);
      logWriteFn({ kind: 'subproc-stdout', data: s.slice(0, 2000) });
    });
    child.stderr.on('data', d => {
      const s = String(d);
      chunks.stderr.push(s);
      logWriteFn({ kind: 'subproc-stderr', data: s.slice(0, 2000) });
    });
    child.on('error', (err) => {
      logWriteFn({ kind: 'subproc-error', error: err.message });
      resolve({ code: -1, stdout: chunks.stdout.join(''), stderr: chunks.stderr.join(''), error: err.message });
    });
    child.on('close', (code) => {
      resolve({ code, stdout: chunks.stdout.join(''), stderr: chunks.stderr.join('') });
    });
  });
}

// Worker loop — never returns until stop.flag appears.
async function workerLoop(baseDir, id) {
  const tickMs = Number(process.env.GAD_TEAM_TICK_MS || DEFAULT_TICK_MS) || DEFAULT_TICK_MS;
  const cfg = readJsonSafe(configPath(baseDir), {});
  const role = (() => {
    const n = Number(String(id).replace(/^w/, '')) || 1;
    return (cfg.roles && cfg.roles[n - 1]) || 'executor';
  })();
  const runtime = cfg.runtime || 'claude-code';
  const runtimeCmd = resolveRuntimeCmd(cfg, runtime);

  process.env.GAD_TEAM_WORKER_ID = id;
  process.env.GAD_AGENT_NAME = `team-${id}`;

  const logFile = workerLog(baseDir, id);
  const logWrite = (entry) => appendJsonl(logFile, { ts: new Date().toISOString(), worker_id: id, ...entry });

  updateStatus(baseDir, id, {
    id, role, runtime, runtime_cmd: runtimeCmd,
    pid: process.pid,
    started_at: new Date().toISOString(),
    last_heartbeat: new Date().toISOString(),
    current_ref: null,
    state: 'IDLE',
    stopped_at: null,
  });
  logWrite({ kind: 'worker-start', role, runtime, runtime_cmd: runtimeCmd, tickMs });

  const handoffsLib = (() => {
    try { return require('../../lib/handoffs.cjs'); } catch { return null; }
  })();
  const agentDetect = (() => {
    try { return require('../../lib/agent-detect.cjs'); } catch { return null; }
  })();

  function stopRequested() { return fs.existsSync(stopFlagPath(baseDir, id)); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Self claim-next: attempt to claim the best open handoff directly.
  function trySelfClaim() {
    if (!handoffsLib || !agentDetect) return null;
    try {
      const open = handoffsLib.listHandoffs({ baseDir, bucket: 'open' });
      if (open.length === 0) return null;
      const compat = open.filter(h =>
        agentDetect.isHandoffCompatible(h.frontmatter && h.frontmatter.runtime_preference, runtime),
      );
      if (compat.length === 0) return null;
      const sorted = agentDetect.sortHandoffsForPickup(compat, runtime);
      const pick = sorted[0];
      const claimed = handoffsLib.claimHandoff({ baseDir, id: pick.id, agent: `team-${id}`, runtime });
      return { kind: 'handoff', ref: pick.id, projectid: (pick.frontmatter && pick.frontmatter.projectid) || null, body: (claimed && claimed.body) || '' };
    } catch (err) {
      logWrite({ kind: 'self-claim-error', error: err.message });
      return null;
    }
  }

  while (!stopRequested()) {
    updateStatus(baseDir, id, { last_heartbeat: new Date().toISOString() });

    let work = null;
    const popped = popMailboxOldest(baseDir, id);
    if (popped) {
      const m = popped.msg;
      let body = '';
      if (m.kind === 'handoff' && handoffsLib) {
        try {
          const claimed = handoffsLib.claimHandoff({ baseDir, id: m.ref, agent: `team-${id}`, runtime });
          body = (claimed && claimed.body) || '';
        } catch (err) {
          logWrite({ kind: 'claim-error', ref: m.ref, error: err.message });
        }
      }
      work = { kind: m.kind, ref: m.ref, projectid: m.projectid, body, _popped: popped };
    } else {
      work = trySelfClaim();
    }

    if (!work) {
      await sleep(tickMs);
      continue;
    }

    const ts = Date.now();
    const promptFile = path.join(workerOutDir(baseDir, id), `${ts}.prompt.md`);
    const promptText = composePrompt(baseDir, work);
    fs.writeFileSync(promptFile, promptText);

    updateStatus(baseDir, id, { state: 'WORKING', current_ref: work.ref, current_started_at: new Date().toISOString() });
    logWrite({ kind: 'work-start', ref: work.ref, runtime_cmd: runtimeCmd, prompt_file: path.relative(baseDir, promptFile) });

    const result = await runSubprocess(baseDir, id, runtimeCmd, promptFile, logWrite);
    logWrite({
      kind: result.code === 0 ? 'work-complete' : 'work-failed',
      ref: work.ref,
      exit_code: result.code,
      stdout_bytes: result.stdout.length,
      stderr_bytes: result.stderr.length,
    });

    // Clean up mailbox message on non-error exit; on failure, keep as .failed.
    if (work._popped) {
      if (result.code === 0) {
        try { fs.unlinkSync(work._popped.fullPath); } catch {}
      } else {
        try { fs.renameSync(work._popped.fullPath, work._popped.fullPath.replace(/\.msg\.json$/, '.failed.json')); } catch {}
      }
    }

    updateStatus(baseDir, id, { state: 'IDLE', current_ref: null, current_started_at: null });
  }

  logWrite({ kind: 'worker-stop', reason: 'stop.flag' });
  updateStatus(baseDir, id, { state: 'STOPPED', stopped_at: new Date().toISOString(), pid: null });
  try { fs.unlinkSync(stopFlagPath(baseDir, id)); } catch {}
}

function createTeamCommands(deps) {
  const { findRepoRoot, outputError } = deps;

  const teamStart = defineCommand({
    meta: { name: 'start', description: 'Create team config + spawn N detached worker subprocesses. Idempotent: refuses if team already running.' },
    args: {
      n: { type: 'string', description: 'Number of workers (default 2)', default: '2' },
      roles: { type: 'string', description: 'Comma-separated roles (default: executor for each)', default: '' },
      runtime: { type: 'string', description: 'Runtime for all workers (claude-code | codex-cli | gemini-cli)', default: 'claude-code' },
      'runtime-cmd': { type: 'string', description: 'Override CLI invocation (default: claude -p / codex exec / gemini)', default: '' },
      'no-spawn': { type: 'boolean', description: 'Write config only, do not spawn (for debug)', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const n = Math.max(1, Number.parseInt(String(args.n), 10) || 2);
      const roles = args.roles
        ? String(args.roles).split(',').map(s => s.trim())
        : Array.from({ length: n }, () => 'executor');
      while (roles.length < n) roles.push('executor');

      const existing = readJsonSafe(configPath(baseDir), null);
      if (existing) {
        console.log(`Team already configured under ${path.relative(baseDir, teamRoot(baseDir))}.`);
        console.log(`Run \`gad team stop --all\` then remove ${path.relative(baseDir, configPath(baseDir))} before starting a new team.`);
        process.exit(1);
      }

      const cfg = {
        workers: n,
        roles: roles.slice(0, n),
        runtime: String(args.runtime),
        runtime_cmd: args['runtime-cmd'] || null,
        autopause_threshold: Number(process.env.GAD_AUTOPAUSE_THRESHOLD || 20),
        tick_ms: Number(process.env.GAD_TEAM_TICK_MS || DEFAULT_TICK_MS),
        created_at: new Date().toISOString(),
        supervisor_pid: process.pid,
      };
      writeJson(configPath(baseDir), cfg);

      const gadBinary = path.resolve(__dirname, '..', 'gad.cjs');
      const spawned = [];
      for (let i = 1; i <= n; i++) {
        const id = `w${i}`;
        fs.mkdirSync(path.join(workerDir(baseDir, id), 'mailbox'), { recursive: true });
        fs.mkdirSync(path.join(workerDir(baseDir, id), 'out'), { recursive: true });
        writeJson(workerStatus(baseDir, id), {
          id, role: cfg.roles[i - 1], runtime: cfg.runtime,
          runtime_cmd: resolveRuntimeCmd(cfg, cfg.runtime),
          pid: null, started_at: null, last_heartbeat: null,
          current_ref: null, state: 'NOT_STARTED',
        });
        if (args['no-spawn']) continue;
        const pid = spawnWorker(baseDir, id, gadBinary);
        spawned.push({ id, pid });
      }
      appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'start', config: cfg, spawned });

      console.log(`Team online: ${n} workers, runtime=${cfg.runtime}, autopause@${cfg.autopause_threshold}% remaining.`);
      if (args['no-spawn']) {
        console.log(`--no-spawn: config written, workers NOT started.`);
      } else {
        for (const s of spawned) console.log(`  ${s.id}  pid=${s.pid}  log=${path.relative(baseDir, workerLog(baseDir, s.id))}`);
      }
      console.log('');
      console.log('Next:');
      console.log('  gad team status                — worker state table');
      console.log('  gad team tail --worker-id w1   — stream a worker log');
      console.log('  gad team dispatch              — pre-queue open handoffs');
      console.log('  gad team stop --all            — clean shutdown');
    },
  });

  const teamStop = defineCommand({
    meta: { name: 'stop', description: 'Signal worker(s) to exit via stop.flag after current iteration.' },
    args: {
      'worker-id': { type: 'string', default: '' },
      all: { type: 'boolean', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const ids = args.all ? listWorkerIds(baseDir) : (args['worker-id'] ? [String(args['worker-id'])] : []);
      if (ids.length === 0) { outputError('Pass --worker-id <id> or --all.'); process.exit(1); }
      for (const id of ids) {
        const flag = stopFlagPath(baseDir, id);
        fs.writeFileSync(flag, new Date().toISOString());
        appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'stop-signal', worker_id: id });
        console.log(`stop.flag written for ${id}`);
      }
    },
  });

  const teamStatus = defineCommand({
    meta: { name: 'status', description: 'Show state of every worker (table or JSON).' },
    args: { json: { type: 'boolean', default: false } },
    run({ args }) {
      const baseDir = findRepoRoot();
      const cfg = readJsonSafe(configPath(baseDir), null);
      if (!cfg) { console.log('No team configured. Run `gad team start --n <N>` first.'); return; }
      const rows = listWorkerIds(baseDir).map(id => {
        const s = readStatus(baseDir, id) || {};
        const ageMs = s.last_heartbeat ? Date.now() - Date.parse(s.last_heartbeat) : null;
        return {
          id, role: s.role || '?', state: s.state || 'UNKNOWN',
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
        console.log(`  ${r.id.padEnd(4)} ${String(r.role).padEnd(8)} ${String(r.state).padEnd(12)} ${String(r.mailbox).padStart(7)}  ${ref}  ${String(r.heartbeat_age_s).padStart(5)}  ${r.pid}`);
      }
    },
  });

  const teamEnqueue = defineCommand({
    meta: { name: 'enqueue', description: 'Drop a task or handoff into a worker mailbox.' },
    args: {
      task: { type: 'string', default: '' },
      handoff: { type: 'string', default: '' },
      'worker-id': { type: 'string', default: '' },
      projectid: { type: 'string', default: '' },
      priority: { type: 'string', default: 'normal' },
      'runtime-preference': { type: 'string', default: '' },
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
      const msgPath = path.join(workerMailbox(baseDir, target), filename);
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
    meta: { name: 'dispatch', description: 'One-shot: scan open gad handoffs, enqueue any not yet in a mailbox. Workers self-claim from handoff queue on idle too.' },
    args: { projectid: { type: 'string', default: '' } },
    run() {
      const baseDir = findRepoRoot();
      const ids = listWorkerIds(baseDir);
      if (ids.length === 0) { outputError('No workers configured. Run `gad team start` first.'); process.exit(1); }
      const { listHandoffs } = require('../../lib/handoffs.cjs');
      const { sortHandoffsForPickup } = require('../../lib/agent-detect.cjs');
      const open = listHandoffs({ baseDir, bucket: 'open' });
      const queued = new Set();
      for (const id of ids) {
        const mbox = workerMailbox(baseDir, id);
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
      const sorted = sortHandoffsForPickup(candidates, cfg.runtime || null);
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
        writeJson(path.join(workerMailbox(baseDir, target), filename), msg);
        appendJsonl(supervisorLog(baseDir), { ts: msg.enqueued_at, kind: 'dispatch', worker_id: target, ref: h.id });
        console.log(`  → ${target}  ${h.id}  [${msg.priority}]`);
        assigned++;
      }
      console.log('');
      console.log(`Dispatched ${assigned} handoff(s).`);
    },
  });

  const teamWork = defineCommand({
    meta: { name: 'work', description: 'Worker loop entry. Typically invoked by `gad team start` as a detached subprocess; you can also run it foreground in a spare terminal for debugging.' },
    args: { 'worker-id': { type: 'string', required: true } },
    async run({ args }) {
      const baseDir = findRepoRoot();
      const id = String(args['worker-id']);
      const cfg = readJsonSafe(configPath(baseDir), null);
      if (!cfg) { outputError('No team configured. Run `gad team start` first.'); process.exit(1); }
      if (!fs.existsSync(workerDir(baseDir, id))) { outputError(`Worker dir missing: ${id}`); process.exit(1); }
      await workerLoop(baseDir, id);
    },
  });

  const teamTail = defineCommand({
    meta: { name: 'tail', description: 'Stream a worker log as pretty JSONL. Ctrl-C to stop.' },
    args: {
      'worker-id': { type: 'string', required: true },
      n: { type: 'string', description: 'Print last N lines before tailing (default 20)', default: '20' },
      follow: { type: 'boolean', description: 'Keep following (default true)', default: true },
    },
    async run({ args }) {
      const baseDir = findRepoRoot();
      const id = String(args['worker-id']);
      const p = workerLog(baseDir, id);
      if (!fs.existsSync(p)) { outputError(`No log file yet: ${p}`); process.exit(1); }
      const buf = fs.readFileSync(p, 'utf8');
      const lines = buf.split(/\r?\n/).filter(Boolean);
      const tail = Number.parseInt(String(args.n), 10) || 20;
      for (const line of lines.slice(-tail)) printLogLine(line);
      if (!args.follow) return;
      let pos = Buffer.byteLength(buf, 'utf8');
      const watcher = fs.watch(p, { persistent: true }, () => {
        try {
          const stat = fs.statSync(p);
          if (stat.size <= pos) return;
          const fd = fs.openSync(p, 'r');
          const chunk = Buffer.alloc(stat.size - pos);
          fs.readSync(fd, chunk, 0, chunk.length, pos);
          fs.closeSync(fd);
          pos = stat.size;
          for (const line of chunk.toString('utf8').split(/\r?\n/).filter(Boolean)) printLogLine(line);
        } catch {}
      });
      await new Promise(resolve => {
        process.on('SIGINT', () => { try { watcher.close(); } catch {}; resolve(); });
      });
    },
  });

  const teamRestart = defineCommand({
    meta: { name: 'restart', description: 'Stop a worker (stop.flag + wait) and respawn it with the same id.' },
    args: {
      'worker-id': { type: 'string', required: true },
      'wait-ms': { type: 'string', default: '10000' },
    },
    async run({ args }) {
      const baseDir = findRepoRoot();
      const id = String(args['worker-id']);
      const cfg = readJsonSafe(configPath(baseDir), null);
      if (!cfg) { outputError('No team configured.'); process.exit(1); }
      if (!fs.existsSync(workerDir(baseDir, id))) { outputError(`Unknown worker: ${id}`); process.exit(1); }

      fs.writeFileSync(stopFlagPath(baseDir, id), new Date().toISOString());
      appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'restart-stop', worker_id: id });
      console.log(`stop.flag written for ${id}, waiting...`);
      const waitMs = Number.parseInt(String(args['wait-ms']), 10) || 10000;
      const deadline = Date.now() + waitMs;
      while (Date.now() < deadline) {
        const s = readStatus(baseDir, id);
        if (s && s.state === 'STOPPED') break;
        await new Promise(r => setTimeout(r, 300));
      }
      const gadBinary = path.resolve(__dirname, '..', 'gad.cjs');
      const pid = spawnWorker(baseDir, id, gadBinary);
      appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'restart-spawn', worker_id: id, pid });
      console.log(`Respawned ${id} pid=${pid}`);
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
      tail: teamTail,
      restart: teamRestart,
    },
  });
}

function printLogLine(line) {
  try {
    const entry = JSON.parse(line);
    const ts = String(entry.ts || '').slice(11, 19);
    const kind = String(entry.kind || '?').padEnd(16);
    const ref = entry.ref ? ` ${entry.ref}` : '';
    const extra = entry.error ? ` ERROR=${entry.error}`
      : entry.exit_code != null ? ` exit=${entry.exit_code}`
      : entry.data ? ` ${String(entry.data).slice(0, 80).replace(/\n/g, '⏎')}`
      : '';
    console.log(`${ts} ${kind}${ref}${extra}`);
  } catch {
    console.log(line);
  }
}

module.exports = { createTeamCommands };
module.exports.register = (ctx) => {
  const cmd = createTeamCommands(ctx.common);
  return { team: cmd };
};
