'use strict';

const { defineCommand } = require('citty');
const path = require('path');

function createEvolutionScanCommand({ repoRoot, findRepoRoot, gadConfig, resolveRoots, writeEvolutionScan, shouldUseJson }) {
  const evolutionScan = defineCommand({
    meta: { name: 'scan', description: 'Run the lightweight evolution scan and write .planning/.evolution-scan.json' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) return;
      const root = roots[0];
      const { scan, filePath } = writeEvolutionScan(root, baseDir, repoRoot);
      const payload = {
        project: root.id,
        file: path.relative(baseDir, filePath),
        candidateCount: scan.candidates.length,
        shedCount: scan.shedCandidates.length,
        scan,
      };
      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      console.log(`Evolution scan: ${payload.candidateCount} candidate(s), ${payload.shedCount} shed candidate(s) -> ${payload.file}`);
    },
  });
  return evolutionScan;
}

module.exports = { createEvolutionScanCommand };