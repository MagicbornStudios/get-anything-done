'use strict';

const fs = require('fs');
const path = require('path');

function isGadSeaBinary(execPath) {
  const base = path.basename(String(execPath || '')).toLowerCase();
  return base === 'gad.exe' || base === 'gad';
}

function isPackagedRuntime(execPath, env = process.env) {
  return Boolean(
    (env && (env.GAD_PACKAGED_EXECUTABLE || env.GAD_PACKAGED_ROOT))
    || isGadSeaBinary(execPath),
  );
}

function pickNodeExecutableFor(execPath, env = process.env) {
  if (isPackagedRuntime(execPath, env)) return 'node';
  return execPath;
}

function pickNodeExecutable() {
  return pickNodeExecutableFor(process.execPath, process.env);
}

function existingFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function maybeDevSourceFromEnv(env = process.env) {
  const raw = env && env.GAD_DEV_SOURCE_DIR;
  if (!raw) return null;
  const resolved = path.resolve(String(raw));
  const candidate = path.basename(resolved).toLowerCase() === 'gad.cjs'
    ? resolved
    : path.join(resolved, 'bin', 'gad.cjs');
  return existingFile(candidate) ? candidate : null;
}

function ancestors(startDir) {
  const dirs = [];
  let current = path.resolve(startDir || process.cwd());
  for (;;) {
    dirs.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

function resolveDevSourceGadCli(startDir = process.cwd(), env = process.env) {
  const envCandidate = maybeDevSourceFromEnv(env);
  if (envCandidate) return envCandidate;

  const seen = new Set();
  const starts = [startDir, process.cwd()].filter(Boolean);
  for (const start of starts) {
    for (const dir of ancestors(start)) {
      if (seen.has(dir)) continue;
      seen.add(dir);
      const monorepoCandidate = path.join(dir, 'vendor', 'get-anything-done', 'bin', 'gad.cjs');
      if (existingFile(monorepoCandidate)) return monorepoCandidate;
      const packageCandidate = path.join(dir, 'bin', 'gad.cjs');
      if (existingFile(packageCandidate)) return packageCandidate;
    }
  }
  return null;
}

function resolveWorkerGadCli(gadBinary, options = {}) {
  return resolveDevSourceGadCli(options.cwd || process.cwd(), options.env || process.env) || gadBinary;
}

module.exports = {
  pickNodeExecutable,
  pickNodeExecutableFor,
  isGadSeaBinary,
  isPackagedRuntime,
  resolveDevSourceGadCli,
  resolveWorkerGadCli,
};
