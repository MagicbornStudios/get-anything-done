/**
 * Framework version reader — returns the GAD commit, branch, and version the
 * current process is running against. Stamped into TRACE.json by the eval
 * preserver so cross-version score comparisons can distinguish "agent
 * improved" from "framework changed" (decisions gad-51, gad-53, gad-54).
 *
 * Referenced by phase 25 plan task 25-12.
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

/**
 * Read the framework version object. Walks up from __dirname to find the GAD
 * package.json and runs git commands in that directory (not process.cwd()).
 * Works whether GAD is installed as a submodule, vendored, or via npm.
 */
function getFrameworkVersion() {
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
    // Convenience: a human-readable "stamp" field consumers can embed when
    // they don't need to split the components.
    stamp: version && commit ? `v${version}+${commit}` : version || commit || 'unknown',
  };
}

module.exports = { getFrameworkVersion };
