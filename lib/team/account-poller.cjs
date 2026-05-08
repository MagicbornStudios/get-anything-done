'use strict';
/**
 * lib/team/account-poller.cjs — automated account health polling (G5, phase 110-01).
 *
 * Exports:
 *   pollOnce({ projectRoot }) — one pass over all accounts in registry.
 *     For each account, checks reset_at (flip rate-limited → ok), and
 *     attempts a per-runtime quota probe where one exists. Updates
 *     current_quota + status in runtime-accounts.json.
 *   pollCodex / pollClaude / pollGemini / pollOpencode — per-runtime probes.
 *     Each returns { status, current_quota, reset_at?, error?, reason? }.
 *     Returns { status: 'unknown', reason: 'no quota endpoint' } when unsupported.
 *
 * Design constraints (per phase-159/170 daemon hardening):
 *   - in-flight guard: never two concurrent passes.
 *   - BELOW_NORMAL priority advisory: nice(10) where possible; no dep.
 *   - skip-if-no-changes: only writes to disk when something actually changed.
 *   - No npm deps — built-ins only.
 */

const fs = require('fs');
const path = require('path');
const { loadRuntimeRegistry, saveRuntimeRegistry } = require('./accounts-registry.cjs');

// ---------------------------------------------------------------------------
// Per-runtime quota probe stubs
// ---------------------------------------------------------------------------

/**
 * Codex-CLI has no public quota REST endpoint (usage is inferred from
 * rate-limit signals at runtime). Return unknown.
 */
function pollCodex(_account) {
  return { status: 'unknown', reason: 'no quota endpoint' };
}

/**
 * Gemini-CLI likewise has no public quota REST endpoint accessible without
 * an API key tied to the account. Return unknown.
 */
function pollGemini(_account) {
  return { status: 'unknown', reason: 'no quota endpoint' };
}

/**
 * Claude / claude-code: no public quota endpoint available via stored
 * OAuth creds without routing through Anthropic Console API (not shipped).
 */
function pollClaude(_account) {
  return { status: 'unknown', reason: 'no quota endpoint' };
}

/**
 * OpenCode: no public quota REST endpoint documented. Return unknown.
 */
function pollOpencode(_account) {
  return { status: 'unknown', reason: 'no quota endpoint' };
}

// Map runtime id → probe function
const PROBE_BY_RUNTIME = {
  'codex-cli': pollCodex,
  'gemini-cli': pollGemini,
  'claude-code': pollClaude,
  'opencode': pollOpencode,
};

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Auto-flip an account from 'rate-limited' back to 'active' if its
 * reset_at timestamp has passed.
 * @param {object} account - normalised account record
 * @returns {{ flipped: boolean, account: object }}
 */
function maybeFlipResetAt(account) {
  if (account.status !== 'rate-limited') return { flipped: false, account };
  const resetAt = account.reset_at || (account.current_quota && account.current_quota.reset_at);
  if (!resetAt) return { flipped: false, account };
  const resetMs = Date.parse(resetAt);
  if (isNaN(resetMs) || Date.now() < resetMs) return { flipped: false, account };
  return {
    flipped: true,
    account: { ...account, status: 'active', last_error: null },
  };
}

/**
 * Single pass over all accounts.
 *
 * @param {{ projectRoot: string }} opts
 * @returns {{ updated: number, statuses: Array<object> }}
 */
function pollOnce({ projectRoot }) {
  const baseDir = projectRoot;
  const registry = loadRuntimeRegistry(baseDir);
  const now = new Date().toISOString();
  let updated = 0;
  const statuses = [];

  for (const [runtime, entry] of Object.entries(registry)) {
    if (!entry || !Array.isArray(entry.accounts)) continue;
    const probe = PROBE_BY_RUNTIME[runtime] || (() => ({ status: 'unknown', reason: 'unsupported runtime' }));

    for (let i = 0; i < entry.accounts.length; i++) {
      const account = entry.accounts[i];
      if (!account) continue;

      let changed = false;
      let workingAccount = { ...account };

      // 1. Auto-flip rate-limited → active when reset_at has passed.
      const { flipped, account: flippedAccount } = maybeFlipResetAt(workingAccount);
      if (flipped) {
        workingAccount = flippedAccount;
        changed = true;
      }

      // 2. Probe quota state.
      let probeResult;
      try {
        probeResult = probe(workingAccount);
      } catch (err) {
        probeResult = { status: 'unknown', reason: `probe threw: ${err.message}` };
      }

      if (probeResult && probeResult.status !== 'unknown') {
        // Probe returned actionable data — update account fields.
        if (probeResult.status && probeResult.status !== workingAccount.status) {
          workingAccount = { ...workingAccount, status: probeResult.status };
          changed = true;
        }
        if (probeResult.current_quota !== undefined && probeResult.current_quota !== workingAccount.current_quota) {
          workingAccount = { ...workingAccount, current_quota: probeResult.current_quota || null };
          changed = true;
        }
        if (probeResult.reset_at !== undefined) {
          workingAccount = { ...workingAccount, reset_at: probeResult.reset_at };
          changed = true;
        }
      }

      if (changed) {
        workingAccount = { ...workingAccount, last_polled_at: now };
        entry.accounts[i] = workingAccount;
        updated++;
      }

      statuses.push({
        runtime,
        label: account.label,
        status_before: account.status,
        status_after: workingAccount.status,
        probe_result: probeResult || null,
        changed,
      });
    }
  }

  // Only write to disk when something changed (skip-if-no-changes).
  if (updated > 0) {
    saveRuntimeRegistry(baseDir, registry);
  }

  return { updated, statuses };
}

module.exports = {
  pollOnce,
  pollCodex,
  pollGemini,
  pollClaude,
  pollOpencode,
};
