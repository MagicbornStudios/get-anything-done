'use strict';

const fs = require('fs');
const path = require('path');
const { pickNodeExecutable } = require('./node-exec.cjs');

function detectRuntimeSubstrateRepoRoot(baseDir) {
  const candidates = [];
  const addCandidate = (dir) => {
    if (!dir) return;
    const resolved = path.resolve(dir);
    if (!candidates.includes(resolved)) candidates.push(resolved);
  };

  addCandidate(baseDir);
  addCandidate(process.cwd());
  addCandidate(path.resolve(__dirname, '..', '..'));

  let cursor = path.resolve(baseDir);
  for (let i = 0; i < 6; i += 1) {
    addCandidate(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  for (const root of candidates) {
    const marker = path.join(root, 'scripts', 'runtime-substrate-core.mjs');
    if (fs.existsSync(marker)) return root;
  }
  return null;
}

function resolveRuntimeScriptPath(runtimeRepoRoot, scriptName) {
  const scriptPath = path.join(runtimeRepoRoot, 'scripts', scriptName);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Runtime substrate script not found: ${scriptPath}`);
  }
  return scriptPath;
}

function runRuntimeScriptJson(runtimeRepoRoot, scriptName, scriptArgs) {
  const { spawnSync } = require('child_process');
  const scriptPath = resolveRuntimeScriptPath(runtimeRepoRoot, scriptName);
  const result = spawnSync(pickNodeExecutable(), [scriptPath, ...scriptArgs], {
    cwd: runtimeRepoRoot,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(stderr || stdout || `${scriptName} failed with exit ${result.status}`);
  }

  const raw = (result.stdout || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(lines[i]);
      } catch {}
    }
    throw new Error(`Expected JSON output from ${scriptName}, received non-JSON payload.`);
  }
}

module.exports = {
  detectRuntimeSubstrateRepoRoot,
  resolveRuntimeScriptPath,
  runRuntimeScriptJson,
};
