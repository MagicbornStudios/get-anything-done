'use strict';
/**
 * gad self / self-eval — local dogfood build/install + framework metrics
 *
 * Required deps: outputError
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { defineCommand } = require('citty');

const DEFAULT_OLD_BINARY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isRetriableInstallLockError(err) {
  return Boolean(err && (err.code === 'EBUSY' || err.code === 'EPERM'));
}

function sleepSync(ms) {
  if (!ms || ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function renameWithRetry(src, dest, { label = path.basename(src), retries = 2, delayMs = 75 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      fs.renameSync(src, dest);
      return;
    } catch (err) {
      if (!isRetriableInstallLockError(err) || attempt === retries) {
        if (isRetriableInstallLockError(err)) {
          throw new Error(`Failed to rename running ${label}: ${err.message}`);
        }
        throw err;
      }
      sleepSync(delayMs);
    }
  }
}

function cleanupOldBinaries(dir, binaryName, maxAgeMs = DEFAULT_OLD_BINARY_MAX_AGE_MS, nowMs = Date.now()) {
  if (!fs.existsSync(dir)) return;
  const prefix = `${binaryName}.old-`;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.startsWith(prefix)) continue;
    const fullPath = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      if ((nowMs - stat.mtimeMs) > maxAgeMs) fs.unlinkSync(fullPath);
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function installBinaryWithRenameSwap(src, dest, { label = path.basename(dest), cleanupMaxAgeMs = DEFAULT_OLD_BINARY_MAX_AGE_MS } = {}) {
  let renamedOldPath = null;

  if (fs.existsSync(dest)) {
    renamedOldPath = `${dest}.old-${Date.now()}`;
    renameWithRetry(dest, renamedOldPath, { label });
    cleanupOldBinaries(path.dirname(dest), path.basename(dest), cleanupMaxAgeMs);
  }

  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    if (renamedOldPath && !fs.existsSync(dest) && fs.existsSync(renamedOldPath)) {
      try {
        fs.renameSync(renamedOldPath, dest);
      } catch {
        // Best-effort rollback if the new copy never lands.
      }
    }
    throw new Error(`Failed to install ${label}: ${err.message}`);
  }

  return renamedOldPath;
}

function createSelfCommand(_deps) {
  const gadDir = path.join(__dirname, '..', '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(gadDir, 'package.json'), 'utf8'));

  const build = defineCommand({
    meta: {
      name: 'build',
      description: 'Build the GAD executable via Bun (runs scripts/build-bun-release.mjs).',
    },
    run() {
      const scriptPath = path.join(gadDir, 'scripts', 'build-bun-release.mjs');
      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: gadDir,
        stdio: 'inherit',
      });
      process.exit(result.status ?? 1);
    },
  });

  const install = defineCommand({
    meta: {
      name: 'install',
      description: 'Copy dist/release/gad-v<ver>-windows-x64.exe to %LOCALAPPDATA%/Programs/gad/bin/.',
    },
    run() {
      const artifactName = `gad-v${pkg.version}-windows-x64.exe`;
      const src = path.join(gadDir, 'dist', 'release', artifactName);

      if (!fs.existsSync(src)) {
        process.stderr.write(`Source artifact not found: ${src}\nRun \`gad self build\` first.\n`);
        process.exit(1);
      }

      const localAppData = process.env.LOCALAPPDATA;
      if (!localAppData) {
        process.stderr.write('LOCALAPPDATA environment variable is not set.\n');
        process.exit(1);
      }

      const destDir = path.join(localAppData, 'Programs', 'gad', 'bin');
      fs.mkdirSync(destDir, { recursive: true });

      const dest = path.join(destDir, 'gad.exe');
      try {
        installBinaryWithRenameSwap(src, dest, { label: 'gad.exe' });
        console.log(`Installed: ${dest}`);
      } catch (err) {
        process.stderr.write(`${err.message}\n`);
        process.exit(1);
      }

      // Also install gad-tui if present (soft — skip+warn if absent).
      const tuiSrc = path.join(gadDir, 'dist', 'release', `gad-tui-v${pkg.version}-windows-x64.exe`);
      if (fs.existsSync(tuiSrc)) {
        const tuiDest = path.join(destDir, 'gad-tui.exe');
        try {
          installBinaryWithRenameSwap(tuiSrc, tuiDest, { label: 'gad-tui.exe' });
          console.log(`Installed: ${tuiDest}`);
        } catch (err) {
          process.stderr.write(`[warn] ${err.message}\n`);
        }
      } else {
        process.stderr.write(`[info] gad-tui not bundled in this release. Run \`gad self build\` after building the TUI to include it.\n`);
      }
    },
  });

  return defineCommand({
    meta: { name: 'self', description: 'Self-management commands for local dogfood build/install.' },
    subCommands: { build, install },
  });
}

function createSelfEvalCommand(deps) {
  const { outputError } = deps;

  return defineCommand({
    meta: { name: 'self-eval', description: 'Compute and display framework self-evaluation metrics — pressure per phase, overhead, compliance' },
    args: { json: { type: 'boolean', description: 'Output as JSON', default: false } },
    run({ args }) {
      const gadDir = path.join(__dirname, '..', '..');
      const siteDir = path.join(gadDir, 'site');
      const scriptPath = path.join(siteDir, 'scripts', 'compute-self-eval.mjs');

      if (!fs.existsSync(scriptPath)) {
        outputError('compute-self-eval.mjs not found. Is the site directory present?');
        return;
      }

      const { execSync: exec } = require('child_process');
      try {
        exec(`node "${scriptPath}"`, { cwd: siteDir, stdio: 'pipe' });
      } catch (err) {
        outputError('Pipeline failed: ' + (err.message || err));
        return;
      }

      const outputPath = path.join(siteDir, 'data', 'self-eval.json');
      if (!fs.existsSync(outputPath)) { console.log('No self-eval data produced.'); return; }

      const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      const m = data.latest;

      if (args.json) { console.log(JSON.stringify(m, null, 2)); return; }

      console.log('GAD Self-Eval Metrics\n');
      console.log(`Period: ${m.period.start} → ${m.period.end} (${m.period.days} days)`);
      console.log(`Events: ${m.totals.events} | Sessions: ${m.totals.sessions} | CLI calls: ${m.totals.gad_cli_calls}`);
      console.log(`Tasks: ${m.tasks.done}/${m.tasks.total} done | Decisions: ${m.decisions}`);
      console.log(`\nFramework overhead: ${(m.framework_overhead.ratio * 100).toFixed(1)}% (score: ${m.framework_overhead.score})`);
      console.log(`Framework compliance: ${(m.framework_compliance.score * 100).toFixed(0)}% (${m.framework_compliance.fully_attributed}/${m.framework_compliance.completed_tasks} done tasks fully attributed)`);
      console.log(`Hydration overhead: ${(m.hydration.overhead_ratio * 100).toFixed(1)}% (${m.hydration.snapshot_count} snapshots, ${m.hydration.estimated_snapshot_tokens} est tokens)`);

      if (m.phases_pressure && m.phases_pressure.length > 0) {
        console.log('\nPressure per phase (top 10):');
        console.log('PHASE  TASKS  CROSSCUTS  PRESSURE');
        console.log('─'.repeat(40));
        const sorted = [...m.phases_pressure].sort((a, b) => b.pressure_score - a.pressure_score).slice(0, 10);
        for (const p of sorted) {
          const flag = p.high_pressure ? ' ⚠ HIGH' : '';
          console.log(`${String(p.phase).padEnd(7)}${String(p.tasks_total).padStart(5)}  ${String(p.crosscuts).padStart(9)}  ${String(p.pressure_score).padStart(8)}${flag}`);
        }
      }

      console.log('\nGAD CLI breakdown: snapshot=' + m.gad_cli_breakdown.snapshot + ' eval=' + m.gad_cli_breakdown.eval + ' other=' + m.gad_cli_breakdown.other);
    },
  });
}

module.exports = { createSelfCommand, createSelfEvalCommand };
module.exports._private = {
  DEFAULT_OLD_BINARY_MAX_AGE_MS,
  cleanupOldBinaries,
  installBinaryWithRenameSwap,
  isRetriableInstallLockError,
  renameWithRetry,
};
module.exports.register = (ctx) => ({
  self: createSelfCommand({}),
  'self-eval': createSelfEvalCommand(ctx.common),
});
