'use strict';
/**
 * lib/project-commands/index.cjs — per-project .planning/commands/ extension surface
 *
 * Enables any GAD project to register its own `gad <name>` subcommands by
 * dropping CJS files under `<project-root>/.planning/commands/`.
 *
 * File contract (one of two export shapes):
 *
 *   Shape A — direct defineCommand export (simple scripts):
 *     module.exports = defineCommand({ meta, args, run });
 *
 *   Shape B — factory export (needs deps, preferred for advanced commands):
 *     module.exports.create<PascalName>Command = (deps) => defineCommand({ meta, args, run });
 *     // Also accepted: any single export matching /^create[A-Z].*Command$/.
 *
 * Collision policy (two projects ship a command with the same name):
 *   - Both are registered under their namespaced form: `<projectId>:<name>`
 *   - If only one project has the name it is ALSO registered as bare `<name>`
 *   - A warning is printed to stderr when a collision forces namespace-only mode
 *   - Operators can always invoke `gad <projectId>:<name>` regardless of collisions
 *
 * Fault tolerance:
 *   - require() failures (syntax error, missing dep) are caught, logged to stderr,
 *     and skipped — they never crash the main CLI.
 */

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a kebab/snake command name to PascalCase for expected factory name.
 * e.g. "eval-matrix" → "EvalMatrix"
 */
function toPascalCase(name) {
  return String(name || '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Attempt to resolve a citty command from the module's exports.
 * Returns `{ command, via }` where `via` is 'default' | 'factory'.
 * Returns null on an unrecognised shape.
 */
function resolveCommand(mod, commandName, deps) {
  // Shape A: module.exports is the command object directly (has `run` or `subCommands`)
  if (
    mod &&
    typeof mod === 'object' &&
    !Array.isArray(mod) &&
    (typeof mod.run === 'function' || typeof mod.subCommands === 'object')
  ) {
    return { command: mod, via: 'default' };
  }

  // Shape B: named factory matching create<PascalName>Command
  const expectedName = `create${toPascalCase(commandName)}Command`;
  if (typeof mod[expectedName] === 'function') {
    return { command: mod[expectedName](deps), via: 'factory', factoryName: expectedName };
  }

  // Shape B fallback: any single export matching /^create[A-Z].*Command$/
  const factories = Object.entries(mod).filter(
    ([key, val]) => /^create[A-Z].*Command$/.test(key) && typeof val === 'function',
  );
  if (factories.length === 1) {
    const [key, fn] = factories[0];
    return { command: fn(deps), via: 'factory', factoryName: key };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * discoverProjectCommands(roots, deps)
 *
 * @param {Array<{id: string, path: string, planningDir?: string}>} roots
 *   Array of project roots from gad-config (each has id + path + optional planningDir).
 * @param {object} deps
 *   Dependency bag forwarded to factory-style commands.
 * @returns {Array<{projectId, name, file, command}>}
 */
function discoverProjectCommands(roots, deps) {
  const discovered = [];

  for (const root of roots) {
    const planningDir = root.planningDir || '.planning';
    const projectRoot = root.path;
    const projectId = root.id || path.basename(projectRoot);
    const commandsDir = path.join(projectRoot, planningDir, 'commands');

    if (!fs.existsSync(commandsDir)) continue;

    let files;
    try {
      files = fs.readdirSync(commandsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.cjs'))
        .map((entry) => entry.name)
        .sort();
    } catch (err) {
      process.stderr.write(
        `[gad-cli-ext] WARN: cannot read commands dir ${commandsDir}: ${err.message}\n`,
      );
      continue;
    }

    for (const file of files) {
      const commandName = file.replace(/\.cjs$/, '');
      const commandPath = path.join(commandsDir, file);

      let mod;
      try {
        mod = require(commandPath);
      } catch (err) {
        process.stderr.write(
          `[gad-cli-ext] WARN: skipping ${commandPath}: ${err.message}\n`,
        );
        continue;
      }

      const factoryDeps = {
        ...deps,
        projectRoot,
        project: root,
        commandName,
        commandPath,
        commandsDir,
      };

      let resolved;
      try {
        resolved = resolveCommand(mod, commandName, factoryDeps);
      } catch (err) {
        process.stderr.write(
          `[gad-cli-ext] WARN: skipping ${commandPath} (factory invocation failed): ${err.message}\n`,
        );
        continue;
      }

      if (!resolved) {
        process.stderr.write(
          `[gad-cli-ext] WARN: skipping ${commandPath}: unrecognised export shape. ` +
          `Expected module.exports = defineCommand({...}) OR ` +
          `module.exports.create${toPascalCase(commandName)}Command = (deps) => defineCommand({...})\n`,
        );
        continue;
      }

      discovered.push({
        projectId,
        name: commandName,
        file: commandPath,
        command: resolved.command,
      });
    }
  }

  return discovered;
}

/**
 * registerProjectCommands(subCommands, roots, deps)
 *
 * Discovers all project commands and merges them into `subCommands`.
 *
 * Collision policy:
 *   - Each command is always available as `gad <projectId>:<name>`
 *   - If the bare name is unique across all discovered commands, it is ALSO
 *     registered as `gad <name>` (zero friction for single-project setups)
 *   - On collision, both are demoted to namespace-only and a warning is printed
 *
 * @param {object} subCommands   The mutable subCommands map being built by gad.cjs
 * @param {Array}  roots         Project roots from gad-config
 * @param {object} deps          Dep bag forwarded to factories (includes defineCommand etc.)
 */
function registerProjectCommands(subCommands, roots, deps) {
  const discovered = discoverProjectCommands(roots, deps);
  if (discovered.length === 0) return;

  // Count how many projects each bare name appears in
  const nameCount = new Map();
  for (const entry of discovered) {
    nameCount.set(entry.name, (nameCount.get(entry.name) || 0) + 1);
  }

  for (const entry of discovered) {
    const { projectId, name, command } = entry;
    const namespacedKey = `${projectId}:${name}`;

    // Always register namespaced form (skip if a built-in already owns it — that's
    // an unlikely edge case but we must not crash).
    if (!Object.prototype.hasOwnProperty.call(subCommands, namespacedKey)) {
      subCommands[namespacedKey] = command;
    } else {
      process.stderr.write(
        `[gad-cli-ext] WARN: ${namespacedKey} is already registered; skipping project command ${entry.file}\n`,
      );
      continue;
    }

    const count = nameCount.get(name) || 0;
    if (count > 1) {
      // Collision — namespace-only, emit warning once per name
      if (!nameCount.has(`__warned:${name}`)) {
        process.stderr.write(
          `[gad-cli-ext] WARN: multiple projects define a command named "${name}"; ` +
          `registering each under <projectId>:<name> only. Use "gad ${namespacedKey}" to invoke.\n`,
        );
        nameCount.set(`__warned:${name}`, true);
      }
    } else if (!Object.prototype.hasOwnProperty.call(subCommands, name)) {
      // Bare registration — unique name, no collision with built-ins
      subCommands[name] = command;
    } else {
      // Bare name is taken by a built-in — warn but keep the namespaced form
      process.stderr.write(
        `[gad-cli-ext] WARN: "${name}" is already a built-in gad command; ` +
        `project command available as "gad ${namespacedKey}" only.\n`,
      );
    }
  }
}

module.exports = { discoverProjectCommands, registerProjectCommands };
