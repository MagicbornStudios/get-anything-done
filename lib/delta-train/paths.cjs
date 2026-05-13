'use strict';

const path = require('path');

/**
 * Centralized paths for delta-training state and logs.
 * All paths are relative to the project root (where .planning lives).
 */
function deltaTrainRoot(baseDir) {
  return path.join(baseDir, '.planning', 'delta-training');
}

function statePath(baseDir) {
  return path.join(deltaTrainRoot(baseDir), 'state.json');
}

function historyPath(baseDir) {
  return path.join(deltaTrainRoot(baseDir), 'history.jsonl');
}

function heartbeatPath(baseDir) {
  return path.join(deltaTrainRoot(baseDir), 'heartbeat.json');
}

function pidPath(baseDir) {
  return path.join(deltaTrainRoot(baseDir), 'daemon.pid');
}

function configPath(baseDir) {
  return path.join(deltaTrainRoot(baseDir), 'config.json');
}

function reportsDir(baseDir) {
  return path.join(deltaTrainRoot(baseDir), 'reports');
}

module.exports = {
  deltaTrainRoot,
  statePath,
  historyPath,
  heartbeatPath,
  pidPath,
  configPath,
  reportsDir,
};
