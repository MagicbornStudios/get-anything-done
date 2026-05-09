'use strict';
/**
 * gad settings — list / get / set / unset / describe
 *
 * Extracted as a stand-alone command module following the factory pattern
 * established in bin/commands/state.cjs and bin/commands/note.cjs.
 *
 * Factory deps used: findRepoRoot, gadConfig, outputError
 * (resolveRoots not required — settings resolution uses its own path logic)
 */

const path = require('path');
const { defineCommand } = require('citty');
const {
  REGISTRY,
  getSetting,
  resolveSettingSource,
  validateSetting,
  userSettingsTomlPath,
  projectTomlPath,
  writeTomlKey,
  UNSET_SENTINEL,
  coerce,
  findEntry,
} = require('../../lib/settings-registry.cjs');

function createSettingsCommand(deps) {
  const { findRepoRoot, gadConfig, outputError } = deps;

  // Build opts for settings-registry resolution.
  //
  // Strategy: walk up the directory tree looking for a gad-config.toml that
  // contains the requested --projectid. Needed because the CLI may be invoked
  // from a subdirectory (e.g. vendor/get-anything-done/) that has its own
  // gad-config.toml; the monorepo root TOML (one or more levels up) is the
  // actual project store for ids like 'global'.
  function buildOpts(args) {
    const fsLocal = require('fs');
    const projectid = args && args.projectid;

    // Walk up from cwd looking for a gad-config.toml that contains the
    // requested projectid. If no projectid given, stop at first config found.
    let projTomlPath = null;
    let dir = process.cwd();
    for (let i = 0; i < 12; i++) {
      const candidate = path.join(dir, 'gad-config.toml');
      if (fsLocal.existsSync(candidate)) {
        if (!projectid) {
          projTomlPath = candidate;
          break;
        }
        // Check if this config has the requested projectid in its roots
        try {
          const config = gadConfig.load(dir);
          const roots = config.roots || [];
          const root = roots.find((r) => r.id === projectid);
          if (root) {
            // The root's path is relative to this config's dir
            const rootDir = path.resolve(dir, root.path || '.');
            const rootCandidate = path.join(rootDir, 'gad-config.toml');
            projTomlPath = fsLocal.existsSync(rootCandidate) ? rootCandidate : candidate;
            break;
          }
        } catch (_) {
          // malformed config — skip, keep walking up
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    const baseDir = projTomlPath ? path.dirname(projTomlPath) : process.cwd();
    return { baseDir, projectTomlPath: projTomlPath };
  }

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List all registry settings with current value and source' },
    args: {
      scope: { type: 'string', description: 'Filter by scope: user | project | all', default: 'all' },
      source: { type: 'string', description: 'Filter by source: env | config | default | all', default: 'all' },
      projectid: { type: 'string', description: 'Project id for config resolution', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const opts = buildOpts(args);
      const rows = [];
      for (const entry of REGISTRY) {
        if (args.scope !== 'all' && entry.scope !== args.scope) continue;
        const { source, value } = resolveSettingSource(entry.key, opts);
        const srcLabel = source === 'project' ? 'config' : source;
        if (args.source !== 'all' && srcLabel !== args.source) continue;
        rows.push({
          key: entry.key,
          value,
          source,
          scope: entry.scope,
          type: entry.type,
          envVar: entry.envVar || null,
        });
      }
      if (args.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }
      if (rows.length === 0) {
        console.log('No settings match the filter.');
        return;
      }
      // Table header
      const keyW = Math.max(3, ...rows.map((r) => r.key.length));
      const valW = Math.max(5, ...rows.map((r) => String(r.value).length));
      const srcW = 7;
      const header = `${'KEY'.padEnd(keyW)}  ${'VALUE'.padEnd(valW)}  ${'SOURCE'.padEnd(srcW)}  SCOPE`;
      console.log(header);
      console.log('-'.repeat(header.length));
      for (const r of rows) {
        const valStr = r.value === null ? 'null' : String(r.value);
        console.log(`${r.key.padEnd(keyW)}  ${valStr.padEnd(valW)}  ${r.source.padEnd(srcW)}  ${r.scope}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // get
  // -------------------------------------------------------------------------
  const getCmd = defineCommand({
    meta: { name: 'get', description: 'Show current value and source for a setting' },
    args: {
      key: { type: 'positional', description: 'Setting key (e.g. kael.dual_generate.enabled)', required: true },
      projectid: { type: 'string', description: 'Project id for config resolution', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const entry = findEntry(args.key);
      if (!entry) {
        outputError(`Unknown setting: ${args.key}. Run 'gad settings list' to see all keys.`);
        process.exit(1);
      }
      const opts = buildOpts(args);
      const { source, value } = resolveSettingSource(args.key, opts);
      if (args.json) {
        console.log(JSON.stringify({ key: args.key, value, source }, null, 2));
        return;
      }
      const valStr = value === null ? 'null' : String(value);
      console.log(`${args.key}`);
      console.log(`  value : ${valStr}`);
      console.log(`  source: ${source}`);
      if (entry.envVar) console.log(`  envVar: ${entry.envVar}`);
    },
  });

  // -------------------------------------------------------------------------
  // set
  // -------------------------------------------------------------------------
  const setCmd = defineCommand({
    meta: { name: 'set', description: 'Write a setting to project or user config' },
    args: {
      key: { type: 'positional', description: 'Setting key', required: true },
      value: { type: 'positional', description: 'Value to set', required: true },
      scope: { type: 'string', description: 'Write to: user | project (default: entry scope)', default: '' },
      projectid: { type: 'string', description: 'Project id for config resolution', default: '' },
    },
    run({ args }) {
      const entry = findEntry(args.key);
      if (!entry) {
        outputError(`Unknown setting key: ${args.key}. Run 'gad settings list' for valid keys.`);
        process.exit(1);
      }
      const scope = args.scope || entry.scope;
      if (scope !== 'user' && scope !== 'project') {
        outputError(`--scope must be 'user' or 'project', got: ${scope}`);
        process.exit(1);
      }
      const coerced = coerce(entry.type, args.value);
      if (coerced === undefined) {
        outputError(`Cannot coerce value ${JSON.stringify(args.value)} to type ${entry.type} for key ${args.key}`);
        process.exit(1);
      }
      const vr = validateSetting(args.key, coerced);
      if (!vr.valid) {
        outputError(vr.reason);
        process.exit(1);
      }

      const opts = buildOpts(args);
      let targetPath;
      if (scope === 'project') {
        targetPath = opts.projectTomlPath;
        if (!targetPath) {
          outputError('No gad-config.toml found. Pass --projectid or run from a project root.');
          process.exit(1);
        }
      } else {
        targetPath = userSettingsTomlPath();
      }

      writeTomlKey(targetPath, 'settings', args.key, coerced);
      console.log(`Set ${args.key} = ${JSON.stringify(coerced)} in [${scope}] config`);
      console.log(`  File: ${targetPath}`);
    },
  });

  // -------------------------------------------------------------------------
  // unset
  // -------------------------------------------------------------------------
  const unsetCmd = defineCommand({
    meta: { name: 'unset', description: 'Remove a setting from project or user config (env vars are not affected)' },
    args: {
      key: { type: 'positional', description: 'Setting key', required: true },
      scope: { type: 'string', description: 'Remove from: user | project (default: entry scope)', default: '' },
      projectid: { type: 'string', description: 'Project id for config resolution', default: '' },
    },
    run({ args }) {
      const entry = findEntry(args.key);
      if (!entry) {
        outputError(`Unknown setting key: ${args.key}. Run 'gad settings list' for valid keys.`);
        process.exit(1);
      }
      const scope = args.scope || entry.scope;
      if (scope !== 'user' && scope !== 'project') {
        outputError(`--scope must be 'user' or 'project', got: ${scope}`);
        process.exit(1);
      }

      if (entry.envVar && process.env[entry.envVar] !== undefined) {
        console.warn(`Note: env var ${entry.envVar} is still set; it will override config after unset.`);
      }

      const opts = buildOpts(args);
      let targetPath;
      if (scope === 'project') {
        targetPath = opts.projectTomlPath;
        if (!targetPath) {
          outputError('No gad-config.toml found.');
          process.exit(1);
        }
      } else {
        targetPath = userSettingsTomlPath();
      }

      writeTomlKey(targetPath, 'settings', args.key, UNSET_SENTINEL);
      console.log(`Unset ${args.key} from [${scope}] config`);
      console.log(`  File: ${targetPath}`);
    },
  });

  // -------------------------------------------------------------------------
  // describe
  // -------------------------------------------------------------------------
  const describeCmd = defineCommand({
    meta: { name: 'describe', description: 'Describe a setting: type, range, default, env var, current value' },
    args: {
      key: { type: 'positional', description: 'Setting key', required: true },
      projectid: { type: 'string', description: 'Project id for config resolution', default: '' },
    },
    run({ args }) {
      const entry = findEntry(args.key);
      if (!entry) {
        outputError(`Unknown setting: ${args.key}. Run 'gad settings list' for valid keys.`);
        process.exit(1);
      }
      const opts = buildOpts(args);
      const { source, value } = resolveSettingSource(args.key, opts);
      const valStr = value === null ? 'null' : String(value);
      console.log(`Key         : ${entry.key}`);
      console.log(`Description : ${entry.description}`);
      console.log(`Type        : ${entry.type}`);
      console.log(`Default     : ${entry.default === null ? 'null' : String(entry.default)}`);
      console.log(`Scope       : ${entry.scope}`);
      if (entry.envVar) console.log(`Env var     : ${entry.envVar}`);
      console.log(`Current     : ${valStr}  (source: ${source})`);
    },
  });

  return defineCommand({
    meta: { name: 'settings', description: 'Read and write gad settings (env > project config > user config > default)' },
    subCommands: {
      list: listCmd,
      get: getCmd,
      set: setCmd,
      unset: unsetCmd,
      describe: describeCmd,
    },
  });
}

module.exports = { createSettingsCommand };
module.exports.register = (ctx) => {
  const cmd = createSettingsCommand(ctx.common);
  return { settings: cmd };
};
