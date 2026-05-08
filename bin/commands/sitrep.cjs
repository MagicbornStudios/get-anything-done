'use strict';
/**
 * gad sitrep — SITREP digest reader / trigger (task 75-14, GLOBAL-D-315).
 *
 * Subcommands exposed at top level:
 *   gad sitrep          — print .planning/.sitrep.md (default: no args)
 *   gad sitrep --watch  — tail the file, print on every update
 *   gad sitrep --tick   — write one immediate digest then print it
 *
 * CLI shape follows the single-command pattern: no sub-command tree, flags
 * only, so `gad sitrep` with no args does the most useful thing.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { writeSitrepDigest, SITREP_FILE } = require('../../lib/sitrep-digest.cjs');

function createSitrepCommand(deps) {
  return defineCommand({
    meta: {
      name: 'sitrep',
      description: 'Print operator SITREP digest (.planning/.sitrep.md). --tick writes fresh; --watch tails.',
    },
    args: {
      watch: {
        type: 'boolean',
        description: 'Tail the digest file; print on every update (Ctrl+C to stop)',
        default: false,
      },
      tick: {
        type: 'boolean',
        description: 'Write one fresh digest now, then print it',
        default: false,
      },
      projectid: {
        type: 'string',
        description: 'Project id (default: active session project or "global")',
        default: '',
      },
    },
    async run({ args }) {
      const baseDir = deps.findRepoRoot();
      const projectid = args.projectid || 'global';
      const sitrepPath = path.join(baseDir, '.planning', SITREP_FILE);

      // ── --tick: write one digest, then print ──────────────────────────────
      if (args.tick) {
        const dest = writeSitrepDigest(baseDir, projectid);
        const content = fs.readFileSync(dest, 'utf8');
        process.stdout.write(content);
        return;
      }

      // ── --watch: tail indefinitely ────────────────────────────────────────
      if (args.watch) {
        if (fs.existsSync(sitrepPath)) {
          process.stdout.write(fs.readFileSync(sitrepPath, 'utf8'));
          process.stdout.write('\n[watching for changes — Ctrl+C to stop]\n');
        } else {
          process.stdout.write(`[no digest yet at ${sitrepPath}]\n[watching — Ctrl+C to stop]\n`);
        }

        let lastMtime = fs.existsSync(sitrepPath) ? fs.statSync(sitrepPath).mtimeMs : 0;
        const interval = setInterval(() => {
          if (!fs.existsSync(sitrepPath)) return;
          const mtime = fs.statSync(sitrepPath).mtimeMs;
          if (mtime > lastMtime) {
            lastMtime = mtime;
            process.stdout.write('\n--- updated ---\n');
            process.stdout.write(fs.readFileSync(sitrepPath, 'utf8'));
          }
        }, 1000);

        const stop = () => { clearInterval(interval); process.exit(0); };
        process.on('SIGINT', stop);
        process.on('SIGTERM', stop);
        // Keep process alive
        setInterval(() => {}, 1 << 30);
        return;
      }

      // ── default: print existing digest ────────────────────────────────────
      if (!fs.existsSync(sitrepPath)) {
        process.stdout.write(`No SITREP digest yet.\nRun: gad sitrep --tick   (writes + prints one immediately)\n`);
        return;
      }
      process.stdout.write(fs.readFileSync(sitrepPath, 'utf8'));
    },
  });
}

module.exports = { createSitrepCommand };
module.exports.register = (ctx) => ({
  sitrep: createSitrepCommand(ctx.common),
});
