'use strict';
/**
 * gad modal — thin passthrough wrapper for the `modal` binary.
 *
 * Forwards all args verbatim via spawnSync + appends a structured log
 * envelope to .planning/.gad-log/<date>.jsonl so SLM tool-action specialists
 * train on a uniform verb space. GLOBAL-D-316 / task 75-23.
 *
 * Invoked by the early-exit interceptor in bin/gad.cjs BEFORE citty runs,
 * so all flags (including --version, --help, run, deploy, etc.) reach
 * `modal` unchanged.
 *
 * Usage (same as raw modal):
 *   gad modal <args...>
 *   gad modal --version
 *   gad modal run <file>
 *   gad modal deploy <file>
 */

const { runWrapper } = require('../../../lib/wrapper-base.cjs');

/**
 * Entry point called by bin/gad.cjs early-exit interceptor.
 * @param {string[]} args - Everything after 'modal' in process.argv
 */
function run(args) {
  runWrapper({ command: 'modal', args });
}

module.exports = { run };
