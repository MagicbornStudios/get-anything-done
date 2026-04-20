'use strict';
/**
 * gad planning — hydrate from MD, serve planning-app
 *
 * Required deps: findRepoRoot, gadConfig, resolveRoots, outputError
 */

const path = require('path');
const { defineCommand } = require('citty');

function createPlanningCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError } = deps;

  const hydrate = defineCommand({
    meta: { name: 'hydrate', description: 'Hydrate .planning/*.xml from sibling *.md files (inverse of docs compile)' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project root id', default: '' },
      all:       { type: 'boolean', description: 'Walk every registered planning root', default: false },
      from:      { type: 'string', description: 'Directory to read *.md from (defaults to the root planning dir)', default: '' },
      'dry-run': { type: 'boolean', description: 'Print generated XML without writing', default: false },
      force:     { type: 'boolean', description: 'Overwrite existing XML (archives prior to .planning/archive/xml/<ts>/)', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config  = gadConfig.load(baseDir);
      const roots   = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) outputError('No planning roots resolved. Pass --projectid <id> or --all.');

      const { hydrateFromMd } = require('../../lib/docs-compiler.cjs');
      let totalWritten = 0, totalSkipped = 0, totalArchived = 0;
      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        const fromDir = args.from ? path.resolve(baseDir, args.from) : planDir;
        const res = hydrateFromMd(planDir, fromDir, { force: args.force, dryRun: args['dry-run'] });
        totalWritten  += res.written;
        totalSkipped  += res.skipped;
        totalArchived += res.archived;
        console.log(`\n${root.id}  (${path.relative(baseDir, planDir) || '.'})`);
        for (const r of res.results) {
          if (r.status === 'dry-run') console.log(`  --- ${r.slot} → ${path.relative(baseDir, r.destPath)} ---\n${r.xml}`);
          else if (r.status === 'written') console.log(`  ✓ ${r.slot} → ${path.relative(baseDir, r.destPath)}`);
          else if (r.status === 'skipped') console.log(`  · ${r.slot} skipped — ${r.reason}`);
          else if (r.status === 'missing-md') console.log(`  - ${r.slot} (no source md)`);
        }
      }
      const verb = args['dry-run'] ? 'would write' : 'wrote';
      console.log(`\n${verb} ${totalWritten} file(s), skipped ${totalSkipped}, archived ${totalArchived}`);
    },
  });

  const serve = defineCommand({
    meta: {
      name: 'serve',
      description: 'Spawn apps/planning-app on port 3002 with health-probe reuse detection (monorepo checkout required; shells out to pnpm filter per decision gad-265).',
    },
    args: {
      port: { type: 'string', description: 'Override port (default 3002). Also honored by planning-app via PORT env.', default: '' },
      prod: { type: 'boolean', description: 'Use `next start` (pnpm filter start) against a prebuilt .next/ bundle instead of `next dev`.', default: false },
      'no-browser': { type: 'boolean', description: 'Skip browser open (default; serve never opens a browser — kept for symmetry with `gad start`).', default: false },
      'log-dir': { type: 'string', description: 'Override log directory. Defaults to ~/.gad/logs/.', default: '' },
    },
    async run({ args }) {
      const {
        DEFAULT_PORT, resolveWorkspaceRoot, decideReuseAction, probeHealth,
        spawnPlanningApp, defaultLogDir, logFileName, ensureLogDir, appendLogLine,
      } = require('../../lib/planning-serve.cjs');

      let port = DEFAULT_PORT;
      const rawPort = String(args.port || '').trim();
      if (rawPort) {
        const p = parseInt(rawPort, 10);
        if (!Number.isFinite(p) || p <= 0) { outputError(`invalid --port value: ${rawPort}`); return; }
        port = p;
      } else if (process.env.GAD_PLANNING_PORT) {
        const p = parseInt(process.env.GAD_PLANNING_PORT, 10);
        if (Number.isFinite(p) && p > 0) port = p;
      }

      const workspace = resolveWorkspaceRoot(process.cwd());
      if (!workspace) {
        outputError(
          'could not locate apps/platform/ by walking up from cwd. ' +
          '`gad planning serve` requires a monorepo checkout (decision gad-265 Q1). ' +
          'Follow-up: standalone binary bundling gated on task 44-28 pattern.',
        );
        return;
      }

      const logDir = args['log-dir'] ? path.resolve(args['log-dir']) : defaultLogDir();
      ensureLogDir(logDir);
      const logFile = path.join(logDir, logFileName());

      const probe = await probeHealth({ port });
      const decision = decideReuseAction(probe);
      if (decision.action === 'attach') {
        console.log(`[gad planning serve] already serving on port ${port} — ${decision.reason}`);
        appendLogLine(logFile, 'stderr', `[gad planning serve] attach: ${decision.reason}`);
        process.exit(0);
        return;
      }
      if (decision.action === 'conflict') {
        console.error(`[gad planning serve] port conflict — ${decision.reason}`);
        console.error('  stop the occupying process, set GAD_PLANNING_PORT, or pass --port <N>.');
        appendLogLine(logFile, 'stderr', `[gad planning serve] conflict: ${decision.reason}`);
        process.exit(1);
        return;
      }

      console.log(`[gad planning serve] spawning pnpm --filter @portfolio/platform ${args.prod ? 'start' : 'dev'} on port ${port}`);
      console.log(`[gad planning serve] log file: ${logFile}`);
      appendLogLine(logFile, 'stderr', `[gad planning serve] spawn port=${port} prod=${!!args.prod} cwd=${workspace.root}`);

      const child = spawnPlanningApp({
        workspaceRoot: workspace.root,
        port,
        prod: !!args.prod,
        logFile,
        onExit(code) {
          console.log(`[gad planning serve] shutdown — exit code ${code == null ? 'null' : code}`);
          process.exit(code == null ? 0 : code);
        },
      });

      child.on('error', (err) => {
        outputError(`failed to spawn pnpm: ${err.message}. Ensure pnpm is installed and on PATH.`);
      });
    },
  });

  return defineCommand({
    meta: { name: 'planning', description: 'Planning-directory utilities — hydrate from MD, serve the planning-app.' },
    subCommands: { hydrate, serve },
  });
}

module.exports = { createPlanningCommand };
module.exports.register = (ctx) => ({ planning: createPlanningCommand(ctx.common) });
