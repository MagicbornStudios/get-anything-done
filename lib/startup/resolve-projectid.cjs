'use strict';
/**
 * startup/resolve-projectid.cjs — pick the projectid to snapshot against.
 *
 * Precedence: args.projectid > last-active (if still in config) > first root.
 * Returns `{ projectId: '', source: '' }` when nothing resolves.
 */

function resolveProjectId({ args, config, getLastActiveProjectid }) {
  const fromArg = String((args && args.projectid) || '').trim();
  if (fromArg) return { projectId: fromArg, source: 'arg' };

  try {
    const lastActive = String(getLastActiveProjectid() || '').trim();
    const knownIds = new Set((config && config.roots ? config.roots : []).map((r) => r.id));
    if (lastActive && knownIds.has(lastActive)) {
      return { projectId: lastActive, source: 'user-settings' };
    }
  } catch { /* non-fatal */ }

  if (config && Array.isArray(config.roots) && config.roots.length > 0) {
    return { projectId: config.roots[0].id, source: 'first-root' };
  }

  return { projectId: '', source: '' };
}

function announceResolution({ projectId, source, logger = console }) {
  if (!projectId) return;
  if (source === 'user-settings') {
    logger.log(`Resolved projectid from user settings: ${projectId}`);
  } else if (source === 'first-root') {
    logger.log(`Resolved projectid from first configured root: ${projectId}`);
  }
}

module.exports = { resolveProjectId, announceResolution };
