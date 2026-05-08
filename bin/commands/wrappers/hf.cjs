'use strict';
/**
 * gad hf — thin passthrough wrapper for the `huggingface-cli` binary.
 *
 * Forwards all args verbatim via spawnSync + appends a structured log
 * envelope to .planning/.gad-log/<date>.jsonl so SLM tool-action specialists
 * train on a uniform verb space. GLOBAL-D-316 / task 75-22.
 *
 * Invoked by the early-exit interceptor in bin/gad.cjs BEFORE citty runs,
 * so all flags (including --version, --help, download, upload, etc.) reach
 * `huggingface-cli` unchanged.
 *
 * Usage (same as raw huggingface-cli):
 *   gad hf <args...>
 *   gad hf --version
 *   gad hf download <repo>
 *   gad hf upload <repo> <file>
 */

const { runWrapper } = require('../../../lib/wrapper-base.cjs');

/**
 * Entry point called by bin/gad.cjs early-exit interceptor.
 * @param {string[]} args - Everything after 'hf' in process.argv
 */
function run(args) {
  runWrapper({ command: 'huggingface-cli', args });
}

module.exports = { run };
