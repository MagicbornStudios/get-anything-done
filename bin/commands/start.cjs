'use strict';
/**
 * gad start / dashboard — daily operator dashboard entry (59-06, gad-262).
 *
 * Required deps: findRepoRoot, outputError
 */

const { defineCommand } = require('citty');

function createStartCommand(deps) {
  const { findRepoRoot, outputError } = deps;

  return defineCommand({
    meta: {
      name: 'start',
      description:
        'Daily dashboard entry. Spawns `gad planning serve` if not running, waits for health, opens browser to /my-projects. Aliased as `gad dashboard`.',
    },
    args: {
      port: { type: 'string', description: 'Override port (default 3002).', default: '' },
      'no-browser': { type: 'boolean', description: 'Skip browser open. Useful for editor/iframe workflows.', default: false },
      'dispatch-subagents': {
        type: 'boolean',
        description:
          'After opening the dashboard, run daily-subagent dispatch for every project in gad-config.toml with `dailySubagent = true` (phase 59 task 59-07, decision gad-258).',
        default: false,
      },
    },
    async run({ args }) {
      const { DEFAULT_PORT } = require('../../lib/planning-serve.cjs');
      const { runStart } = require('../../lib/start-cmd.cjs');

      let port = DEFAULT_PORT;
      const rawPort = String(args.port || '').trim();
      if (rawPort) {
        const p = parseInt(rawPort, 10);
        if (!Number.isFinite(p) || p <= 0) { outputError(`invalid --port value: ${rawPort}`); return; }
        port = p;
      }

      try {
        const { purgeExpiredAllProjects, renderStartupPurgeSummary } = require('../../lib/startup-purge.cjs');
        const baseDir = findRepoRoot();
        const summary = await purgeExpiredAllProjects({ baseDir });
        const line = renderStartupPurgeSummary(summary);
        if (line) process.stderr.write(line);
      } catch (e) {
        process.stderr.write(`[gad start] auto-purge skipped: ${e && e.message ? e.message : String(e)}\n`);
      }

      const result = await runStart({ port, noBrowser: Boolean(args['no-browser']) });
      if (result.action === 'conflict') { process.exitCode = 1; return; }

      if (args['dispatch-subagents']) {
        const { dispatchAll } = require('../../lib/subagent-dispatch.cjs');
        const baseDir = findRepoRoot();
        const disp = dispatchAll({ baseDir });
        if (disp.exitCode !== 0 && !process.exitCode) process.exitCode = disp.exitCode;
      }
    },
  });
}

module.exports = { createStartCommand };
module.exports.register = (ctx) => {
  const cmd = createStartCommand(ctx.common);
  return { start: cmd, dashboard: cmd };
};
