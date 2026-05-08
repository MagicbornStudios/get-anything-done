'use strict';
/**
 * gad git — thin passthrough wrapper for the `git` binary.
 *
 * Forwards all args verbatim via spawnSync + appends a structured log
 * envelope to .planning/.gad-log/<date>.jsonl so SLM tool-action specialists
 * train on a uniform verb space. GLOBAL-D-316 / tasks 75-15.
 *
 * Invoked by the early-exit interceptor in bin/gad.cjs BEFORE citty runs,
 * so all flags (including --version, --help, -C, etc.) reach `git` unchanged.
 *
 * Usage (same as raw git):
 *   gad git <args...>
 *   gad git status
 *   gad git --version
 *   gad git log --oneline -5
 */

const { runWrapper } = require('../../../lib/wrapper-base.cjs');

/**
 * Entry point called by bin/gad.cjs early-exit interceptor.
 * @param {string[]} args - Everything after 'git' in process.argv
 */
function run(args) {
  runWrapper({ command: 'git', args });
}

module.exports = { run };
