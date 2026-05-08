'use strict';
/**
 * gad vercel — thin passthrough wrapper for the `vercel` binary.
 *
 * Forwards all args verbatim via spawnSync + appends a structured log
 * envelope to .planning/.gad-log/<date>.jsonl so SLM tool-action specialists
 * train on a uniform verb space. GLOBAL-D-316 / task 75-25.
 *
 * Invoked by the early-exit interceptor in bin/gad.cjs BEFORE citty runs,
 * so all flags (including --version, --help, deploy, env, etc.) reach
 * `vercel` unchanged.
 *
 * Usage (same as raw vercel):
 *   gad vercel <args...>
 *   gad vercel --version
 *   gad vercel deploy
 *   gad vercel env ls
 */

const { runWrapper } = require('../../../lib/wrapper-base.cjs');

/**
 * Entry point called by bin/gad.cjs early-exit interceptor.
 * @param {string[]} args - Everything after 'vercel' in process.argv
 */
function run(args) {
  runWrapper({ command: 'vercel', args });
}

module.exports = { run };
