/**
 * startup-purge.cjs — best-effort auto-purge preflight for `gad start`.
 *
 * Task 60-05a. Scans `<baseDir>/.gad/secrets/*.enc` and invokes
 * `lifecycle.purgeExpired()` on each project bag discovered. Errors from
 * any one bag are swallowed and surfaced only on the returned summary —
 * `gad start` MUST NOT fail because a purge pass failed.
 *
 * Why best-effort: a broken envelope, a missing keychain, or a locked
 * passphrase should not prevent the operator from opening the dashboard.
 * The purge is an opportunistic cleanup, not a gate.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { secretsLifecycle: defaultLifecycle } = require('./secrets-lifecycle.cjs');

const ENVELOPE_SUFFIX = '.enc';

/**
 * Enumerate project envelopes inside `<baseDir>/.gad/secrets/`. Returns
 * project ids (filenames with `.enc` stripped). Returns an empty array if
 * the directory does not exist or cannot be read — no BYOK use yet is a
 * normal state, not an error.
 *
 * @param {string} baseDir
 * @param {{readdirSync?: Function, existsSync?: Function}} [fsImpl]
 * @returns {string[]}
 */
function listProjectEnvelopes(baseDir, fsImpl) {
  const impl = fsImpl || fs;
  const secretsDir = path.join(baseDir, '.gad', 'secrets');
  try {
    if (impl.existsSync && !impl.existsSync(secretsDir)) return [];
    const entries = impl.readdirSync(secretsDir);
    return entries
      .filter((name) => typeof name === 'string' && name.endsWith(ENVELOPE_SUFFIX))
      .map((name) => name.slice(0, -ENVELOPE_SUFFIX.length))
      .filter((id) => id.length > 0);
  } catch (_) {
    return [];
  }
}

/**
 * Run purgeExpired() against every project envelope found under
 * `<baseDir>/.gad/secrets/`. Collects per-project results and errors.
 * Never throws — caller can rely on a clean return in all cases.
 *
 * @param {object} opts
 * @param {string} opts.baseDir
 * @param {Date} [opts.asOf] — cutoff timestamp (default: now)
 * @param {object} [opts.lifecycle] — override the default secretsLifecycle
 * @param {object} [opts.fsImpl] — override fs (tests)
 * @returns {Promise<{
 *   scanned: number,
 *   purgedCount: number,
 *   byProject: Array<{projectId: string, purgedCount: number, byKey: object}>,
 *   errors: Array<{projectId: string, code?: string, message: string}>
 * }>}
 */
async function purgeExpiredAllProjects({ baseDir, asOf, lifecycle, fsImpl } = {}) {
  const lc = lifecycle || defaultLifecycle;
  const ids = listProjectEnvelopes(baseDir, fsImpl);
  const cutoff = asOf instanceof Date ? asOf : (asOf ? new Date(asOf) : new Date());
  const byProject = [];
  const errors = [];
  let purgedCount = 0;

  for (const projectId of ids) {
    try {
      const result = await lc.purgeExpired({ projectId, asOf: cutoff });
      if (result && result.purgedCount > 0) {
        byProject.push({
          projectId,
          purgedCount: result.purgedCount,
          byKey: result.byKey || {},
        });
        purgedCount += result.purgedCount;
      }
    } catch (e) {
      errors.push({
        projectId,
        code: e && e.code ? e.code : undefined,
        message: e && e.message ? e.message : String(e),
      });
    }
  }

  return { scanned: ids.length, purgedCount, byProject, errors };
}

/**
 * Render a one-line summary for `gad start` stderr. Empty string when no
 * bags exist and nothing was purged — caller can suppress the line.
 *
 * @param {object} summary — return value of purgeExpiredAllProjects
 * @returns {string}
 */
function renderStartupPurgeSummary(summary) {
  if (!summary) return '';
  const { scanned, purgedCount, byProject, errors } = summary;
  if (scanned === 0) return '';
  const parts = [];
  if (purgedCount > 0) {
    const projects = byProject.map((p) => `${p.projectId}=${p.purgedCount}`).join(', ');
    parts.push(`purged ${purgedCount} expired key version(s) across ${byProject.length} project(s): ${projects}`);
  } else {
    parts.push(`scanned ${scanned} project bag(s), 0 expired versions`);
  }
  if (errors.length > 0) {
    parts.push(`${errors.length} bag(s) errored — see audit log`);
  }
  return `[gad start] ${parts.join('; ')}\n`;
}

module.exports = {
  listProjectEnvelopes,
  purgeExpiredAllProjects,
  renderStartupPurgeSummary,
};
