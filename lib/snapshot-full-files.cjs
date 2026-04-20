'use strict';

const fs = require('fs');
const path = require('path');

const PRIORITY = [
  'AGENTS.md',
  'STATE.md',
  'STATE.xml',
  'ROADMAP.md',
  'ROADMAP.xml',
  'REQUIREMENTS.md',
  'REQUIREMENTS.xml',
  'DECISIONS.xml',
  'TASK-REGISTRY.xml',
  'session.md',
  'ERRORS-AND-ATTEMPTS.xml',
];

function collectSnapshotFullFiles(planDir) {
  const allFiles = [];
  function collectDir(dir, relBase) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === 'archive' || entry.name === 'sessions' || entry.name === 'node_modules') continue;
        collectDir(path.join(dir, entry.name), rel);
      } else if (entry.isFile()) {
        allFiles.push(rel);
      }
    }
  }
  collectDir(planDir, '');
  allFiles.sort((a, b) => {
    const aIdx = PRIORITY.indexOf(path.basename(a));
    const bIdx = PRIORITY.indexOf(path.basename(b));
    if (aIdx !== -1 && bIdx === -1) return -1;
    if (bIdx !== -1 && aIdx === -1) return 1;
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    return a.localeCompare(b);
  });
  return allFiles;
}

module.exports = { collectSnapshotFullFiles };
