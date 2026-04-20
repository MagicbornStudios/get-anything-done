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
 *     common,    // shared dep bag (readers, writers, render, late-bound
 *                // registration hooks, and true cross-cutting helpers)
 *     extras,    // reserved compatibility field; currently expected to be
 *                // empty. Keep the shape stable for loader callers.
 *     services,  // populated during the provides phase, keyed by module name
 *   }
 */

const fs = require('node:fs');
const path = require('node:path');

// Prefer the statically-generated manifest when present. scripts/build-manifest.mjs
// enumerates bin/commands/*.cjs and emits bin/commands/_manifest.cjs with explicit
// requires, so static bundlers (esbuild, bun build --compile) can trace every
// command module. In dev / unbundled contexts the manifest is absent and we fall
// back to filesystem discovery.
function loadManifest() {
  try {
    return require('./_manifest.cjs');
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') return null;
    throw err;
  }
}

function listModules(dir) {
  const manifest = loadManifest();
  if (manifest) {
    return Object.keys(manifest)
      .sort()
      .map((name) => ({ name, mod: manifest[name] }));
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.cjs') && !f.startsWith('_'))
    .sort()
    .map((file) => ({
      name: file.replace(/\.cjs$/, ''),
      mod: require(path.join(dir, file)),
    }));
}

// Topologically sort modules for the `provides` phase so cross-module
// service consumers see a fully-populated ctx.services.<dep>. A module
// declares its dependencies via `exports.dependsOn = ['<otherName>']`.
// Modules without explicit deps preserve their incoming (alphabetical)
// order. Throws on cycles.
function topologicalSort(modules) {
  const byName = new Map();
  for (const m of modules) byName.set(m.name, m);
  const visited = new Set();
  const visiting = new Set();
  const sorted = [];
  function visit(m) {
    if (visited.has(m.name)) return;
    if (visiting.has(m.name)) {
      throw new Error(`Circular command dependency involving ${m.name}`);
    }
    visiting.add(m.name);
    const deps = m.mod && Array.isArray(m.mod.dependsOn) ? m.mod.dependsOn : [];
    for (const depName of deps) {
      const dep = byName.get(depName);
      if (dep) visit(dep);
    }
    visiting.delete(m.name);
    visited.add(m.name);
    sorted.push(m);
  }
  for (const m of modules) visit(m);
  return sorted;
}

function load({ common, extras }) {
  const dir = __dirname;
  const services = {};
  const ctx = { common, extras, services };
  const modules = topologicalSort(listModules(dir));

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
