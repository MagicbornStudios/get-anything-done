'use strict';
/**
 * gad command loader — filesystem auto-discovery.
 *
 * Walks bin/commands/ for .cjs files (skipping _-prefixed) and wires each
 * module's exported lifecycle hooks. Adding a new command requires zero
 * edits outside the new file: drop bin/commands/<name>.cjs that exports
 * `register(ctx)` and the loader picks it up.
 *
 * Module contract (all hooks optional):
 *
 *   exports.provides = (ctx) => services
 *     // Returned object is stored at ctx.services[<filename-without-cjs>]
 *     // for other modules to consume in register/postWire.
 *
 *   exports.register = (ctx) => ({ '<name>': cmdDef, ... })
 *     // Returned entries are merged into the top-level subCommands map.
 *     // Multiple keys allowed (multi-output modules + aliases).
 *     // Return undefined / empty object to register no top-level command
 *     // (useful for modules that only `provides` services).
 *
 *   exports.postWire = ({ ...ctx, subCommands }) => void
 *     // Runs after all register hooks. Use for cross-cutting mutations
 *     // (e.g., promoting subcommands across cmd groups). Avoid unless
 *     // genuinely cross-cutting — prefer register + services where possible.
 *
 * ctx shape:
 *   {
 *     common,    // shared dep bag (readers, writers, render, etc.)
 *     extras,    // per-command dep bags (legacy; will be inlined per-module
 *                // over time). extras.setLoadSessions(fn) is honored for
 *                // late-binding loadSessions into scope-helpers.
 *     services,  // populated during the provides phase, keyed by module name
 *   }
 */

const fs = require('node:fs');
const path = require('node:path');

function listModules(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.cjs') && !f.startsWith('_'))
    .sort()
    .map((file) => ({
      name: file.replace(/\.cjs$/, ''),
      mod: require(path.join(dir, file)),
    }));
}

function load({ common, extras }) {
  const dir = __dirname;
  const services = {};
  const ctx = { common, extras, services };
  const modules = listModules(dir);

  for (const { name, mod } of modules) {
    if (typeof mod.provides === 'function') {
      services[name] = mod.provides(ctx);
    }
  }

  const subCommands = {};
  for (const { mod } of modules) {
    if (typeof mod.register !== 'function') continue;
    const out = mod.register(ctx);
    if (out) mergeCommandEntries(subCommands, out);
  }

  for (const { mod } of modules) {
    if (typeof mod.postWire === 'function') {
      mod.postWire({ ...ctx, subCommands });
    }
  }

  return { subCommands, services };
}

function mergeCommandEntries(target, entries) {
  for (const [name, command] of Object.entries(entries)) {
    if (Object.prototype.hasOwnProperty.call(target, name)) {
      throw new Error(`Duplicate gad command registration: ${name}`);
    }
    target[name] = command;
  }
}

module.exports = { load };
