'use strict';
/**
 * lib/retraining/triggers.cjs — trigger detector for the retraining pipeline.
 *
 * checkTriggers(projectRoot, modelId, opts) -> { shouldTrain, reasons[] }
 *
 * Per-kind rules:
 *   LLM:    level Δ ≥ llm_level_delta_min  OR  dataset Δ ≥ dataset_delta_mb_min
 *   mid:    last_train_at > 7 days ago (cron_weekly)  OR  drift-flagged
 *   kNN/intent: dataset Δ ≥ knn_dpo_delta_min new DPO pairs since last_train
 */

const fs = require('fs');
const path = require('path');

const { getModel } = require('../models/registry.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSettingInt(key, defaultVal) {
  try {
    const { getSetting } = require('../settings-registry.cjs');
    const v = getSetting(key);
    return typeof v === 'number' ? v : defaultVal;
  } catch (_) {
    return defaultVal;
  }
}

function readCurrentLevel(projectRoot) {
  try {
    const stateXml = path.join(projectRoot, '.planning', 'STATE.xml');
    if (!fs.existsSync(stateXml)) return null;
    const content = fs.readFileSync(stateXml, 'utf8');
    const m = content.match(/<level[^>]*value="(\d+)"/);
    if (m) return parseInt(m[1], 10);
    const m2 = content.match(/<level[^>]*>(\d+)<\/level>/);
    if (m2) return parseInt(m2[1], 10);
    return null;
  } catch (_) {
    return null;
  }
}

function computeDatasetMb(projectRoot) {
  // Sum sizes under .planning/datasets/ recursively
  const datasetsDir = path.join(projectRoot, '.planning', 'datasets');
  if (!fs.existsSync(datasetsDir)) return 0;
  let totalBytes = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        try { totalBytes += fs.statSync(full).size; } catch (_) {}
      }
    }
  }
  walk(datasetsDir);
  return totalBytes / (1024 * 1024);
}

function countDpoPairs(projectRoot) {
  const dpoDir = path.join(projectRoot, '.planning', 'datasets', 'dpo');
  if (!fs.existsSync(dpoDir)) return 0;
  let count = 0;
  for (const f of fs.readdirSync(dpoDir)) {
    if (!f.endsWith('.jsonl')) continue;
    try {
      const lines = fs.readFileSync(path.join(dpoDir, f), 'utf8')
        .split('\n').filter((l) => l.trim().length > 0);
      count += lines.length;
    } catch (_) {}
  }
  return count;
}

function isDriftFlagged(projectRoot) {
  const curatorLog = path.join(projectRoot, '.planning', 'datasets-curator.log');
  if (!fs.existsSync(curatorLog)) return false;
  try {
    const content = fs.readFileSync(curatorLog, 'utf8');
    // Curator emits lines with 'drift' keyword when semantic drift detected
    return /\bdrift\b/i.test(content);
  } catch (_) {
    return false;
  }
}

function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

// ---------------------------------------------------------------------------
// Per-kind trigger evaluators
// ---------------------------------------------------------------------------

function checkLlmTriggers(projectRoot, model) {
  const reasons = [];
  const levelDeltaMin = readSettingInt('workflow.training.llm_level_delta_min', 2);
  const datasetDeltaMbMin = readSettingInt('workflow.training.dataset_delta_mb_min', 500);

  const currentLevel = readCurrentLevel(projectRoot);
  if (currentLevel !== null && model.level_at_train !== null) {
    const delta = currentLevel - model.level_at_train;
    if (delta >= levelDeltaMin) {
      reasons.push(`level_delta: ${delta} ≥ ${levelDeltaMin} (current=${currentLevel}, at_train=${model.level_at_train})`);
    }
  } else if (currentLevel !== null && model.level_at_train === null) {
    reasons.push(`level_delta: never trained (current level=${currentLevel})`);
  }

  const currentMb = computeDatasetMb(projectRoot);
  const trainMb = model.dataset_volume_at_train_mb || 0;
  const deltaMb = currentMb - trainMb;
  if (deltaMb >= datasetDeltaMbMin) {
    reasons.push(`dataset_delta: ${deltaMb.toFixed(1)}MB ≥ ${datasetDeltaMbMin}MB`);
  }

  return reasons;
}

function checkMidTriggers(projectRoot, model) {
  const reasons = [];
  const weeklyDays = 7;

  const daysSinceTrain = daysSince(model.last_train_at);
  if (daysSinceTrain >= weeklyDays) {
    const label = model.last_train_at
      ? `${daysSinceTrain.toFixed(1)} days ago`
      : 'never trained';
    reasons.push(`cron_weekly: last train ${label} (threshold=${weeklyDays}d)`);
  }

  if (isDriftFlagged(projectRoot)) {
    reasons.push('drift_flag: datasets-curator.log contains drift signal');
  }

  return reasons;
}

function checkKnnTriggers(projectRoot, model) {
  const reasons = [];
  const knnDpoMin = readSettingInt('workflow.training.knn_dpo_delta_min', 100);

  const totalPairs = countDpoPairs(projectRoot);
  const pairsAtTrain = model.dpo_pairs_at_train || 0;
  const delta = totalPairs - pairsAtTrain;
  if (delta >= knnDpoMin) {
    reasons.push(`dpo_accumulation: ${delta} new pairs ≥ ${knnDpoMin} (total=${totalPairs}, at_train=${pairsAtTrain})`);
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * checkTriggers(projectRoot, modelId, opts?) -> { shouldTrain, reasons[] }
 *
 * opts.force — bypass condition checks; always return shouldTrain=true
 */
function checkTriggers(projectRoot, modelId, opts = {}) {
  const model = getModel(projectRoot, modelId);
  if (!model) {
    return { shouldTrain: false, reasons: [`model not found in registry: ${modelId}`] };
  }

  if (opts.force) {
    return { shouldTrain: true, reasons: ['force flag set'] };
  }

  let reasons = [];
  switch (model.kind) {
    case 'llm':
      reasons = checkLlmTriggers(projectRoot, model);
      break;
    case 'mid':
      reasons = checkMidTriggers(projectRoot, model);
      break;
    case 'knn':
    case 'intent':
      reasons = checkKnnTriggers(projectRoot, model);
      break;
    default:
      reasons = [`unknown kind '${model.kind}' — no trigger rules defined`];
  }

  return { shouldTrain: reasons.length > 0, reasons };
}

module.exports = { checkTriggers };
