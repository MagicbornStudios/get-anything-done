'use strict';
/**
 * lib/team/worker-loop.cjs — the tick loop.
 *
 * Per tick:
 *   1. heartbeat
 *   2. stop.flag → exit
 *   3. pop mailbox → if found, use it
 *   4. else: self-claim best open gad handoff (filtered by lane)
 *   5. if still no work → sleep tick_ms
 *   6. else: compose prompt → runSubprocess → log → loop
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

function loadHandoffsLib() {
  try { return require('../handoffs.cjs'); } catch { return null; }
}
function loadAgentDetect() {
  try { return require('../agent-detect.cjs'); } catch { return null; }
}

function stopRequested(baseDir, id) { return fs.existsSync(stopFlagPath(baseDir, id)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runWorker(baseDir, id) {
  const cfg = readConfig(baseDir) || {};
  const spec = workerSpec(cfg, id);
  const role = spec.role;
  const lane = spec.lane;
  const runtime = resolveRuntime(cfg, id);
  const runtimeCmd = resolveRuntimeCmd(cfg, id);
  const tickMs = resolveTickMs(cfg);

  process.env.GAD_TEAM_WORKER_ID = id;
  process.env.GAD_AGENT_NAME = `team-${id}`;

  const logFile = workerLog(baseDir, id);
  const logWrite = (entry) => appendJsonl(logFile, { ts: new Date().toISOString(), worker_id: id, ...entry });

  updateStatus(baseDir, id, {
    id, role, lane, runtime, runtime_cmd: runtimeCmd,
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
      const compat = open.filter(h => {
        const rp = h.frontmatter && h.frontmatter.runtime_preference;
        const hlane = h.frontmatter && h.frontmatter.lane;
        return agentDetect.isHandoffCompatible(rp, runtime) && matchesLane(lane, hlane);
      });
      if (compat.length === 0) return null;
      const sorted = agentDetect.sortHandoffsForPickup(compat, runtime);
      const pick = sorted[0];
      handoffsLib.claimHandoff({ baseDir, id: pick.id, agent: `team-${id}`, runtime });
      const loaded = handoffsLib.readHandoff({ baseDir, id: pick.id });
      return {
        kind: 'handoff', ref: pick.id,
        projectid: (pick.frontmatter && pick.frontmatter.projectid) || null,
        body: (loaded && loaded.body) || '',
      };
    } catch (err) {
      logWrite({ kind: 'self-claim-error', error: err.message });
      return null;
    }
  }

  while (!stopRequested(baseDir, id)) {
    updateStatus(baseDir, id, { last_heartbeat: new Date().toISOString() });

    let work = null;
    let popped = popOldest(baseDir, id);
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
      work = trySelfClaim();
    }

    if (!work) {
      await sleep(tickMs);
      continue;
    }

    const ts = Date.now();
    const promptFile = path.join(workerOutDir(baseDir, id), `${ts}.prompt.md`);
    const promptText = composePrompt(work, { workerId: id, lane });
    fs.writeFileSync(promptFile, promptText);

    updateStatus(baseDir, id, {
      state: 'WORKING', current_ref: work.ref,
      current_started_at: new Date().toISOString(),
    });
    logWrite({ kind: 'work-start', ref: work.ref, runtime_cmd: runtimeCmd, prompt_file: path.relative(baseDir, promptFile) });

    const result = await runSubprocess(baseDir, id, runtimeCmd, promptFile, logWrite);
    logWrite({
      kind: result.code === 0 ? 'work-complete' : 'work-failed',
      ref: work.ref,
      exit_code: result.code,
      stdout_bytes: result.stdout.length,
      stderr_bytes: result.stderr.length,
    });

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

module.exports = { runWorker };
