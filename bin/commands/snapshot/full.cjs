'use strict';

const fs = require('fs');
const path = require('path');
const { collectSnapshotFullFiles } = require('../../../lib/snapshot-full-files.cjs');

function handleFullSnapshot(deps, context, args) {
  const { root, planDir, scope, agentView, assignments, sdkAssetAliases } = context;
  const allFiles = collectSnapshotFullFiles(planDir);

  if (args.json || deps.shouldUseJson()) {
    const files = allFiles.map((rel) => {
      let content = null;
      try { content = fs.readFileSync(path.join(planDir, rel), 'utf8'); } catch {}
      return { path: `${root.planningDir}/${rel}`, content };
    });
    console.log(JSON.stringify({
      project: root.id,
      mode: 'full',
      planningDir: root.planningDir,
      scope,
      agent: agentView,
      assignments,
      sdkAssetAliases,
      files,
    }, null, 2));
    return;
  }

  console.log(`\nSnapshot (full): ${root.id} - ${allFiles.length} files\n`);
  console.log('SDK asset aliases:');
  for (const [alias, relPath] of Object.entries(sdkAssetAliases)) {
    console.log(`- ${alias}/... -> ${relPath}/...`);
  }
  if (agentView) {
    console.log('\nAgent lane:');
    console.log(`- ${agentView.agentId} [${agentView.runtime}] role=${agentView.agentRole} depth=${agentView.depth}`);
  }
  if (assignments.activeAgents.length > 0) {
    console.log('\nActive assignments:');
    for (const row of assignments.activeAgents) {
      console.log(`- ${row.agentId} tasks=${row.tasks.join(', ') || '(none)'}`);
    }
  }
  console.log('');
  for (const rel of allFiles) {
    console.log(`${'='.repeat(70)}`);
    console.log(`## ${root.planningDir}/${rel}`);
    console.log(`${'='.repeat(70)}`);
    try { console.log(fs.readFileSync(path.join(planDir, rel), 'utf8')); } catch { console.log('(unreadable)'); }
    console.log('');
  }
  console.log(`=== end snapshot (${allFiles.length} files) ===`);
}

module.exports = { handleFullSnapshot };
