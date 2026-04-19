'use strict';
/**
 * gad dev — watch planning files and re-run refs verify on changes
 *
 * Required deps: findRepoRoot
 */

const { defineCommand } = require('citty');

function createDevCommand(deps) {
  const { findRepoRoot } = deps;
  return defineCommand({
    meta: { name: 'dev', description: 'Watch .planning/ files and re-run refs verify on changes (JSON output)' },
    args: {
      debounce: { type: 'string', description: 'Debounce interval in ms (default: 500)', default: '500' },
      poll: { type: 'boolean', description: 'Use polling instead of fs.watch (for unreliable FS watchers)', default: false },
      once: { type: 'boolean', description: 'Run verify once and exit (no watch)', default: false },
    },
    run({ args }) {
      const { startWatch, runVerify } = require('../../lib/watch-planning.cjs');
      const baseDir = findRepoRoot();
      const debounceMs = parseInt(args.debounce) || 500;

      if (args.once) {
        const result = runVerify(baseDir, 'once', (obj) => console.log(JSON.stringify(obj)));
        process.exit(result.ok ? 0 : 1);
        return;
      }

      console.error(`gad dev — watching .planning/ files (debounce: ${debounceMs}ms, mode: ${args.poll ? 'poll' : 'fs.watch'})`);
      console.error('Press Ctrl+C to stop.\n');

      const { stop } = startWatch(baseDir, { debounceMs, poll: args.poll });
      process.on('SIGINT', () => {
        stop();
        console.error('\ngad dev stopped.');
        process.exit(0);
      });
    },
  });
}

module.exports = { createDevCommand };
