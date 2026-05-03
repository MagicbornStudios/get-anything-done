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
const { isRateLimited } = require('./rate-limit.cjs');

function runSubprocess(baseDir, workerId, runtimeCmd, promptFile, logWrite) {
  return new Promise((resolve) => {
    const shellCmd = `cat "${promptFile}" | ${runtimeCmd}`;
    const child = spawn('bash', ['-c', shellCmd], {
      cwd: baseDir,
      env: { ...process.env, GAD_TEAM_WORKER_ID: workerId, GAD_AGENT_NAME: `team-${workerId}` },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks = { stdout: [], stderr: [] };
    child.stdout.on('data', d => {
      const s = String(d);
      chunks.stdout.push(s);
      if (logWrite) logWrite({ kind: 'subproc-stdout', data: s.slice(0, 2000) });
    });
    child.stderr.on('data', d => {
      const s = String(d);
      chunks.stderr.push(s);
      if (logWrite) logWrite({ kind: 'subproc-stderr', data: s.slice(0, 2000) });
    });
    child.on('error', (err) => {
      if (logWrite) logWrite({ kind: 'subproc-error', error: err.message });
      const stderr = chunks.stderr.join('');
      const stdout = chunks.stdout.join('');
      resolve({
        code: -1,
        stdout,
        stderr,
        rate_limited: isRateLimited(stderr, stdout),
        error: err.message,
      });
    });
    child.on('close', (code) => {
      const stderr = chunks.stderr.join('');
      const stdout = chunks.stdout.join('');
      resolve({
        code,
        stdout,
        stderr,
        rate_limited: isRateLimited(stderr, stdout),
      });
    });
  });
}

module.exports = { runSubprocess };
