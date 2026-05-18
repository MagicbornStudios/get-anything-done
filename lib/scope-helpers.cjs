'use strict';

/**
 * lib/scope-helpers.cjs — root/scope resolution for project-aware commands.
 *
 * Extracted from bin/gad.cjs (sweep H, 2026-04-19). The helpers depend on
 * `loadSessions` which is exported by bin/commands/session.cjs and only
 * available after the session module has been wired in gad.cjs. We therefore
 * accept a `getLoadSessions` thunk so the binding can be late-resolved.
 *
 * Phase 121-04 (2026-05-18): resolveRoots now falls back to the global
 * registry (~/.gad/registry.json) when --projectid resolves to nothing in
 * the local config's roots array. This enables cross-repo project references
 * without requiring the user to be inside the target repo.
 */

const path = require('path');
const fs = require('fs');

function loadRegistryRoots() {
  try {
    const registry = require('./gad-registry.cjs');
    return registry.listProjects()
      .filter((p) => !p.stale)
      .map((p) => ({
        id: p.id,
        path: p.path,
        planningDir: '.planning',
        discover: false,
        enabled: true,
        _fromRegistry: true,
      }));
  } catch {
    return [];
  }
}

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
      if (found.length > 0) return found;

      // Phase 121-04: fall back to global registry before failing.
      const registryRoots = loadRegistryRoots();
      const foundInRegistry = registryRoots.filter(r => r.id === args.projectid);
      if (foundInRegistry.length > 0) return foundInRegistry;

      const allIds = [...new Set([...allRoots.map(r => r.id), ...registryRoots.map(r => r.id)])];
      console.error(`\nProject not found: ${args.projectid}\n\nAvailable projects:\n`);
      for (const id of allIds) console.error(`  ${id}`);
      if (allIds.length > 0) console.error(`\nRerun with: --projectid ${allIds[0]}`);
      process.exit(1);
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
