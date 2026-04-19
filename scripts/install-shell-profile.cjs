#!/usr/bin/env node
'use strict';

/**
 * Standalone entry point for shell-profile install/uninstall/status.
 *
 * Lives in `scripts/` so it doesn't depend on `bin/gad.cjs` dispatcher
 * wiring (which is mid-refactor by parallel agents 2026-04-19).
 *
 * Usage:
 *   node scripts/install-shell-profile.cjs install [--shell bash|zsh|pwsh|all] [--dry-run] [--path <file>]
 *   node scripts/install-shell-profile.cjs uninstall [--shell bash|zsh|pwsh|all] [--path <file>]
 *   node scripts/install-shell-profile.cjs status [--shell bash|zsh|pwsh|all]
 *   node scripts/install-shell-profile.cjs show [--shell bash|zsh|pwsh]
 */

const {
  install, uninstall, status, snippetForShell, defaultProfilePath,
} = require('../lib/shell-profile-snippet.cjs');

const argv = process.argv.slice(2);
const action = argv[0] || 'status';
const opts = parseFlags(argv.slice(1));

const SHELLS = opts.shell === 'all' || !opts.shell
  ? (process.platform === 'win32' ? ['bash', 'pwsh'] : ['bash', 'zsh'])
  : [opts.shell];

function parseFlags(rest) {
  const out = { shell: null, 'dry-run': false, path: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--shell') out.shell = rest[++i];
    else if (a === '--path') out.path = rest[++i];
    else if (a === '--dry-run') out['dry-run'] = true;
  }
  return out;
}

function printHelp() {
  console.log(`Shell-profile installer — sets GAD_RUNTIME based on env-var fingerprints.

Actions:
  install    Install or update the snippet block in the profile
  uninstall  Remove the snippet block
  status     Report whether the snippet is installed + matches current version
  show       Print the snippet that would be installed (no file writes)
  help       Show this message

Flags:
  --shell <bash|zsh|pwsh|all>   Target shell (default: platform-appropriate set)
  --path <file>                 Explicit profile path (overrides default)
  --dry-run                     Don't write; preview action

Examples:
  # Install for all default shells on this platform
  node scripts/install-shell-profile.cjs install
  # Just bash, dry-run
  node scripts/install-shell-profile.cjs install --shell bash --dry-run
  # Show what would be installed
  node scripts/install-shell-profile.cjs show --shell pwsh
  # Remove
  node scripts/install-shell-profile.cjs uninstall --shell all`);
}

if (action === 'help' || action === '--help' || action === '-h') {
  printHelp();
  process.exit(0);
}

if (action === 'show') {
  const shell = opts.shell && opts.shell !== 'all' ? opts.shell : SHELLS[0];
  process.stdout.write(snippetForShell(shell));
  process.exit(0);
}

if (!['install', 'uninstall', 'status'].includes(action)) {
  console.error(`Unknown action: ${action}`);
  printHelp();
  process.exit(1);
}

for (const shell of SHELLS) {
  try {
    if (action === 'install') {
      const r = install({ shell, profilePath: opts.path, dryRun: opts['dry-run'] });
      console.log(`[${shell}] ${r.action} — ${r.path}`);
    } else if (action === 'uninstall') {
      const r = uninstall({ shell, profilePath: opts.path, dryRun: opts['dry-run'] });
      console.log(`[${shell}] ${r.action} — ${r.path}`);
    } else if (action === 'status') {
      const r = status({ shell, profilePath: opts.path });
      const mark = r.installed ? (r.matchesCurrent ? 'installed (current)' : 'installed (STALE — rerun install)') : 'not installed';
      console.log(`[${shell}] ${mark} — ${r.path}`);
    }
  } catch (e) {
    console.error(`[${shell}] ERROR: ${e.message}`);
    process.exitCode = 1;
  }
}
