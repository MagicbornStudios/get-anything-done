'use strict';
/**
 * gad hf — HuggingFace integration router.
 *
 * Invoked by the early-exit interceptor in bin/gad.cjs BEFORE citty runs.
 *
 * Routing:
 *   gad hf models <...>       → rich gad subcommands (hf.cjs)
 *   gad hf datasets <...>     → rich gad subcommands (hf.cjs)
 *   gad hf download <...>     → rich gad subcommands (hf.cjs)
 *   gad hf push-dataset <...> → rich gad subcommands (hf.cjs)
 *   gad hf whoami             → rich gad subcommands (hf.cjs)
 *   gad hf <anything-else>    → passthrough to huggingface-cli (original behavior)
 *
 * This preserves backward-compat: `gad hf --version`, `gad hf upload`, etc.
 * still reach the real huggingface-cli unchanged, while new structured
 * subcommands add Hub search, model inspection, and dataset publishing.
 *
 * GLOBAL-D-316 / task 75-22.
 */

const { runWrapper } = require('../../../lib/wrapper-base.cjs');

// Subcommands handled by the rich gad hf module (hf.cjs).
const GAD_SUBCOMMANDS = new Set(['models', 'datasets', 'download', 'push-dataset', 'whoami']);

/**
 * Entry point called by bin/gad.cjs early-exit interceptor.
 * @param {string[]} args - Everything after 'hf' in process.argv
 */
function run(args) {
  const sub = args[0];

  // Route to rich gad subcommand layer.
  if (sub && GAD_SUBCOMMANDS.has(sub)) {
    // Re-inject 'hf' so citty sees the full subcommand path, then let gad.cjs
    // normal flow handle it — but since we're already in the early-exit branch,
    // we drive citty directly by calling the hf command module's runner.
    const { createHfCommand } = require('../hf.cjs');
    // Build a minimal deps bag (no gadConfig available here without repo root discovery;
    // settings will fall back to defaults which is fine for CLI invocations).
    let gadConfig = null;
    try {
      const path = require('path');
      const cfgPath = path.join(require('../../../../lib/wrapper-base.cjs').findRepoRoot
        ? '' // wrapper-base doesn't export findRepoRoot
        : '', '');
      // Best-effort: try the standard config loader
      gadConfig = require('../../../../lib/gad-config.cjs');
    } catch (_) { /* settings fall back to defaults */ }

    const cmd = createHfCommand({ gadConfig });
    // Use citty's runMain to execute with the remaining args.
    // We pass args directly as process.argv with just 'node' + 'gad' prefix
    // so citty sees: argv[2] = first sub (models/datasets/etc).
    const { runMain } = require('citty');
    const fakeArgv = ['node', 'gad', ...args];
    process.argv = fakeArgv;
    runMain(cmd);
    return;
  }

  // Fall through to raw huggingface-cli passthrough for all other args.
  runWrapper({ command: 'huggingface-cli', args });
}

module.exports = { run };
