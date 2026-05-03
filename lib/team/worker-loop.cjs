'use strict';
/**
 * lib/team/worker-loop.cjs - the tick loop.
 *
 * Per tick:
 *   1. heartbeat
 *   2. stop.flag -> exit
 *   3. pop mailbox -> if found, use it
 *   4. else: self-claim best open gad handoff (filtered by lane)
 *   5. if still no work -> sleep tick_ms
 *   6. else: compose prompt -> runSubprocess -> log -> loop
 *
 * Never returns until stop.flag appears.
 */

const fs = require('fs');
const path = require('path');
const { appendJsonl } = require('./io.cjs');
const {
  workerLog, workerOutDir, stopFlagPath,
} = require('./paths.cjs');
const { readConfig, resolveRuntime, resolveRuntimeCmd, resolveTickMs, workerSpec } = require('./config.cjs');
const { updateStatus } = require('./status.cjs');
const { popOldest, markDone, markFailed } = require('./mailbox.cjs');
const { composePrompt } = require('./prompt.cjs');
const { runSubprocess } = require('./subprocess.cjs');
const { matchesLane } = require('./lanes.cjs');
const { parkRuntime, isParked, getActiveRuntimeAccount, rotateRuntimeAccount } = require('./rate-limit.cjs');

function loadHandoffsLib() {
  try { return require('../handoffs.cjs'); } catch { return null; }
}

function loadAgentDetect() {
  try { return require('../agent-detect.cjs'); } catch { return null; }
}

function stopRequested(baseDir, id) { return fs.existsSync(stopFlagPath(baseDir, id)); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function handleRateLimitedHandoff({
  baseDir,
  runtime,
  work,
  handoffsLib,
  workerId,
  logWrite,
  attemptedAccountIndexes = [],
}) {
  const rotatedAccount = rotateRuntimeAccount(baseDir, runtime, attemptedAccountIndexes, process.env);
  if (rotatedAccount) {
    logWrite({
      kind: 'runtime-account-rotated',
      runtime,
      ref: work.ref,
      to_label: rotatedAccount.label,
      from_index: rotatedAccount.previous_index,
      to_index: rotatedAccount.index,
    });
    return { action: 'rotated', account: rotatedAccount };
  }

  const cooldown = parkRuntime(baseDir, runtime);
  logWrite({
    kind: 'runtime-rate-limited',
    runtime,
    ref: work.ref,
    cooldown_until: new Date(cooldown.until).toISOString(),
  });
  try {
    handoffsLib.unclaimHandoff({ baseDir, id: work.ref, reason: 'rate-limit', by: `team-${workerId}` });
    logWrite({ kind: 'handoff-unclaimed', ref: work.ref, reason: 'rate-limit' });
  } catch (err) {
    logWrite({ kind: 'handoff-unclaim-error', ref: work.ref, error: err.message });
  }
  return { action: 'parked' };
}

async function runWorker(baseDir, id) {
  const cfg = readConfig(baseDir) || {};
  const spec = workerSpec(cfg, id);
  const role = spec.role;
  const lane = spec.lane;
  const runtime = resolveRuntime(cfg, id);
  const runtimeCmd = resolveRuntimeCmd(cfg, id);
  const tickMs = resolveTickMs(cfg, id);

  process.env.GAD_TEAM_WORKER_ID = id;
  process.env.GAD_AGENT_NAME = `team-${id}`;

  const logFile = workerLog(baseDir, id);
  const logWrite = (entry) => appendJsonl(logFile, { ts: new Date().toISOString(), worker_id: id, ...entry });
  const writeHeartbeat = () => updateStatus(baseDir, id, { last_heartbeat: new Date().toISOString() });

  updateStatus(baseDir, id, {
    id,
    role,
    lane,
    runtime,
    runtime_cmd: runtimeCmd,
    pid: process.pid,
    started_at: new Date().toISOString(),
    last_heartbeat: new Date().toISOString(),
    current_ref: null,
    state: 'IDLE',
    stopped_at: null,
  });
  logWrite({ kind: 'worker-start', role, lane, runtime, runtime_cmd: runtimeCmd, tick_ms: tickMs });

  const handoffsLib = loadHandoffsLib();
  const agentDetect = loadAgentDetect();

  function trySelfClaim() {
    if (!handoffsLib || !agentDetect) return null;
    try {
      const open = handoffsLib.listHandoffs({ baseDir, bucket: 'open' });
      if (open.length === 0) return null;
      const compat = open.filter((handoff) => {
        const rp = handoff.frontmatter && handoff.frontmatter.runtime_preference;
        const hlane = handoff.frontmatter && handoff.frontmatter.lane;
        return agentDetect.isHandoffCompatible(rp, runtime) && matchesLane(lane, hlane);
      });
      if (compat.length === 0) return null;
      const sorted = agentDetect.sortHandoffsForPickup(compat, runtime);
      const pick = sorted[0];
      handoffsLib.claimHandoff({ baseDir, id: pick.id, agent: `team-${id}`, runtime });
      const loaded = handoffsLib.readHandoff({ baseDir, id: pick.id });
      return {
        kind: 'handoff',
        ref: pick.id,
        projectid: (pick.frontmatter && pick.frontmatter.projectid) || null,
        body: (loaded && loaded.body) || '',
      };
    } catch (err) {
      logWrite({ kind: 'self-claim-error', error: err.message });
      return null;
    }
  }

  while (!stopRequested(baseDir, id)) {
    let work = null;
    const popped = popOldest(baseDir, id);
    if (popped) {
      const m = popped.msg;
      let body = '';
      if (m.kind === 'handoff' && handoffsLib) {
        try {
          handoffsLib.claimHandoff({ baseDir, id: m.ref, agent: `team-${id}`, runtime });
          const loaded = handoffsLib.readHandoff({ baseDir, id: m.ref });
          body = (loaded && loaded.body) || '';
        } catch (err) {
          logWrite({ kind: 'claim-error', ref: m.ref, error: err.message });
        }
      }
      work = { kind: m.kind, ref: m.ref, projectid: m.projectid, body, _popped: popped };
    } else {
      if (isParked(baseDir, runtime)) {
        logWrite({ kind: 'runtime-parked-skip-claim', runtime });
        await sleep(tickMs);
        continue;
      }
      work = trySelfClaim();
    }

    writeHeartbeat();

    if (!work) {
      await sleep(tickMs);
      continue;
    }

    const workStartMs = Date.now();
    const promptFile = path.join(workerOutDir(baseDir, id), `${workStartMs}.prompt.md`);
    const promptText = composePrompt(work, { workerId: id, lane });
    fs.writeFileSync(promptFile, promptText);

    updateStatus(baseDir, id, {
      state: 'WORKING',
      current_ref: work.ref,
      current_started_at: new Date().toISOString(),
    });
    let activeAccount = getActiveRuntimeAccount(baseDir, runtime, process.env);
    logWrite({
      kind: 'work-start',
      ref: work.ref,
      runtime_cmd: runtimeCmd,
      runtime_account: activeAccount ? activeAccount.label : null,
      prompt_file: path.relative(baseDir, promptFile),
    });

    const heartbeatTimer = setInterval(writeHeartbeat, tickMs);
    if (heartbeatTimer.unref) heartbeatTimer.unref();
    let result;
    try {
      const attemptedAccountIndexes = new Set();
      for (;;) {
        result = await runSubprocess(
          baseDir,
          id,
          runtimeCmd,
          promptFile,
          logWrite,
          activeAccount ? activeAccount.env : null,
        );
        if (!(result.rate_limited && work.kind === 'handoff' && handoffsLib)) break;
        if (activeAccount && Number.isInteger(activeAccount.index)) {
          attemptedAccountIndexes.add(activeAccount.index);
        }
        const rateLimitOutcome = handleRateLimitedHandoff({
          baseDir,
          runtime,
          work,
          handoffsLib,
          workerId: id,
          logWrite,
          attemptedAccountIndexes: Array.from(attemptedAccountIndexes),
        });
        if (rateLimitOutcome.action !== 'rotated') break;
        activeAccount = rateLimitOutcome.account;
      }
    } finally {
      clearInterval(heartbeatTimer);
    }
    logWrite({
      kind: 'work-complete',
      ref: work.ref,
      exit_code: result.code,
      rate_limited: !!result.rate_limited,
      duration_ms: Date.now() - workStartMs,
      stdout_bytes: result.stdout.length,
      stderr_bytes: result.stderr.length,
    });
    if (result.rate_limited && work.kind === 'handoff' && handoffsLib) {
      if (work._popped) markFailed(work._popped.fullPath);
      updateStatus(baseDir, id, { state: 'IDLE', current_ref: null, current_started_at: null });
      await sleep(tickMs);
      continue;
    }

    if (work._popped) {
      if (result.code === 0) markDone(work._popped.fullPath);
      else markFailed(work._popped.fullPath);
    }

    updateStatus(baseDir, id, { state: 'IDLE', current_ref: null, current_started_at: null });
  }

  logWrite({ kind: 'worker-stop', reason: 'stop.flag' });
  updateStatus(baseDir, id, { state: 'STOPPED', stopped_at: new Date().toISOString(), pid: null });
  try { fs.unlinkSync(stopFlagPath(baseDir, id)); } catch {}
}

module.exports = { runWorker, handleRateLimitedHandoff };
