'use strict';

function resolveSnapshotSession(deps, baseDir, root, args) {
  const sessionId = (args.sessionid || args.session || process.env.GAD_SESSION_ID || '').trim();
  let snapshotSession = null;
  if (sessionId) {
    const allSessions = deps.loadSessions(baseDir, [root]);
    snapshotSession = allSessions.find((session) => session.id === sessionId) || null;
  }
  const explicitMode = (args.mode || '').trim().toLowerCase();
  const resolvedMode = (() => {
    if (explicitMode) return explicitMode;
    if (snapshotSession && snapshotSession.staticLoadedAt) return 'active';
    return 'full';
  })();
  return { snapshotSession, resolvedMode };
}

module.exports = { resolveSnapshotSession };
