'use strict';
/**
 * lib/team/profiles.cjs — team profile persistence.
 * A profile is a reusable `workers_spec` blueprint saved to
 * `.planning/team/profiles/<name>.json`.
 *
 * Profile shape:
 *   {
 *     name: "frontend-heavy",
 *     description: "3 workers: 2 frontend codex, 1 claude reviewer",
 *     runtime: "claude-code",        // team default
 *     workers_spec: [
 *       { id: "w1", role: "executor", lane: "frontend", runtime: "codex-cli" },
 *       ...
 *     ],
 *     tick_ms: 2000,
 *     autopause_threshold: 20,
 *     created_at
 *   }
 */

const fs = require('fs');
const path = require('path');
const { readJsonSafe, writeJson } = require('./io.cjs');
const { profilesRoot, profilePath } = require('./paths.cjs');

function listProfiles(baseDir) {
  const dir = profilesRoot(baseDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''))
    .sort();
}

function readProfile(baseDir, name) {
  return readJsonSafe(profilePath(baseDir, name), null);
}

function writeProfile(baseDir, name, profile) {
  const payload = { ...profile, name, created_at: profile.created_at || new Date().toISOString() };
  writeJson(profilePath(baseDir, name), payload);
  return payload;
}

function profileToConfig(profile, { supervisorPid = process.pid } = {}) {
  return {
    workers: (profile.workers_spec || []).length,
    roles: (profile.workers_spec || []).map(w => w.role || 'executor'),
    workers_spec: profile.workers_spec || [],
    runtime: profile.runtime || 'claude-code',
    runtime_cmd: profile.runtime_cmd || null,
    autopause_threshold: profile.autopause_threshold || Number(process.env.GAD_AUTOPAUSE_THRESHOLD || 20),
    tick_ms: profile.tick_ms || 2000,
    created_at: new Date().toISOString(),
    supervisor_pid: supervisorPid,
    from_profile: profile.name || null,
  };
}

module.exports = { listProfiles, readProfile, writeProfile, profileToConfig };
