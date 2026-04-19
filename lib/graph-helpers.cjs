// Graph rebuild + freshness helpers extracted from bin/gad.cjs.
// Pure wrappers over graphExtractor that encapsulate the silent rebuild
// behaviour invoked by snapshot/startup/state/phases/decisions/etc.

const fs = require('fs');
const path = require('path');

const graphExtractor = require('./graph-extractor.cjs');

function createGraphHelpers({ gadDir }) {
  function maybeRebuildGraph(baseDir, root) {
    try {
      if (!graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path))) return;
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const graph = graphExtractor.buildGraph(root, baseDir, { gadDir });
      fs.writeFileSync(path.join(planDir, 'graph.json'), JSON.stringify(graph, null, 2));
      fs.writeFileSync(path.join(planDir, 'graph.html'), graphExtractor.generateHtml(graph));
    } catch {
      // best-effort, never block primary op
    }
  }

  function ensureGraphFresh(baseDir, root) {
    try {
      if (!graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path))) {
        return { rebuilt: false, reason: 'disabled' };
      }
      const result = graphExtractor.loadOrBuildGraph(root, baseDir, { gadDir });
      const planDir = path.join(baseDir, root.path, root.planningDir);
      const htmlPath = path.join(planDir, 'graph.html');
      if (result.rebuilt || !fs.existsSync(htmlPath)) {
        try { fs.writeFileSync(htmlPath, graphExtractor.generateHtml(result.graph)); }
        catch { /* best-effort */ }
      }
      return { rebuilt: result.rebuilt, reason: result.reason };
    } catch {
      return { rebuilt: false, reason: 'error' };
    }
  }

  return { maybeRebuildGraph, ensureGraphFresh };
}

function buildEvolutionSection(root, baseDir, { readEvolutionScan }) {
  const scan = readEvolutionScan(root, baseDir);
  if (!scan) return null;
  const candidateCount = Array.isArray(scan.candidates) ? scan.candidates.length : 0;
  const shedCount = Array.isArray(scan.shedCandidates) ? scan.shedCandidates.length : 0;
  if (candidateCount === 0 && shedCount === 0) return null;
  return {
    title: 'EVOLUTION',
    content: [
      `${candidateCount} candidates surfaced (last scan: ${String(scan.scannedAt || '').slice(0, 16)}Z)`,
      `${shedCount} skills flagged for shedding (dry-run only)`,
      'Run: gad evolution evolve   |   gad evolution shed --dry-run',
    ].join('\n'),
    scan,
  };
}

module.exports = { createGraphHelpers, buildEvolutionSection };
