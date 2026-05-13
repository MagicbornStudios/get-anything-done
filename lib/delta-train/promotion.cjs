'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Promotes a candidate model to canonical.
 * 
 * @param {string} slmRoot - Root of the slm-learning project.
 * @param {string} candidateId - ID of the candidate.
 * @param {object} benchResults - Results from BENCH.json.
 * @param {object} trainedOn - Info about training data window.
 */
function promoteCandidate(slmRoot, candidateId, benchResults, trainedOn) {
  const canonicalDir = path.join(slmRoot, 'models', 'canonical');
  const currentPath = path.join(canonicalDir, 'CURRENT.json');
  
  let supersedes = null;
  if (fs.existsSync(currentPath)) {
    try {
      const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
      supersedes = current.model_id;
    } catch (e) {}
  }

  const manifest = {
    model_id: candidateId,
    adapter_path: `models/candidates/${candidateId}/adapter.safetensors`,
    base_model: "Qwen2.5-1.5B-Instruct", // TODO: Get from candidate manifest
    promoted_at: new Date().toISOString(),
    bench: benchResults.scores,
    trained_on: trainedOn,
    supersedes,
  };

  const tmpPath = `${currentPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf8');
  fs.renameSync(tmpPath, currentPath);

  console.log(`[delta-train] Promoted ${candidateId} to canonical.`);
}

module.exports = {
  promoteCandidate,
};
