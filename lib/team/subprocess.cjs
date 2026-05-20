'use strict';
/**
 * lib/team/subprocess.cjs — run the runtime CLI against a prompt source.
 *
 * Two pipe modes (task 107-10, 2026-05-05):
 *   1. handoffId set → `gad snapshot --handoff <id> | runtime_cmd`
 *      Unified prompt: orientation + matched skill bodies + handoff body.
 *      Reaches codex/gemini/opencode through the same code path that
 *      claude-code uses, so non-claude runtimes finally see skill bodies
 *      as plain stdin orientation text instead of relying on a registry
 *      they don't have.
 *   2. handoffId absent → legacy `cat promptFile | runtime_cmd`
 *      For task-only work where a handoff doesn't exist.
 *
 * Resolves { code, stdout, stderr, rate_limited, error? } — never rejects.
 *
 * Rate-limit detection (operator directive 2026-05-03): when stderr matches
 * known provider rate-limit patterns, set rate_limited=true so the worker
 * loop can park the runtime + try a fallback instead of marking the handoff
 * failed. See lib/team/rate-limit.cjs for the pattern set + cooldown logic.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isRateLimited, classifyRuntimeError } = require('./rate-limit.cjs');
const { resolveGadExecPath } = require('../start-cmd.cjs');

function buildHandoffPipeCmd(handoffId) {
  // Use the same gad binary the worker is running under so behavior matches
  // the source/release in play. Quote the id to survive any colons.
  const { cmd, args } = resolveGadExecPath();
  const parts = [cmd, ...args, 'snapshot', '--handoff', handoffId];
  // Each segment quoted for bash -c. Use single-arg quoting that handles
  // backslashes on Windows (path is `C:\Users\…\gad.exe`).
  return parts.map((p) => `"${String(p).replace(/"/g, '\\"')}"`).join(' ');
}

// Read a soul's operating charter/body for prompt injection. Prefers a
// concise `<soul>-CHARTER.md` over the full `<soul>.md`, capped so we don't
// bloat every worker handoff. Returns '' when the soul file is absent.
function readSoulBody(baseDir, soul) {
  if (!soul || !baseDir) return '';
  const candidates = [
    path.join(baseDir, 'narrative', 'souls', `${soul}-CHARTER.md`),
    path.join(baseDir, 'narrative', 'souls', `${soul}.md`),
  ];
  for (const p of candidates) {
    try {
      const body = fs.readFileSync(p, 'utf8');
      if (body && body.trim()) return body.trim().slice(0, 2500);
    } catch { /* try next candidate */ }
  }
  return '';
}

// Build the worker's soul+skills preamble prepended to the prompt pipe when
// the resolved agent-profile set GAD_WORKER_SOUL / GAD_WORKER_SKILLS
// (GLOBAL-D-406 / 265-84). The soul BODY (charter) is assembled so the runtime
// actually adopts the voice — not just a pointer. Skill BODIES already flow
// via `gad snapshot --handoff`, so skills stay a load-pointer here to avoid
// double-injection + token bloat. Written to a temp file and `cat`-ed into the
// pipe (robust vs. shell-escaping multi-KB markdown). Returns a bash segment
// ending in `; ` or '' when neither soul nor skills are set.
function buildProfilePreamble(baseDir, workerId) {
  const soul = process.env.GAD_WORKER_SOUL || '';
  const skills = process.env.GAD_WORKER_SKILLS || '';
  if (!soul && !skills) return '';

  const lines = ['[GAD WORKER PROFILE]'];
  if (soul) {
    const body = readSoulBody(baseDir, soul);
    if (body) {
      lines.push(`You are operating as the soul "${soul}". Adopt this voice and operating charter:`);
      lines.push('');
      lines.push(body);
      lines.push('');
    } else {
      lines.push(`soul=${soul} — adopt this voice/role for this work.`);
    }
  }
  if (skills) {
    lines.push(`Load these skills before relevant work (their bodies arrive in the orientation snapshot below): ${skills}.`);
  }
  const text = lines.join('\n') + '\n\n';

  try {
    const tmp = path.join(os.tmpdir(), `gad-worker-preamble-${workerId || 'x'}.txt`);
    fs.writeFileSync(tmp, text, 'utf8');
    // Forward-slash the path so bash -c (git-bash on Windows) reads it cleanly.
    return `cat "${tmp.replace(/\\/g, '/')}"; `;
  } catch {
    const esc = `[GAD WORKER PROFILE] soul=${soul} skills=${skills}`
      .replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `printf '%s\\n\\n' "${esc}"; `;
  }
}

function runSubprocess(baseDir, workerId, runtimeCmd, promptFile, logWrite, runtimeEnv = null, opts = {}) {
  return new Promise((resolve) => {
    if (runtimeEnv && runtimeEnv.GAD_RUNTIME_ACCOUNT_SOURCE_FILE && runtimeEnv.GAD_RUNTIME_ACCOUNT_CANONICAL_PATH) {
      fs.mkdirSync(path.dirname(runtimeEnv.GAD_RUNTIME_ACCOUNT_CANONICAL_PATH), { recursive: true });
      fs.copyFileSync(runtimeEnv.GAD_RUNTIME_ACCOUNT_SOURCE_FILE, runtimeEnv.GAD_RUNTIME_ACCOUNT_CANONICAL_PATH);
    }
    const shouldUseCodexTelemetry =
      process.env.GAD_SESSION_TELEMETRY === '1'
      && /^\s*codex\b.*\bexec\b/i.test(String(runtimeCmd || ''));
    const telemetryWrapper = path.join(baseDir, 'scripts', 'codex-session-emit.cjs');
    const handoffId = opts && opts.handoffId ? String(opts.handoffId) : '';
    const rawPromptSource = handoffId
      ? buildHandoffPipeCmd(handoffId)
      : `cat "${promptFile}"`;
    const preamble = buildProfilePreamble(baseDir, workerId);
    const promptSource = preamble
      ? `( ${preamble}${rawPromptSource} )`
      : rawPromptSource;
    const shellCmd = shouldUseCodexTelemetry
      ? `${promptSource} | node "${telemetryWrapper}"`
      : `${promptSource} | ${runtimeCmd}`;
    const child = spawn('bash', ['-c', shellCmd], {
      cwd: baseDir,
      env: {
        ...process.env,
        ...(runtimeEnv || {}),
        GAD_TEAM_WORKER_ID: workerId,
        GAD_AGENT_NAME: `team-${workerId}`,
        ...(shouldUseCodexTelemetry ? { GAD_CODEX_RUNTIME_CMD: runtimeCmd } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks = { stdout: [], stderr: [] };
    let settled = false;
    let closeSeen = false;
    let rateLimitedMidstream = false;
    let lastClassification = null;
    let forceKillTimer = null;

    function clearForceKillTimer() {
      if (!forceKillTimer) return;
      clearTimeout(forceKillTimer);
      forceKillTimer = null;
    }

    function finalize(code, extra = {}) {
      if (settled) return;
      settled = true;
      clearForceKillTimer();
      const stderr = chunks.stderr.join('');
      const stdout = chunks.stdout.join('');
      const finalClassification = lastClassification || classifyRuntimeError(stderr, code, opts && opts.runtimeId ? opts.runtimeId : null);
      resolve({
        code,
        stdout,
        stderr,
        rate_limited: rateLimitedMidstream || isRateLimited(stderr, stdout),
        classification: finalClassification,
        ...extra,
      });
    }

    function terminateForRateLimit() {
      if (rateLimitedMidstream) return;
      rateLimitedMidstream = true;
      if (logWrite) {
        // Legacy back-compat: emit old kind for one release for log readers.
        logWrite({
          kind: 'rate-limit-detected-midstream',
          runtime_cmd: runtimeCmd,
        });
      }
      try {
        child.kill('SIGTERM');
      } catch (err) {
        if (logWrite) logWrite({ kind: 'subproc-kill-error', signal: 'SIGTERM', error: err.message });
      }
      if (process.platform === 'win32') {
        forceKillTimer = setTimeout(() => {
          if (closeSeen) return;
          try {
            child.kill('SIGKILL');
          } catch (err) {
            if (logWrite) logWrite({ kind: 'subproc-kill-error', signal: 'SIGKILL', error: err.message });
          }
        }, 2000);
        if (forceKillTimer.unref) forceKillTimer.unref();
      }
    }

    /**
     * terminateForRuntimeFailure — typed replacement for terminateForRateLimit.
     * Logs `kind: 'runtime-failure-classified'` with the full classification object
     * AND emits the legacy `kind: 'rate-limit-detected-midstream'` for back-compat.
     * @param {{ class: string, cooldown_ms: number|null, cooldown_until: number|null, reason_text: string }} classification
     */
    function terminateForRuntimeFailure(classification) {
      if (rateLimitedMidstream) return;
      rateLimitedMidstream = true;
      lastClassification = classification;
      if (logWrite) {
        // New structured log entry with full classification.
        logWrite({
          kind: 'runtime-failure-classified',
          runtime_cmd: runtimeCmd,
          classification,
        });
        // Legacy back-compat: keep emitting old kind for one release.
        logWrite({
          kind: 'rate-limit-detected-midstream',
          runtime_cmd: runtimeCmd,
        });
      }
      try {
        child.kill('SIGTERM');
      } catch (err) {
        if (logWrite) logWrite({ kind: 'subproc-kill-error', signal: 'SIGTERM', error: err.message });
      }
      if (process.platform === 'win32') {
        forceKillTimer = setTimeout(() => {
          if (closeSeen) return;
          try {
            child.kill('SIGKILL');
          } catch (err) {
            if (logWrite) logWrite({ kind: 'subproc-kill-error', signal: 'SIGKILL', error: err.message });
          }
        }, 2000);
        if (forceKillTimer.unref) forceKillTimer.unref();
      }
    }

    child.stdout.on('data', d => {
      const s = String(d);
      chunks.stdout.push(s);
      if (logWrite) logWrite({ kind: 'subproc-stdout', data: s.slice(0, 2000) });
    });
    child.stderr.on('data', d => {
      const s = String(d);
      chunks.stderr.push(s);
      if (logWrite) logWrite({ kind: 'subproc-stderr', data: s.slice(0, 2000) });
      // Use the typed classifier; fall through to legacy terminateForRateLimit
      // only if the classified error is a quota type (back-compat for consumers
      // that check result.rate_limited).
      const classification = classifyRuntimeError(s, null, opts && opts.runtimeId ? opts.runtimeId : null);
      if (classification.class !== 'unknown') {
        terminateForRuntimeFailure(classification);
      } else if (isRateLimited(s, '')) {
        terminateForRateLimit();
      }
    });
    child.on('error', (err) => {
      if (logWrite) logWrite({ kind: 'subproc-error', error: err.message });
      finalize(-1, { error: err.message });
    });
    child.on('close', (code) => {
      closeSeen = true;
      finalize(code);
    });
  });
}

module.exports = { runSubprocess };
