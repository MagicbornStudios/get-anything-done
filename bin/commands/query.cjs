'use strict';
/**
 * gad query — structural graph queries (LLM-free)
 *
 * Required deps: findRepoRoot, gadConfig, resolveRoots, graphExtractor
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createQueryCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, graphExtractor } = deps;

  const run = defineCommand({
    meta: { name: 'run', description: 'Run a query against the planning graph' },
    args: {
      q: { type: 'positional', description: 'Natural language query (e.g. "open tasks in phase 44.5")', required: false },
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      type: { type: 'string', description: 'Filter by node type (phase, task, decision, skill, workflow)', default: '' },
      status: { type: 'string', description: 'Filter by status (planned, done, active, cancelled)', default: '' },
      phase: { type: 'string', description: 'Filter tasks in this phase', default: '' },
      skill: { type: 'string', description: 'Filter tasks using this skill', default: '' },
      depends: { type: 'string', description: 'Find nodes that depend on this ID', default: '' },
      cites: { type: 'string', description: 'Find nodes that cite this ID', default: '' },
      search: { type: 'string', description: 'Text search across node fields', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
      rebuild: { type: 'boolean', description: 'Rebuild graph before querying', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;

      const gadDir = path.resolve(__dirname, '..', '..');

      for (const root of roots) {
        let graph;
        let rebuilt = false;
        if (args.rebuild) {
          graph = graphExtractor.buildGraph(root, baseDir, { gadDir });
          const jsonPath = path.join(baseDir, root.path, root.planningDir, 'graph.json');
          try { fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2)); } catch {}
          rebuilt = true;
        } else {
          const result = graphExtractor.loadOrBuildGraph(root, baseDir, { gadDir });
          graph = result.graph;
          rebuilt = result.rebuilt;
        }
        if (rebuilt && !args.json) {
          console.error(`Graph built: ${graph.meta.nodeCount} nodes, ${graph.meta.edgeCount} edges`);
        }

        let query = {};
        if (args.q) query = graphExtractor.parseNaturalQuery(args.q);
        if (args.type) query.type = args.type;
        if (args.status) query.status = args.status;
        if (args.phase) query.phase = args.phase;
        if (args.skill) query.skill = args.skill;
        if (args.depends) query.depends = args.depends;
        if (args.cites) query.cites = args.cites;
        if (args.search) query.search = args.search;

        const result = graphExtractor.queryGraph(graph, query);

        if (args.json) console.log(JSON.stringify(result, null, 2));
        else console.log(graphExtractor.formatQueryResult(result, query));
      }
    },
  });

  return defineCommand({
    meta: { name: 'query', description: 'Query the planning knowledge graph (structural, LLM-free)' },
    subCommands: { run },
  });
}

module.exports = { createQueryCommand };
