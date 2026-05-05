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
const path = require('path');
const { isRateLimited } = require('./rate-limit.cjs');
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
    const promptSource = handoffId
      ? buildHandoffPipeCmd(handoffId)
      : `cat "${promptFile}"`;
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
      resolve({
        code,
        stdout,
        stderr,
        rate_limited: rateLimitedMidstream || isRateLimited(stderr, stdout),
        ...extra,
      });
    }

    function terminateForRateLimit() {
      if (rateLimitedMidstream) return;
      rateLimitedMidstream = true;
      if (logWrite) {
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
      if (isRateLimited(s, '')) terminateForRateLimit();
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
