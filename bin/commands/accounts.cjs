'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const {
  loadRuntimeRegistry,
  captureAccount,
  resolveAccountEntry,
  copyProviderAccountToCanonical,
  markRuntimeActiveAccount,
  setAccountStatus,
  removeAccount,
  runProviderLogin,
  loadRuntimeAccountState,
} = require('../../lib/team/accounts-registry.cjs');
const {
  listRuntimeAccounts,
  getActiveRuntimeAccount,
  rotateRuntimeAccount,
} = require('../../lib/team/rate-limit.cjs');
const { pollOnce } = require('../../lib/team/account-poller.cjs');

function createAccountsCommand(deps) {
  const {
    findRepoRoot,
    gadConfig,
    resolveRoots,
    getLastActiveProjectid,
    outputError,
  } = deps;

  function resolveBaseDir(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return { repoRoot, baseDir: repoRoot };
    return { repoRoot, baseDir: path.join(repoRoot, root.path) };
  }

  function accountSummary(runtime, provider, account, activeLabel) {
    return {
      runtime,
      provider,
      label: account.label,
      type: account.type || null,
      status: account.status || 'active',
      active: activeLabel === account.label,
      last_used_at: account.last_used_at || null,
      current_quota: account.current_quota || null,
      last_error: account.last_error || null,
      credential_ref: account.credential_ref || null,
    };
  }

  function collectAccounts(baseDir, filterProvider = '') {
    const registry = loadRuntimeRegistry(baseDir);
    const state = loadRuntimeAccountState(baseDir);
    const rows = [];
    for (const [runtime, entry] of Object.entries(registry)) {
      if (!entry) continue;
      if (filterProvider && entry.provider !== filterProvider) continue;
      const activeLabel = state[runtime] && state[runtime].label ? state[runtime].label : null;
      for (const account of entry.accounts || []) {
        rows.push(accountSummary(runtime, entry.provider, account, activeLabel));
      }
    }
    return rows.sort((a, b) => (
      a.provider.localeCompare(b.provider)
      || a.runtime.localeCompare(b.runtime)
      || a.label.localeCompare(b.label)
    ));
  }

  const list = defineCommand({
    meta: {
      name: 'list',
      description: 'List configured provider accounts, statuses, and runtime affinity.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id whose team registry to inspect', default: '' },
      provider: { type: 'string', description: 'Optional provider filter', default: '' },
      json: { type: 'boolean', description: 'Emit JSON instead of text', default: false },
    },
    run({ args }) {
      const { baseDir } = resolveBaseDir(args);
      const rows = collectAccounts(baseDir, String(args.provider || ''));
      if (args.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }
      if (rows.length === 0) {
        console.log('No runtime accounts configured yet.');
        console.log('Use `gad accounts add <provider> --label <name>` after logging in.');
        return;
      }
      for (const row of rows) {
        const statusBits = [
          row.status,
          row.active ? 'active-now' : null,
          row.type,
        ].filter(Boolean).join(', ');
        const quota = row.current_quota ? ` quota=${JSON.stringify(row.current_quota)}` : '';
        const lastUsed = row.last_used_at ? ` last_used=${row.last_used_at}` : '';
        const lastError = row.last_error ? ` last_error=${row.last_error}` : '';
        console.log(`${row.provider}/${row.runtime}`);
        console.log(`  - ${row.label} (${statusBits})${quota}${lastUsed}${lastError}`);
      }
    },
  });

  const add = defineCommand({
    meta: {
      name: 'add',
      description: 'Capture the current provider credential into the provider-aware registry.',
    },
    args: {
      provider: { type: 'positional', required: true, description: 'Provider id (codex, gemini, claude, opencode)' },
      label: { type: 'string', required: true, description: 'Logical account label' },
      projectid: { type: 'string', description: 'Project id whose team registry to mutate', default: '' },
      'credential-file': { type: 'string', description: 'Optional explicit file to capture instead of the provider canonical path', default: '' },
    },
    run({ args }) {
      const { baseDir } = resolveBaseDir(args);
      const account = captureAccount({
        baseDir,
        provider: String(args.provider),
        label: String(args.label),
        sourceFile: String(args['credential-file'] || ''),
      });
      console.log(`Captured ${args.provider}:${args.label} -> ${account.credential_ref.path}`);
    },
  });

  const login = defineCommand({
    meta: {
      name: 'login',
      description: 'Run the provider login flow, then capture the resulting credential.',
    },
    args: {
      provider: { type: 'positional', required: true, description: 'Provider id (codex, gemini, claude, opencode)' },
      label: { type: 'string', required: true, description: 'Logical account label' },
      projectid: { type: 'string', description: 'Project id whose team registry to mutate', default: '' },
    },
    run({ args }) {
      const { baseDir } = resolveBaseDir(args);
      runProviderLogin(String(args.provider));
      const account = captureAccount({
        baseDir,
        provider: String(args.provider),
        label: String(args.label),
      });
      console.log(`Logged in and captured ${args.provider}:${args.label} -> ${account.credential_ref.path}`);
    },
  });

  const use = defineCommand({
    meta: {
      name: 'use',
      description: 'Copy a captured provider account back to its canonical auth location and mark it active for its runtime.',
    },
    args: {
      provider: { type: 'positional', required: true, description: 'Provider id' },
      label: { type: 'string', required: true, description: 'Captured account label' },
      projectid: { type: 'string', description: 'Project id whose team registry to read', default: '' },
    },
    run({ args }) {
      const { baseDir } = resolveBaseDir(args);
      const hit = resolveAccountEntry(baseDir, String(args.provider), String(args.label));
      if (!hit) {
        outputError(`Account not found: ${args.provider}:${args.label}`);
        process.exit(1);
      }
      const destination = copyProviderAccountToCanonical(hit.provider, hit.account);
      const accounts = listRuntimeAccounts(baseDir, hit.runtime);
      const index = accounts.findIndex((candidate) => candidate.label === hit.account.label);
      markRuntimeActiveAccount(baseDir, hit.runtime, {
        ...hit.account,
        provider: hit.provider,
        index,
      }, 'manual-use');
      console.log(`Activated ${args.provider}:${args.label} at ${destination}`);
    },
  });

  function lifecycleCommand(name, status) {
    return defineCommand({
      meta: {
        name,
        description: `${name[0].toUpperCase()}${name.slice(1)} a provider account.`,
      },
      args: {
        provider: { type: 'positional', required: true, description: 'Provider id' },
        label: { type: 'string', required: true, description: 'Captured account label' },
        projectid: { type: 'string', description: 'Project id whose team registry to mutate', default: '' },
      },
      run({ args }) {
        const { baseDir } = resolveBaseDir(args);
        const updated = setAccountStatus(baseDir, String(args.provider), String(args.label), status);
        console.log(`${name}d ${args.provider}:${args.label} -> ${updated.status}`);
      },
    });
  }

  const remove = defineCommand({
    meta: {
      name: 'remove',
      description: 'Unregister a captured provider account from the local team registry and the operator credential registry.',
    },
    args: {
      provider: { type: 'positional', required: true, description: 'Provider id' },
      label: { type: 'string', required: true, description: 'Captured account label' },
      projectid: { type: 'string', description: 'Project id whose team registry to mutate', default: '' },
    },
    run({ args }) {
      const { baseDir } = resolveBaseDir(args);
      const removed = removeAccount(baseDir, String(args.provider), String(args.label));
      console.log(`Removed ${args.provider}:${args.label} (${removed.status})`);
    },
  });

  const rotate = defineCommand({
    meta: {
      name: 'rotate',
      description: 'Advance a runtime to its next usable account, or force a specific label active.',
    },
    args: {
      runtime: { type: 'positional', required: true, description: 'Runtime id (codex-cli, gemini-cli, opencode, ...)' },
      label: { type: 'string', description: 'Optional explicit account label to activate', default: '' },
      projectid: { type: 'string', description: 'Project id whose team registry to mutate', default: '' },
    },
    run({ args }) {
      const { baseDir } = resolveBaseDir(args);
      const runtime = String(args.runtime);
      const explicitLabel = String(args.label || '');
      if (explicitLabel) {
        const accounts = listRuntimeAccounts(baseDir, runtime);
        const selected = accounts.find((account) => account.label === explicitLabel);
        if (!selected) {
          outputError(`Runtime ${runtime} has no account labeled ${explicitLabel}`);
          process.exit(1);
        }
        if (selected.provider) {
          copyProviderAccountToCanonical(selected.provider, selected);
        }
        markRuntimeActiveAccount(baseDir, runtime, selected, 'manual-rotate');
        console.log(`Rotated ${runtime} -> ${selected.label}`);
        return;
      }
      const rotated = rotateRuntimeAccount(baseDir, runtime);
      if (!rotated) {
        outputError(`No alternate usable account available for ${runtime}`);
        process.exit(1);
      }
      if (rotated.provider) {
        copyProviderAccountToCanonical(rotated.provider, rotated);
      }
      console.log(`Rotated ${runtime} -> ${rotated.label}`);
    },
  });

  // ---------------------------------------------------------------------------
  // poll — automated account health pass (G5, phase 110-01)
  // ---------------------------------------------------------------------------

  /** Resolve the .planning/ base directory for accounts commands. */
  function resolvePollerBaseDir(args) {
    const { baseDir } = resolveBaseDir(args);
    return baseDir;
  }

  /** Append one line to .planning/team/account-poller.log */
  function pollerLog(baseDir, entry) {
    try {
      const logPath = path.join(baseDir, '.planning', 'team', 'account-poller.log');
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8');
    } catch {}
  }

  /**
   * Run a single poll pass and return { updated, statuses }.
   * Logs results. Emits JSON when --json is set.
   */
  function runPollPass(baseDir, useJson) {
    const result = pollOnce({ projectRoot: baseDir });
    pollerLog(baseDir, { kind: 'poll-pass', updated: result.updated, statuses: result.statuses });
    if (useJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.updated === 0) {
        const allUnknown = result.statuses.every(
          (s) => s.probe_result && s.probe_result.status === 'unknown',
        );
        if (allUnknown) {
          console.log(`accounts poll: 0 updated (all unknown — no quota endpoints available)`);
        } else {
          console.log(`accounts poll: 0 updated`);
        }
      } else {
        console.log(`accounts poll: ${result.updated} updated`);
        for (const s of result.statuses.filter((s) => s.changed)) {
          console.log(`  ${s.runtime}/${s.label}: ${s.status_before} -> ${s.status_after}`);
        }
      }
    }
    return result;
  }

  const poll = defineCommand({
    meta: {
      name: 'poll',
      description: 'Poll account quota state: auto-flip rate-limited→ok when reset_at has passed, probe quota endpoints where available.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id whose team registry to inspect', default: '' },
      once: { type: 'boolean', description: 'Run a single poll pass and exit (default when no mode flag given)', default: false },
      'interval-min': { type: 'string', description: 'Daemon poll interval in minutes (default: 15)', default: '15' },
      daemon: { type: 'boolean', description: 'Loop continuously with hardened daemon pattern (in-flight guard, skip-if-no-changes)', default: false },
      json: { type: 'boolean', description: 'Emit JSON output', default: false },
    },
    async run({ args }) {
      const baseDir = resolvePollerBaseDir(args);
      const useJson = Boolean(args.json);

      // Default to --once when no explicit mode given
      const runOnce = args.once || !args.daemon;

      if (runOnce && !args.daemon) {
        runPollPass(baseDir, useJson);
        return;
      }

      // --- Daemon mode (hardened: in-flight guard, BELOW_NORMAL advisory, skip-if-no-changes) ---
      const intervalMin = Math.max(1, parseInt(String(args['interval-min'] || '15'), 10) || 15);
      const intervalMs = intervalMin * 60 * 1000;

      // BELOW_NORMAL priority advisory (no npm dep — best-effort on Unix).
      if (typeof process.setpriority === 'function') {
        try { process.setpriority(0, 10); } catch {}
      }

      // Write pidfile so system.cjs status/stop can find this process.
      const pidfilePath = path.join(baseDir, '.planning', 'accounts-poller.pid');
      try {
        fs.mkdirSync(path.dirname(pidfilePath), { recursive: true });
        fs.writeFileSync(pidfilePath, String(process.pid), 'utf8');
      } catch (e) {
        process.stderr.write(`[gad-accounts-poll] warn: could not write pidfile: ${e.message}\n`);
      }

      process.stderr.write(`[gad-accounts-poll] daemon started, pid=${process.pid}, interval=${intervalMin}min\n`);
      pollerLog(baseDir, { kind: 'daemon-start', interval_min: intervalMin, pid: process.pid });

      let inFlight = false;
      let stopping = false;

      async function tick() {
        if (stopping || inFlight) return;
        inFlight = true;
        try {
          runPollPass(baseDir, useJson);
        } catch (err) {
          pollerLog(baseDir, { kind: 'daemon-error', error: err.message });
        } finally {
          inFlight = false;
        }
      }

      const stop = (signal) => {
        stopping = true;
        pollerLog(baseDir, { kind: 'daemon-stop', signal });
        // Clean up pidfile on graceful shutdown.
        try { fs.unlinkSync(pidfilePath); } catch {}
        clearInterval(timer);
        process.exit(0);
      };
      process.on('SIGTERM', () => stop('SIGTERM'));
      process.on('SIGINT', () => stop('SIGINT'));

      // Run immediately on startup, then on interval.
      await tick();
      const timer = setInterval(tick, intervalMs);

      // Keep event loop alive
      await new Promise(() => {});
    },
  });

  return defineCommand({
    meta: {
      name: 'accounts',
      description: 'Manage provider-aware runtime accounts for team workers: list, add, login, use, pause, resume, remove, rotate, poll.',
    },
    subCommands: {
      list,
      add,
      login,
      use,
      pause: lifecycleCommand('pause', 'paused'),
      resume: lifecycleCommand('resume', 'active'),
      remove,
      rotate,
      poll,
    },
  });
}

module.exports = { createAccountsCommand };
module.exports.register = (ctx) => ({ accounts: createAccountsCommand(ctx.common) });
