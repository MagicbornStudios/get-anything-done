'use strict';
/**
 * startup/session-bootstrap.cjs — ensure graph freshness, materialize a
 * session file for this run, and persist the evolution scan.
 *
 * All three are side-effectful writes under .planning/ and are skipped
 * when side-effects are suppressed.
 *
 * Returns `{ sessionArg: string[], sessionId: string | null }`.
 */

const path = require('path');
const fs = require('fs');

function findRoot(config, projectId) {
  if (!config || !Array.isArray(config.roots)) return null;
  return config.roots.find((r) => r.id === projectId) || null;
}

function maybeRebuildGraph({ root, baseDir, ensureGraphFresh, logger = console }) {
  if (!root) return;
  try {
    const r = ensureGraphFresh(baseDir, root);
    if (r && r.rebuilt) logger.log(`Graph cache rebuilt (${r.reason})`);
  } catch { /* non-fatal */ }
}

function createSession({ root, baseDir, readState, sessionHelpers, logger = console }) {
  const { sessionsDir, generateSessionId, SESSION_STATUS, buildContextRefs, writeSession } = sessionHelpers;
  if (!root) return null;
  try {
    const sDir = sessionsDir(baseDir, root);
    fs.mkdirSync(sDir, { recursive: true });
    const state = readState(root, baseDir);
    const id = generateSessionId();
    const session = {
      id,
      projectId: root.id,
      contextMode: 'loaded',
      position: { phase: state.currentPhase || null, plan: null, task: null },
      status: SESSION_STATUS.ACTIVE,
      refs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _root: root,
      _file: path.join(sDir, `${id}.json`),
    };
    session.refs = buildContextRefs(root, baseDir, session);
    writeSession(session);
    logger.log(`Session created: ${session.id}`);
    return session;
  } catch {
    /* non-fatal — snapshot still works without session */
    return null;
  }
}

function persistEvolutionScan({ root, baseDir, frameworkDir, writeEvolutionScan }) {
  if (!root) return;
  try { writeEvolutionScan(root, baseDir, frameworkDir); } catch { /* non-fatal */ }
}

function bootstrapSession({
  projectId,
  baseDir,
  config,
  frameworkDir,
  sideEffectsSuppressed,
  ensureGraphFresh,
  readState,
  writeEvolutionScan,
  sessionHelpers,
  logger = console,
}) {
  const sessionArg = [];
  if (sideEffectsSuppressed()) return { sessionArg, sessionId: null };

  const root = findRoot(config, projectId);
  maybeRebuildGraph({ root, baseDir, ensureGraphFresh, logger });

  const session = createSession({ root, baseDir, readState, sessionHelpers, logger });
  if (session) sessionArg.push('--session', session.id);

  persistEvolutionScan({ root, baseDir, frameworkDir, writeEvolutionScan });

  return { sessionArg, sessionId: session ? session.id : null };
}

module.exports = { bootstrapSession };
