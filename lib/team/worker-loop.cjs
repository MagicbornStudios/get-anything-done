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

// ---------------------------------------------------------------------------
// Lazy ESM loader for runtime-substrate-core (buildTelemetryPayload).
// runtime-substrate-core.mjs is ESM-only; we must use dynamic import() from
// this CJS module. The adapter cache inside the ESM module is shared across
// calls within the same process, so we load once and reuse. (GAD-T-35-17)
// ---------------------------------------------------------------------------
let _substratePromise = null;
async function loadSubstrate() {
  if (!_substratePromise) {
    const corePath = path.join(__dirname, '..', '..', 'scripts', 'runtime-substrate-core.mjs');
    _substratePromise = import(
      require('url').pathToFileURL(corePath).href
    ).catch(() => null);
  }
  return _substratePromise;
}

async function extractTelemetry(runtimeId, stdout) {
  try {
    const substrate = await loadSubstrate();
    if (!substrate || typeof substrate.buildTelemetryPayload !== 'function') {
      return { model_id: null, tokens_in: null, tokens_out: null };
    }
    return await substrate.buildTelemetryPayload(runtimeId, stdout);
  } catch {
    return { model_id: null, tokens_in: null, tokens_out: null };
  }
}
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
const {
  parkingEnabled,
  parkRuntime,
  isParked,
  getActiveRuntimeAccount,
  rotateRuntimeAccount,
  suggestedCooldownMs,
  isHandoffExhausted,
  loadGlobalFallbacks,
  classifyRuntimeError,
  parseCooldown,
} = require('./rate-limit.cjs');
const { maybeQueueReview } = require('./free-tier-review.cjs');

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
  result,
}) {
  const rotatedAccount = rotateRuntimeAccount(baseDir, runtime, attemptedAccountIndexes, process.env, { workerId });
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

  let cooldown = null;
  let cooldownMs;
  if (parkingEnabled(process.env)) {
    cooldownMs = result
      ? suggestedCooldownMs(result.stderr, result.stdout)
      : undefined;
    cooldown = parkRuntime(baseDir, runtime, cooldownMs);
  }
  logWrite({
    kind: 'runtime-rate-limit-on-call',
    runtime,
    ref: work.ref,
    cooldown_until: cooldown ? new Date(cooldown.until).toISOString() : null,
    cooldown_ms: cooldownMs || null,
    hard_cap: cooldownMs ? cooldownMs > 30 * 60 * 1000 : false,
    parking_enabled: parkingEnabled(process.env),
  });
  try {
    handoffsLib.unclaimHandoff({ baseDir, id: work.ref, reason: 'rate-limit', by: `team-${workerId}` });
    logWrite({ kind: 'handoff-unclaimed', ref: work.ref, reason: 'rate-limit' });
  } catch (err) {
    logWrite({ kind: 'handoff-unclaim-error', ref: work.ref, error: err.message });
  }
  return { action: 'requeued' };
}

/**
 * Per-class dispatcher behavior (GLOBAL-D-313 / GAD-T-75-11).
 *
 * @param {{ class: string, cooldown_ms: number|null, cooldown_until: number|null, reason_text: string }} classification
 * @param {{ baseDir, runtime, work, handoffsLib, workerId, logWrite, result }} ctx
 * @returns {{ action: 'park'|'requeue'|'surface'|'backoff'|'restart'|'noop', classification: object }}
 */
function handleClassifiedFailure(classification, ctx) {
  const { baseDir, runtime, work, handoffsLib, workerId, logWrite, result } = ctx;
  const cls = classification.class;

  logWrite({
    kind: 'runtime-failure-dispatch',
    classification,
    runtime,
    ref: work && work.ref ? work.ref : null,
  });

  function tryUnclaim(reason, extra = {}) {
    if (!handoffsLib || !work || !work.ref) return;
    try {
      handoffsLib.unclaimHandoff({ baseDir, id: work.ref, reason, by: `team-${workerId}`, ...extra });
      logWrite({ kind: 'handoff-unclaimed', ref: work.ref, reason });
    } catch (err) {
      logWrite({ kind: 'handoff-unclaim-error', ref: work.ref, error: err.message });
    }
  }

  if (cls === 'quota_soft') {
    // Park runtime until cooldown_until + 60s jitter; re-route handoff.
    // Parking is always-on for quota errors regardless of GAD_ENABLE_RUNTIME_PARKING.
    const jitter = 60 * 1000;
    let cooldownMs = classification.cooldown_ms;
    if (!cooldownMs && result) {
      // Fall back to duration extracted from full stderr
      cooldownMs = parseCooldown(result.stderr || '');
    }
    if (!cooldownMs) {
      cooldownMs = suggestedCooldownMs(result ? result.stderr : '', result ? result.stdout : '');
    }
    const cooldown = parkRuntime(baseDir, runtime, cooldownMs + jitter);
    logWrite({
      kind: 'runtime-rate-limit-on-call',
      runtime,
      ref: work && work.ref ? work.ref : null,
      cooldown_until: cooldown ? new Date(cooldown.until).toISOString() : null,
      cooldown_ms: cooldownMs + jitter,
      hard_cap: false,
      parking_enabled: true, // always-on for quota_soft
      class: cls,
    });
    tryUnclaim('rate-limit');
    return { action: 'park', classification };
  }

  if (cls === 'quota_hard_cap') {
    // Mark account paused; rotate; requeue without marking exhausted.
    const cooldown = parkRuntime(baseDir, runtime, 4 * 60 * 60 * 1000);
    logWrite({
      kind: 'runtime-rate-limit-on-call',
      runtime,
      ref: work && work.ref ? work.ref : null,
      cooldown_until: cooldown ? new Date(cooldown.until).toISOString() : null,
      cooldown_ms: 4 * 60 * 60 * 1000,
      hard_cap: true,
      parking_enabled: true, // always-on for quota_hard_cap
      class: cls,
    });
    tryUnclaim('rate-limit');
    return { action: 'requeue', classification };
  }

  if (cls === 'auth_failed') {
    // Stop worker; do NOT retry; do NOT route to other accounts of same provider.
    logWrite({ kind: 'auth-blocked', runtime, ref: work && work.ref ? work.ref : null, reason_text: classification.reason_text });
    tryUnclaim(`auth-failed-${runtime}`);
    return { action: 'surface', classification, stopWorker: true };
  }

  if (cls === 'network_error') {
    // Exp backoff max 3 retries; reclaim from same worker after backoff.
    tryUnclaim('network-error');
    return { action: 'backoff', classification };
  }

  if (cls === 'malformed_argv') {
    // Stop worker; emit adapter-bug; refuse re-route.
    logWrite({ kind: 'adapter-bug', runtime, ref: work && work.ref ? work.ref : null, reason_text: classification.reason_text });
    tryUnclaim('adapter-bug');
    return { action: 'surface', classification, stopWorker: true, refuseReroute: true };
  }

  if (cls === 'runtime_crash') {
    // Log full stderr tail; restart worker once; stop if crashes again.
    const stderrTail = result && result.stderr ? result.stderr.split('\n').slice(-50).join('\n') : '';
    logWrite({ kind: 'runtime-crash', runtime, ref: work && work.ref ? work.ref : null, stderr_tail: stderrTail });
    // Requeue with crash_count++ in unclaim metadata.
    const existingCrashCount = (work.frontmatter && work.frontmatter.crash_count) || 0;
    tryUnclaim('crash', { crash_count: existingCrashCount + 1 });
    return { action: 'restart', classification };
  }

  if (cls === 'output_unparseable') {
    // Stop worker; emit adapter-bug; surface stdout+stderr.
    const stdoutTail = result && result.stdout ? result.stdout.slice(-2000) : '';
    const stderrTail = result && result.stderr ? result.stderr.slice(-2000) : '';
    logWrite({ kind: 'adapter-bug', runtime, ref: work && work.ref ? work.ref : null, reason_text: classification.reason_text, stdout_tail: stdoutTail, stderr_tail: stderrTail });
    tryUnclaim('output-unparseable');
    return { action: 'surface', classification, stopWorker: true };
  }

  // unknown — log stderr tail, do NOT retry, do NOT route to fallback.
  const stderrTail = result && result.stderr ? result.stderr.split('\n').slice(-50).join('\n') : '';
  logWrite({ kind: 'unknown-failure', runtime, ref: work && work.ref ? work.ref : null, stderr_tail: stderrTail });
  tryUnclaim('unknown-failure');
  return { action: 'surface', classification };
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

  // Clear any stale stop flag from a previous run or a restart signal
  try { fs.unlinkSync(stopFlagPath(baseDir, id)); } catch {}

  const isParkingEnabled = parkingEnabled(process.env);
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
    parking_enabled: isParkingEnabled,
  });
  logWrite({ kind: 'worker-start', role, lane, runtime, runtime_cmd: runtimeCmd, tick_ms: tickMs, parking_enabled: isParkingEnabled });

  const handoffsLib = loadHandoffsLib();
  const agentDetect = loadAgentDetect();

  function trySelfClaim() {
    if (!handoffsLib || !agentDetect) return null;
    try {
      const open = handoffsLib.listHandoffs({ baseDir, bucket: 'open' });
      if (open.length === 0) return null;
      const globalFallbacks = loadGlobalFallbacks(baseDir);
      const compat = open.filter((handoff) => {
        const hlane = handoff.frontmatter && handoff.frontmatter.lane;
        // Skip handoffs that have already bounced too many times — they
        // need operator attention (account rotation, runtime swap, or
        // dispatch rewrite) instead of more retries.
        if (isHandoffExhausted(handoff.frontmatter)) return false;
        return agentDetect.isHandoffCompatible(handoff.frontmatter, runtime) && matchesLane(lane, hlane);
      });
      if (compat.length === 0) return null;
      const sorted = agentDetect.sortHandoffsForPickup(compat, runtime, { globalFallbacks });
      const pick = sorted[0];
      handoffsLib.claimHandoff({ baseDir, id: pick.id, agent: `team-${id}`, runtime });
      const loaded = handoffsLib.readHandoff({ baseDir, id: pick.id });
      return {
        kind: 'handoff',
        ref: pick.id,
        projectid: (pick.frontmatter && pick.frontmatter.projectid) || null,
        body: (loaded && loaded.body) || '',
        frontmatter: (loaded && loaded.frontmatter) || {},
      };
    } catch (err) {
      logWrite({ kind: 'self-claim-error', error: err.message });
      return null;
    }
  }

  while (!stopRequested(baseDir, id)) {
    let work = null;
    // Token-drain fix 2026-05-09: honor isParked() BEFORE consuming a mailbox
    // entry too, not just on self-claim. Without this, the dispatcher can
    // route a handoff into a worker mailbox while the runtime is parked, and
    // the worker spawns the parked runtime anyway — burning premium tokens
    // for a known-rate-limited account. See incident notes 2026-05-09.
    if (isParked(baseDir, runtime)) {
      logWrite({ kind: 'runtime-parked-skip-claim', runtime, parking_enabled: true, source: 'pre-pop' });
      await sleep(tickMs);
      continue;
    }
    const popped = popOldest(baseDir, id);
    if (popped) {
      const m = popped.msg;
      let body = '';
      let frontmatter = {};
      let claimFailed = false;
      if (m.kind === 'handoff' && handoffsLib) {
        try {
          handoffsLib.claimHandoff({ baseDir, id: m.ref, agent: `team-${id}`, runtime });
          const loaded = handoffsLib.readHandoff({ baseDir, id: m.ref });
          body = (loaded && loaded.body) || '';
          frontmatter = (loaded && loaded.frontmatter) || {};
        } catch (err) {
          claimFailed = true;
          logWrite({ kind: 'claim-error', ref: m.ref, error: err.message });
        }
      }
      // Skip work items whose claim failed (already in claimed/ or closed/) or
      // whose body is empty for any other reason — running the runtime with an
      // empty prompt burns tokens and produces no useful output. Discarding the
      // popped message via continue is fine: the dispatcher will not re-enqueue
      // a handoff that no longer sits in open/.
      if (m.kind === 'handoff' && (claimFailed || !body)) {
        logWrite({ kind: 'work-skip-empty-body', ref: m.ref, reason: claimFailed ? 'claim-failed' : 'empty-body' });
        // Drain the dead message so popOldest doesn't return it again next tick.
        // Without this, a mailbox entry referring to a closed/missing handoff
        // would loop forever (every tickMs, ~once/2s, hours/days).
        markFailed(popped.fullPath);
        await sleep(tickMs);
        continue;
      }
      work = { kind: m.kind, ref: m.ref, projectid: m.projectid, body, frontmatter, _popped: popped };
    } else {
      // isParked check is always honored (quota parking is always-on for quota_soft/quota_hard_cap).
      if (isParked(baseDir, runtime)) {
        logWrite({ kind: 'runtime-parked-skip-claim', runtime, parking_enabled: true });
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
    const promptText = composePrompt(work, {
      workerId: id,
      lane,
      runtime,
      skillsScope: cfg.skills && cfg.skills.scope ? cfg.skills.scope : {},
    });
    fs.writeFileSync(promptFile, promptText);

    updateStatus(baseDir, id, {
      state: 'WORKING',
      current_ref: work.ref,
      current_started_at: new Date().toISOString(),
    });
    let activeAccount = getActiveRuntimeAccount(baseDir, runtime, process.env, { workerId: id });
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
      // Token-drain fix 2026-05-09: hard ceiling on inner rotation spawns.
      // Without this, a handoff that hits rate-limit on every account in a
      // runtime's pool will rotate through ALL accounts and burn ~10K input
      // tokens per spawn (the snapshot prompt) before falling through. The
      // ceiling keeps a single work-start bounded regardless of pool size.
      const MAX_INNER_ROTATIONS = 3;
      let innerRotations = 0;
      // Task 107-10: when the work item is a handoff, pipe the runtime's
      // stdin from `gad snapshot --handoff <id>` so the runtime sees a
      // unified prompt (orientation + matched skill bodies + handoff body).
      // The local promptFile is still written for audit/logging.
      const subprocessOpts = work.kind === 'handoff' && work.ref
        ? { handoffId: work.ref }
        : {};
      for (;;) {
        result = await runSubprocess(
          baseDir,
          id,
          runtimeCmd,
          promptFile,
          logWrite,
          activeAccount ? activeAccount.env : null,
          subprocessOpts,
        );
        if (!(result.rate_limited && work.kind === 'handoff' && handoffsLib)) break;
        if (activeAccount && Number.isInteger(activeAccount.index)) {
          attemptedAccountIndexes.add(activeAccount.index);
        }
        // Hard ceiling: stop rotating after MAX_INNER_ROTATIONS even if more
        // accounts remain. Force unclaim path so the per-handoff retry filter
        // sees an unclaim_history entry and trips eventually.
        if (innerRotations >= MAX_INNER_ROTATIONS) {
          logWrite({
            kind: 'runtime-rotation-ceiling-hit',
            runtime,
            ref: work.ref,
            rotations: innerRotations,
            ceiling: MAX_INNER_ROTATIONS,
          });
          try {
            handoffsLib.unclaimHandoff({ baseDir, id: work.ref, reason: 'rate-limit', by: `team-${id}` });
            logWrite({ kind: 'handoff-unclaimed', ref: work.ref, reason: 'rate-limit', source: 'rotation-ceiling' });
          } catch (err) {
            logWrite({ kind: 'handoff-unclaim-error', ref: work.ref, error: err.message });
          }
          break;
        }
        // Re-check parking before rotating: if the runtime got parked by
        // a prior failure classification, skip further rotation spawns.
        if (isParked(baseDir, runtime)) {
          logWrite({ kind: 'runtime-parked-skip-rotation', runtime, ref: work.ref });
          try {
            handoffsLib.unclaimHandoff({ baseDir, id: work.ref, reason: 'rate-limit', by: `team-${id}` });
            logWrite({ kind: 'handoff-unclaimed', ref: work.ref, reason: 'rate-limit', source: 'mid-rotation-park' });
          } catch (err) {
            logWrite({ kind: 'handoff-unclaim-error', ref: work.ref, error: err.message });
          }
          break;
        }
        const rateLimitOutcome = handleRateLimitedHandoff({
          baseDir,
          runtime,
          work,
          handoffsLib,
          workerId: id,
          logWrite,
          attemptedAccountIndexes: Array.from(attemptedAccountIndexes),
          result,
        });
        if (rateLimitOutcome.action !== 'rotated') break;
        activeAccount = rateLimitOutcome.account;
        innerRotations += 1;
      }
    } finally {
      clearInterval(heartbeatTimer);
    }
    // Use typed classification from subprocess result (set by terminateForRuntimeFailure).
    const finalClassification = result.classification || classifyRuntimeError(result.stderr, result.code, runtime);

    // Extract model_id + token counts from stdout on success path (GAD-T-35-17).
    // Always attempt extraction so the log has telemetry even when exit_code != 0
    // but stdout contains a partial result record.
    const telemetry = (result.code === 0 && !result.rate_limited && result.stdout)
      ? await extractTelemetry(runtime, result.stdout)
      : { model_id: null, tokens_in: null, tokens_out: null };

    logWrite({
      kind: 'work-complete',
      ref: work.ref,
      exit_code: result.code,
      rate_limited: !!result.rate_limited,
      classification: finalClassification,
      duration_ms: Date.now() - workStartMs,
      stdout_bytes: result.stdout.length,
      stderr_bytes: result.stderr.length,
      model_id: telemetry.model_id,
      tokens_in: telemetry.tokens_in,
      tokens_out: telemetry.tokens_out,
    });

    // Per-class dispatcher behavior (GLOBAL-D-313).
    // Only engage on handoff work — task/mailbox items use legacy path.
    const isFailure = result.code !== 0 || result.rate_limited;
    if (isFailure && work.kind === 'handoff' && handoffsLib && finalClassification.class !== 'unknown') {
      const classOutcome = handleClassifiedFailure(finalClassification, {
        baseDir,
        runtime,
        work,
        handoffsLib,
        workerId: id,
        logWrite,
        result,
      });
      if (work._popped) markFailed(work._popped.fullPath);

      // auth_failed / malformed_argv: stop the worker (adapter or auth bug).
      if (classOutcome.stopWorker) {
        updateStatus(baseDir, id, { state: 'STOPPED', stopped_at: new Date().toISOString(), pid: null });
        logWrite({ kind: 'worker-stop', reason: `classified-failure:${finalClassification.class}` });
        break;
      }

      updateStatus(baseDir, id, { state: 'IDLE', current_ref: null, current_started_at: null });
      await sleep(tickMs);
      continue;
    }

    // Legacy rate-limit path (back-compat for unknown quota signals).
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

    if (result.code === 0 && !result.rate_limited && work.kind === 'handoff') {
      // Token-drain incident 2026-05-09 fix: the worker MUST call
      // completeHandoff itself on success. Previously completion was
      // delegated to the child runtime invoking `gad handoffs complete`
      // from inside its execution — but codex sandbox policy blocked
      // those calls, leaving the handoff in claimed/ indefinitely. Result:
      // 66 of 264 closed handoffs had completed_at:null and had to be
      // force-moved during incident response. The child may still call
      // completeHandoff first (legitimate path), in which case our call
      // throws HANDOFF_NOT_FOUND — that's a success too.
      if (handoffsLib && work.ref) {
        try {
          handoffsLib.completeHandoff({ baseDir, id: work.ref });
          logWrite({ kind: 'handoff-completed', ref: work.ref, source: 'worker-loop' });
        } catch (err) {
          if (err && err.code === 'HANDOFF_NOT_FOUND') {
            logWrite({ kind: 'handoff-completed', ref: work.ref, source: 'child-runtime-or-prior' });
          } else {
            logWrite({ kind: 'handoff-complete-error', ref: work.ref, error: err && err.message ? err.message : String(err) });
          }
        }
      }
      maybeQueueReview({
        baseDir,
        cfg,
        spec,
        workerId: id,
        lane,
        runtime,
        work,
        result,
        handoffsLib,
        logWrite,
      });
    }

    updateStatus(baseDir, id, { state: 'IDLE', current_ref: null, current_started_at: null });
  }

  logWrite({ kind: 'worker-stop', reason: 'stop.flag' });
  updateStatus(baseDir, id, { state: 'STOPPED', stopped_at: new Date().toISOString(), pid: null });
  try { fs.unlinkSync(stopFlagPath(baseDir, id)); } catch {}
}

module.exports = { runWorker, handleRateLimitedHandoff, handleClassifiedFailure };
