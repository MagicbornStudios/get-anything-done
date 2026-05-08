'use strict';
/**
 * gad supabase — thin passthrough wrapper for the `supabase` binary.
 *
 * Forwards all args verbatim via spawnSync + appends a structured log
 * envelope to .planning/.gad-log/<date>.jsonl so SLM tool-action specialists
 * train on a uniform verb space. GLOBAL-D-316 / task 75-24.
 *
 * Invoked by the early-exit interceptor in bin/gad.cjs BEFORE citty runs,
 * so all flags (including --version, --help, db, functions, etc.) reach
 * `supabase` unchanged.
 *
 * Usage (same as raw supabase):
 *   gad supabase <args...>
 *   gad supabase --version
 *   gad supabase db push
 *   gad supabase functions deploy
 */

const { runWrapper } = require('../../../lib/wrapper-base.cjs');

/**
 * Entry point called by bin/gad.cjs early-exit interceptor.
 * @param {string[]} args - Everything after 'supabase' in process.argv
 */
function run(args) {
  runWrapper({ command: 'supabase', args });
}

module.exports = { run };
