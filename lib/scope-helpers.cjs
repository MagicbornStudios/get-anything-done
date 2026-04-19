'use strict';

/**
 * lib/scope-helpers.cjs — root/scope resolution for project-aware commands.
 *
 * Extracted from bin/gad.cjs (sweep H, 2026-04-19). The helpers depend on
 * `loadSessions` which is exported by bin/commands/session.cjs and only
 * available after the session module has been wired in gad.cjs. We therefore
 * accept a `getLoadSessions` thunk so the binding can be late-resolved.
 */

const path = require('path');

function createScopeHelpers({ getLoadSessions }) {
  function loadSessionsImpl(baseDir, roots) {
    const fn = typeof getLoadSessions === 'function' ? getLoadSessions() : null;
    if (typeof fn !== 'function') {
      throw new Error('scope-helpers: loadSessions not yet bound');
    }
    return fn(baseDir, roots);
  }

  function getActiveSessionProjectId(baseDir, roots) {
    const sessions = loadSessionsImpl(baseDir, roots).filter(s => s.status !== 'closed');
    if (sessions.length === 0) return null;
    return sessions[0].projectId || null;
  }

  function resolveRoots(args, baseDir, allRoots) {
    if (args.all) return allRoots;
    if (args.projectid) {
      const found = allRoots.filter(r => r.id === args.projectid);
      if (found.length === 0) {
        const ids = allRoots.map(r => r.id);
        console.error(`\nProject not found: ${args.projectid}\n\nAvailable projects:\n`);
        for (const id of ids) console.error(`  ${id}`);
        console.error(`\nRerun with: --projectid ${ids[0]}`);
        process.exit(1);
      }
      return found;
    }
    // Decision gad-127: cwd-based auto-scope first, then session-based fallback.
    const cwdResolved = path.resolve(process.cwd());
    for (const root of allRoots) {
      const rootResolved = path.resolve(baseDir, root.path);
      if (cwdResolved.startsWith(rootResolved) && root.id !== 'global') {
        const scoped = allRoots.filter(r => {
          const rPath = path.resolve(baseDir, r.path);
          return rPath.startsWith(rootResolved) || r.id === root.id;
        });
        if (scoped.length > 0) return scoped;
      }
    }
    const sessionId = getActiveSessionProjectId(baseDir, allRoots);
    if (sessionId) {
      const found = allRoots.filter(r => r.id === sessionId);
      if (found.length > 0) return found;
    }
    return allRoots;
  }

  function listActiveSessionsHint(baseDir, config, subcommand) {
    const sessions = loadSessionsImpl(baseDir, config.roots).filter(s => s.status !== 'closed');
    if (sessions.length === 0) {
      console.error('No active sessions. Run `gad session new` to start one.');
      process.exit(1);
    }
    console.error(`\nMissing --id. Active sessions:\n`);
    for (const s of sessions) {
      const phase = s.position?.phase ? `  phase: ${s.position.phase}` : '';
      console.error(`  ${s.id}  [${s.projectId || '?'}]${phase}`);
    }
    console.error(`\nRerun: gad session ${subcommand} --id ${sessions[0].id}`);
    process.exit(1);
  }

  return { getActiveSessionProjectId, resolveRoots, listActiveSessionsHint };
}

module.exports = { createScopeHelpers };
