'use strict';
/**
 * gad team profile — save / list / show team profiles.
 *
 * Profiles are reusable workers_spec blueprints saved under
 * `.planning/team/profiles/<name>.json`. `gad team start --profile <name>`
 * loads one.
 */

const path = require('path');
const { defineCommand } = require('citty');
const { readProfile, writeProfile, listProfiles } = require('../../../lib/team/profiles.cjs');

function createProfileCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  /**
   * Resolve the project-specific base dir for .planning/team/ operations.
   * Fallback order: (a) --projectid flag; (b) active session projectid via
   * resolveRoots session logic; (c) getLastActiveProjectid(); (d) cwd autodetect.
   */
  function resolveTeamBaseDir(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    // Pass projectid if present; resolveRoots handles session + cwd fallbacks.
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return repoRoot;
    return path.join(repoRoot, root.path);
  }

  const PROJECTID_ARG = { type: 'string', description: 'Target project id (resolves .planning/team/ path)', default: '' };

  const save = defineCommand({
    meta: { name: 'save', description: 'Save a team profile from an inline spec.' },
    args: {
      projectid: PROJECTID_ARG,
      name: { type: 'string', required: true },
      description: { type: 'string', default: '' },
      spec: { type: 'string', description: 'JSON workers_spec array, e.g. \'[{"id":"w1","role":"executor","lane":"frontend","runtime":"codex-cli"}]\'', required: true },
      runtime: { type: 'string', description: 'Team-default runtime when a spec entry omits its own', default: 'claude-code' },
    },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      let workers_spec;
      try { workers_spec = JSON.parse(String(args.spec)); }
      catch (e) { outputError(`Invalid --spec JSON: ${e.message}`); process.exit(1); }
      if (!Array.isArray(workers_spec) || workers_spec.length === 0) {
        outputError('--spec must be a non-empty JSON array.'); process.exit(1);
      }
      for (const w of workers_spec) {
        if (!w || !w.id) { outputError(`Each spec entry needs an id: ${JSON.stringify(w)}`); process.exit(1); }
      }
      const profile = writeProfile(baseDir, String(args.name), {
        description: String(args.description || ''),
        runtime: String(args.runtime),
        workers_spec,
      });
      console.log(`Saved profile: ${profile.name} (${workers_spec.length} workers)`);
    },
  });

  const list = defineCommand({
    meta: { name: 'list', description: 'List saved team profiles.' },
    args: { projectid: PROJECTID_ARG },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const names = listProfiles(baseDir);
      if (names.length === 0) { console.log('No profiles saved yet.'); return; }
      console.log(`Profiles (${names.length}):`);
      for (const n of names) {
        const p = readProfile(baseDir, n) || {};
        const w = (p.workers_spec || []).length;
        console.log(`  ${n}  — ${w} worker${w === 1 ? '' : 's'}${p.description ? `, ${p.description}` : ''}`);
      }
    },
  });

  const show = defineCommand({
    meta: { name: 'show', description: 'Print one profile as JSON.' },
    args: {
      projectid: PROJECTID_ARG,
      name: { type: 'string', required: true },
    },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const p = readProfile(baseDir, String(args.name));
      if (!p) { outputError(`Profile not found: ${args.name}`); process.exit(1); }
      console.log(JSON.stringify(p, null, 2));
    },
  });

  return defineCommand({
    meta: { name: 'profile', description: 'Manage saved team profiles.' },
    subCommands: { save, list, show },
  });
}

module.exports = { createProfileCommand };
