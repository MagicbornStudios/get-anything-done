'use strict';
/**
 * lib/team/subprocess.cjs — run the runtime CLI against a prompt file.
 *
 * Shell-delegates via `bash -c "cat promptFile | <runtime_cmd>"` so stdin
 * piping works cross-platform (Git Bash on Windows, native elsewhere).
 * Resolves { code, stdout, stderr, rate_limited, error? } — never rejects.
 *
 * Rate-limit detection (operator directive 2026-05-03): when stderr matches
 * known provider rate-limit patterns, set rate_limited=true so the worker
 * loop can park the runtime + try a fallback instead of marking the handoff
 * failed. See lib/team/rate-limit.cjs for the pattern set + cooldown logic.
 */

const { spawn } = require('child_process');
const path = require('path');
const { isRateLimited } = require('./rate-limit.cjs');

function runSubprocess(baseDir, workerId, runtimeCmd, promptFile, logWrite) {
  return new Promise((resolve) => {
    const shouldUseCodexTelemetry =
      process.env.GAD_SESSION_TELEMETRY === '1'
      && /^\s*codex\b.*\bexec\b/i.test(String(runtimeCmd || ''));
    const telemetryWrapper = path.join(baseDir, 'scripts', 'codex-session-emit.cjs');
    const shellCmd = shouldUseCodexTelemetry
      ? `cat "${promptFile}" | node "${telemetryWrapper}"`
      : `cat "${promptFile}" | ${runtimeCmd}`;
    const child = spawn('bash', ['-c', shellCmd], {
      cwd: baseDir,
      env: {
        ...process.env,
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
