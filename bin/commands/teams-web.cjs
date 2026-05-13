'use strict';
/**
 * gad team web — DEPRECATED (phase 196, task 196-03, 2026-05-12).
 *
 * The team state surface is now a native panel in apps/desk. This command
 * is preserved as a deprecation stub so the citty subcommand entry under
 * `gad team` still resolves and prints a migration notice. The previous
 * implementation spawned a localhost node http server on port 3033; that
 * pattern (and the matching apps/desk web_launcher.rs) was removed in
 * phase 196 per decision GLOBAL-D-338.
 *
 * The original implementation lives in git history; see commit predating
 * 196-03 for the full localhost server logic.
 */

const { defineCommand } = require('citty');

function createTeamsWebCommand() {
  return defineCommand({
    meta: {
      name: 'web',
      description: '[deprecated] Use the Teams panel in apps/desk instead — see deprecation notice.',
    },
    args: {
      port: { type: 'string', description: '[deprecated] no longer honored', default: '3033' },
      'no-open': { type: 'boolean', description: '[deprecated] no longer honored', default: false },
    },
    async run() {
      process.stdout.write(
        `gad team web is deprecated.\n` +
        `The team/env/issues/todos surfaces are now native panels in apps/desk.\n` +
        `Launch apps/desk: pnpm --filter @gad/desk dev (then click "Teams" in the sidebar Panels section).\n` +
        `\n` +
        `If you need a one-shot snapshot from the terminal:\n` +
        `  gad team status --json   # raw JSON\n` +
        `  gad team status          # text\n`
      );
    },
  });
}

module.exports = { createTeamsWebCommand };
