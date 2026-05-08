'use strict';
/**
 * gad gh — thin passthrough wrapper for the GitHub CLI (`gh`) binary.
 *
 * Forwards all args verbatim via spawnSync + appends a structured log
 * envelope to .planning/.gad-log/<date>.jsonl so SLM tool-action specialists
 * train on a uniform verb space. GLOBAL-D-316 / tasks 75-16.
 *
 * Invoked by the early-exit interceptor in bin/gad.cjs BEFORE citty runs,
 * so all flags (including --help, --version, auth, pr, etc.) reach `gh` unchanged.
 *
 * Usage (same as raw gh):
 *   gad gh <args...>
 *   gad gh --help
 *   gad gh pr list
 *   gad gh repo view
 */

const { runWrapper } = require('../../../lib/wrapper-base.cjs');

/**
 * Entry point called by bin/gad.cjs early-exit interceptor.
 * @param {string[]} args - Everything after 'gh' in process.argv
 */
function run(args) {
  runWrapper({ command: 'gh', args });
}

module.exports = { run };
