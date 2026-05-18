'use strict';
/**
 * bin/commands/config.cjs — `gad config` family
 *
 * Subcommands:
 *   gad config register [path] [--id <id>]    Register a project in ~/.gad/registry.json
 *   gad config unregister <id-or-path>        Remove from registry
 *   gad config list                           Show all registered projects
 *   gad config show                           Show resolved config for current root
 *
 * Phase 121-03 (2026-05-18)
 */

const path = require('path');
const { defineCommand } = require('citty');
const registry = require('../../lib/gad-registry.cjs');

function createConfigCommand(deps) {
  const { gadConfig, findRepoRoot, outputError } = deps;

  const registerCmd = defineCommand({
    meta: { name: 'register', description: 'Register a project root in the global GAD registry (~/.gad/registry.json)' },
    args: {
      path: { type: 'positional', required: false, description: 'Project root path (defaults to cwd)' },
      id: { type: 'string', description: 'Explicit project id (auto-detected from config if omitted)' },
    },
    async run({ args }) {
      const projectPath = args.path || process.cwd();
      const result = registry.registerProject(projectPath, args.id || null);
      console.log(`${result.action === 'updated' ? 'Updated' : 'Registered'} [${result.id}] → ${result.path}`);
    },
  });

  const unregisterCmd = defineCommand({
    meta: { name: 'unregister', description: 'Remove a project from the global registry' },
    args: {
      target: { type: 'positional', required: true, description: 'Project id or path to remove' },
    },
    async run({ args }) {
      const removed = registry.unregisterProject(args.target);
      if (removed) {
        console.log(`Removed "${args.target}" from registry.`);
      } else {
        outputError(`Not found in registry: "${args.target}"`);
        process.exit(1);
      }
    },
  });

  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List all registered GAD projects' },
    args: {
      json: { type: 'boolean', default: false, description: 'Output as JSON' },
      stale: { type: 'boolean', default: false, description: 'Show only stale entries (path missing)' },
    },
    async run({ args }) {
      const projects = registry.listProjects();
      const filtered = args.stale ? projects.filter((p) => p.stale) : projects;
      if (args.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }
      if (filtered.length === 0) {
        console.log(args.stale ? 'No stale entries.' : 'No registered projects. Use `gad config register` to add one.');
        return;
      }
      const pad = Math.max(...filtered.map((p) => p.id.length), 4);
      console.log(`${'ID'.padEnd(pad)}  ${'PATH'.padEnd(50)}  REGISTERED`);
      console.log(`${'-'.repeat(pad)}  ${'-'.repeat(50)}  ${'-'.repeat(24)}`);
      for (const p of filtered) {
        const staleTag = p.stale ? ' [STALE]' : '';
        console.log(`${p.id.padEnd(pad)}  ${p.path.padEnd(50)}  ${p.registered_at || ''}${staleTag}`);
      }
    },
  });

  const showCmd = defineCommand({
    meta: { name: 'show', description: 'Show resolved GAD config for the current project root' },
    args: {
      root: { type: 'string', description: 'Explicit project root (defaults to repo root)' },
      json: { type: 'boolean', default: false, description: 'Output as JSON' },
    },
    async run({ args }) {
      const root = args.root || findRepoRoot();
      const cfg = gadConfig.load(root);
      if (args.json) {
        console.log(JSON.stringify(cfg, null, 2));
        return;
      }
      console.log(`Source:  ${cfg.source}`);
      console.log(`Config:  ${cfg.configPath || '(defaults)'}`);
      console.log(`Mode:    ${cfg.mode}`);
      console.log(`Roots (${cfg.roots.length}):`);
      for (const r of cfg.roots) {
        const enabled = r.enabled !== false ? '' : ' [disabled]';
        console.log(`  [${r.id}] ${r.path}/${r.planningDir}${r.discover ? ' (discover)' : ''}${enabled}`);
      }
      if (process.env.GAD_CONFIG) {
        console.log(`GAD_CONFIG override: ${process.env.GAD_CONFIG}`);
      }
    },
  });

  return defineCommand({
    meta: { name: 'config', description: 'Manage GAD configuration and project registry' },
    subCommands: {
      register: registerCmd,
      unregister: unregisterCmd,
      list: listCmd,
      show: showCmd,
    },
  });
}

function register({ common }) {
  const { gadConfig, findRepoRoot, outputError } = common;
  const configCmd = createConfigCommand({ gadConfig, findRepoRoot, outputError });
  return { config: configCmd };
}

module.exports = { createConfigCommand, register };
