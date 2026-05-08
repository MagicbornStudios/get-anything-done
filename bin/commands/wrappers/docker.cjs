'use strict';
/**
 * gad docker — thin passthrough wrapper for the `docker` binary.
 *
 * Forwards all args verbatim via spawnSync + appends a structured log
 * envelope to .planning/.gad-log/<date>.jsonl so SLM tool-action specialists
 * train on a uniform verb space. GLOBAL-D-316 / task 75-26.
 *
 * Invoked by the early-exit interceptor in bin/gad.cjs BEFORE citty runs,
 * so all flags (including --version, --help, build, run, ps, etc.) reach
 * `docker` unchanged.
 *
 * Usage (same as raw docker):
 *   gad docker <args...>
 *   gad docker --version
 *   gad docker ps
 *   gad docker build -t <tag> .
 */

const { runWrapper } = require('../../../lib/wrapper-base.cjs');

/**
 * Entry point called by bin/gad.cjs early-exit interceptor.
 * @param {string[]} args - Everything after 'docker' in process.argv
 */
function run(args) {
  runWrapper({ command: 'docker', args });
}

module.exports = { run };
