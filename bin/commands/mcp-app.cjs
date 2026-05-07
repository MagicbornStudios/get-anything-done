'use strict';
/**
 * gad mcp-app — CLI surface for the mcp-app manifest registry (Phase 162-05).
 *
 * Subcommands:
 *   find <intent> [--project <id>] [--json]
 *     — keyword-rank components matching the intent query; returns top 5.
 *   describe <component_id> [--json]
 *     — return the full spec for one component by id.
 *
 * Both subcommands reuse the same registry loaded by lib/mcp-app/index.cjs
 * and lib/mcp/tools.cjs at server-boot time. Here we load it inline via
 * the same gad-config pattern used by other CLI commands.
 */

const path = require('node:path');
const fs = require('node:fs');
const { defineCommand } = require('citty');
const { aggregateManifests, findComponent } = require('../../lib/mcp-app/index.cjs');

// ---------------------------------------------------------------------------
// Registry helpers (same approach as lib/mcp/tools.cjs _getRegistry)
// ---------------------------------------------------------------------------

function buildRegistry(deps) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  const projects = (config.roots || []).map((r) => ({
    projectId: r.id,
    rootPath: path.resolve(baseDir, r.path || '.'),
    planningDir: path.resolve(baseDir, r.path || '.', r.planningDir || '.planning'),
  }));
  return aggregateManifests(projects);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createMcpAppCommand(deps) {
  // ---------- find ----------
  const findCmd = defineCommand({
    meta: {
      name: 'find',
      description: 'Find UI components matching an intent query. Keyword-ranked; returns top 5.',
    },
    args: {
      intent: {
        type: 'positional',
        description: 'Natural-language query (e.g. "operator todos")',
        required: true,
      },
      project: {
        type: 'string',
        description: 'Optional project id to restrict search (e.g. "global")',
        default: '',
      },
      json: {
        type: 'boolean',
        description: 'Output as JSON array',
        default: false,
      },
    },
    run({ args }) {
      let registry;
      try {
        registry = buildRegistry(deps);
      } catch (e) {
        deps.outputError(`mcp-app: failed to load registry — ${e.message}`);
        process.exit(1);
        return;
      }

      const projectFilter = args.project || undefined;
      const matches = findComponent(registry, args.intent, projectFilter);

      if (args.json) {
        console.log(JSON.stringify(matches, null, 2));
        return;
      }

      if (matches.length === 0) {
        console.log(`No components matched "${args.intent}".`);
        return;
      }

      console.log(`${matches.length} match(es) for "${args.intent}":\n`);
      for (let i = 0; i < matches.length; i++) {
        const c = matches[i];
        const tags = (c.tags || []).join(', ');
        console.log(`${i + 1}. [${c.project}] ${c.id}  (${c.surface})  — ${c.title}`);
        console.log(`   intent: ${c.intent}`);
        console.log(`   route:  ${c.route}`);
        if (tags) console.log(`   tags:   ${tags}`);
        console.log('');
      }
    },
  });

  // ---------- describe ----------
  const describeCmd = defineCommand({
    meta: {
      name: 'describe',
      description: 'Return the full spec for one MCP component by id.',
    },
    args: {
      component_id: {
        type: 'positional',
        description: 'Component id (kebab-case, e.g. "kael-route")',
        required: true,
      },
      json: {
        type: 'boolean',
        description: 'Output as JSON (default true when stdout is not a TTY)',
        default: false,
      },
    },
    run({ args }) {
      let registry;
      try {
        registry = buildRegistry(deps);
      } catch (e) {
        deps.outputError(`mcp-app: failed to load registry — ${e.message}`);
        process.exit(1);
        return;
      }

      const comp = (registry.components || []).find((c) => c.id === args.component_id);
      if (!comp) {
        const ids = (registry.components || []).map((c) => c.id).join(', ') || '(none registered)';
        deps.outputError(`component "${args.component_id}" not found.\nKnown ids: ${ids}`);
        process.exit(1);
        return;
      }

      const forceJson = args.json || !process.stdout.isTTY;
      if (forceJson) {
        console.log(JSON.stringify(comp, null, 2));
        return;
      }

      // Human-readable
      console.log(`[${comp.project}] ${comp.id}  (${comp.surface})`);
      console.log(`  title:   ${comp.title}`);
      console.log(`  intent:  ${comp.intent}`);
      console.log(`  route:   ${comp.route}`);
      if (comp.tags && comp.tags.length > 0) console.log(`  tags:    ${comp.tags.join(', ')}`);
      if (comp.capabilities && comp.capabilities.length > 0) console.log(`  caps:    ${comp.capabilities.join(', ')}`);
      if (comp.args && comp.args.length > 0) {
        console.log('  args:');
        for (const a of comp.args) {
          console.log(`    ${a.name}  (${a.type})${a.required ? '  [required]' : ''}`);
        }
      }
    },
  });

  return defineCommand({
    meta: {
      name: 'mcp-app',
      description: 'Query the mcp-app.json component registry — find components by intent, or describe one by id.',
    },
    subCommands: {
      find: findCmd,
      describe: describeCmd,
    },
  });
}

module.exports = { createMcpAppCommand };
module.exports.register = (ctx) => ({ 'mcp-app': createMcpAppCommand(ctx.common) });
