'use strict';

const path = require('path');

function maybeBuildGraphSection(deps, context) {
  const { baseDir, root, readOnlySnapshot, repoRoot } = context;
  if (!deps.graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path))) return null;
  const { graph } = deps.graphExtractor.loadOrBuildGraph(root, baseDir, {
    gadDir: repoRoot,
    readOnly: readOnlySnapshot,
  });
  if (!graph || !graph.meta) return null;

  const lines = [];
  lines.push(`${graph.meta.nodeCount} nodes, ${graph.meta.edgeCount} edges`);
  lines.push(`Types: ${Object.entries(graph.meta.nodeTypes).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  lines.push(`Last rebuild: ${graph.meta.generated}`);
  const edgeCounts = new Map();
  for (const edge of graph.edges) {
    edgeCounts.set(edge.source, (edgeCounts.get(edge.source) || 0) + 1);
    edgeCounts.set(edge.target, (edgeCounts.get(edge.target) || 0) + 1);
  }
  const topNodes = [...edgeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (topNodes.length > 0) {
    lines.push('');
    lines.push('Most-connected:');
    for (const [nodeId, count] of topNodes) {
      const node = graph.nodes.find((entry) => entry.id === nodeId);
      const label = node ? (node.label || '').slice(0, 60) : '';
      lines.push(`  ${nodeId} (${count} edges)${label ? ' — ' + label : ''}`);
    }
  }
  lines.push('');
  lines.push('Query: `gad query "open tasks in phase X"` — 12.9x token savings vs raw XML');
  return { title: 'GRAPH', content: lines.join('\n') };
}

function stampSnapshotSession(deps, context, isActiveMode) {
  const { snapshotSession, readOnlySnapshot } = context;
  if (!snapshotSession || readOnlySnapshot) return;
  const now = new Date().toISOString();
  snapshotSession.lastSnapshotAt = now;
  if (!isActiveMode) snapshotSession.staticLoadedAt = now;
  deps.writeSession(snapshotSession);
}

module.exports = {
  maybeBuildGraphSection,
  stampSnapshotSession,
};
