'use strict';
/**
 * gad graph — build and inspect the planning knowledge graph
 *
 * Required deps: findRepoRoot, gadConfig, resolveRoots, graphExtractor
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createGraphCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, graphExtractor } = deps;

  const build = defineCommand({
    meta: { name: 'build', description: 'Generate graph.json + graph.html from .planning/ XML files' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      json: { type: 'boolean', description: 'Output graph JSON to stdout instead of file', default: false },
      html: { type: 'boolean', description: 'Also generate graph.html (default true)', default: true },
      stats: { type: 'boolean', description: 'Print graph stats summary', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;

      const gadDir = path.resolve(__dirname, '..', '..');

      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        const graph = graphExtractor.buildGraph(root, baseDir, { gadDir });

        if (args.json) {
          console.log(JSON.stringify(graph, null, 2));
          continue;
        }

        const jsonPath = path.join(planDir, 'graph.json');
        fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
        console.log(`Written: ${path.relative(baseDir, jsonPath)} (${graph.meta.nodeCount} nodes, ${graph.meta.edgeCount} edges)`);

        if (args.html !== false) {
          const htmlPath = path.join(planDir, 'graph.html');
          fs.writeFileSync(htmlPath, graphExtractor.generateHtml(graph));
          console.log(`Written: ${path.relative(baseDir, htmlPath)}`);
        }

        if (args.stats) {
          console.log('');
          console.log(`Node types: ${Object.entries(graph.meta.nodeTypes).map(([k,v]) => `${k}(${v})`).join(', ')}`);
          console.log(`Edge types: ${Object.entries(graph.meta.edgeTypes).map(([k,v]) => `${k}(${v})`).join(', ')}`);
        }
      }
    },
  });

  const stats = defineCommand({
    meta: { name: 'stats', description: 'Show graph statistics without regenerating' },
    args: { projectid: { type: 'string', description: 'Scope to one project', default: '' } },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;

      for (const root of roots) {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        const jsonPath = path.join(planDir, 'graph.json');
        if (!fs.existsSync(jsonPath)) {
          console.log(`No graph.json for ${root.id} — run \`gad graph build\` first.`);
          continue;
        }
        const graph = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log(`[${root.id}] ${graph.meta.nodeCount} nodes, ${graph.meta.edgeCount} edges`);
        console.log(`  Node types: ${Object.entries(graph.meta.nodeTypes).map(([k,v]) => `${k}(${v})`).join(', ')}`);
        console.log(`  Edge types: ${Object.entries(graph.meta.edgeTypes).map(([k,v]) => `${k}(${v})`).join(', ')}`);
        console.log(`  Generated: ${graph.meta.generated}`);
      }
    },
  });

  return defineCommand({
    meta: { name: 'graph', description: 'Build and inspect the planning knowledge graph' },
    subCommands: { build, stats },
  });
}

module.exports = { createGraphCommand };
module.exports.register = (ctx) => ({ graph: createGraphCommand(ctx.common) });
