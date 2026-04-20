/**
 * Framework version reader — returns the GAD commit, branch, and version the
 * current process is running against. Stamped into TRACE.json by the eval
 * preserver so cross-version score comparisons can distinguish "agent
 * improved" from "framework changed" (decisions gad-51, gad-53, gad-54).
 *
 * Referenced by phase 25 plan task 25-12.
 *
 * Task 66-06: when a bundled exe includes build-stamp.generated.cjs, prefer
 * it over runtime git. The bundled exe has no git repo to query and resolves
 * to the user's cwd otherwise.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function safeExec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
  } catch {
    return null;
  }
}

function loadBuildStamp() {
  try {
    return require('./build-stamp.generated.cjs');
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') return null;
    throw err;
  }
}

/**
 * Read the framework version object. Prefers the build-time stamp (frozen
 * at bundle time by scripts/build-stamp.mjs); falls back to walking up from
 * __dirname + shelling to git when the stamp is absent (dev / unbundled).
 */
function getFrameworkVersion() {
  const stamp = loadBuildStamp();
  if (stamp) {
    return {
      version: stamp.version || null,
      methodology_version: stamp.methodology_version || null,
      commit: stamp.commit || null,
      branch: stamp.branch || null,
      commit_ts: stamp.commit_ts || null,
      src_hash: stamp.src_hash || null,
      built_at: stamp.built_at || null,
      stamp: stamp.version && stamp.commit
        ? `v${stamp.version}+${stamp.commit}`
        : stamp.version || stamp.commit || 'unknown',
    };
  }

  const gadRoot = path.resolve(__dirname, '..');
  const pkgPath = path.join(gadRoot, 'package.json');
  let version = null;
  let methodologyVersion = null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    version = pkg.version || null;
    methodologyVersion = pkg.gadMethodologyVersion || null;
  } catch {
    // Package not readable — still return whatever git info we can.
  }

  const commit = safeExec('git rev-parse --short HEAD', gadRoot);
  const branch = safeExec('git rev-parse --abbrev-ref HEAD', gadRoot);
  const commitTs = safeExec('git log -1 --format=%cI', gadRoot);

  return {
    version,
    methodology_version: methodologyVersion,
    commit,
    branch,
    commit_ts: commitTs,
    src_hash: null,
    built_at: null,
    // Convenience: a human-readable "stamp" field consumers can embed when
    // they don't need to split the components.
    stamp: version && commit ? `v${version}+${commit}` : version || commit || 'unknown',
  };
}

module.exports = { getFrameworkVersion };
