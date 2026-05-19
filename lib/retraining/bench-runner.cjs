'use strict';
/**
 * lib/retraining/bench-runner.cjs — orchestration glue between the bench harness
 * (phase 247: lib/bench-harness/index.cjs) and the model registry (phase 253:
 * lib/models/registry.cjs).
 *
 * Public API:
 *   runBenchForModel(projectRoot, modelId, opts?) -> Promise<{
 *     ok, set, model, contestantId, passCount, problems, elo, resultPath, writtenPath
 *   }>
 *
 * Responsibilities:
 *   - Resolve the bench set (opts.set || `${kind}-default`).
 *   - Resolve / synthesize a contestant for the model. Strategy:
 *       1. If a contestant with the exact model.id exists in .planning/bench-contestants.json,
 *          use that entry (operator pre-registered).
 *       2. Otherwise synthesize a local-ollama contestant against model.id (assumes the
 *          model is locally served by Ollama under its registry id). This is the
 *          conventional default for the retraining loop (decision GLOBAL-D-394 +
 *          memory project_local_inferencing_is_on_desktop.md).
 *   - Run the contestant, write a result file under .planning/bench-results/, and
 *     record an ELO entry on the model via recordBenchResult.
 *
 * ELO derivation (gap until phase 247-10 fold-in is wired):
 *   - We do not have a head-to-head pairing here (the retraining loop benches one
 *     model at a time). So we derive a per-set ELO snapshot from pass-rate:
 *         elo = round(1500 + 800 * (passRate - 0.5))
 *     This is bounded to [900, 2100] for passRate in [0, 1] and maps a neutral
 *     contestant (50% pass) to 1500. shouldPromote (lib/models/bench-gate.cjs)
 *     consumes the delta only, so the absolute scale doesn't matter as long as
 *     the function is monotonic in pass-rate.
 */

const fs = require('node:fs');
const path = require('node:path');

const harness = require('../bench-harness/index.cjs');
const registry = require('../models/registry.cjs');

const ELO_BASELINE = 1500;
const ELO_SPAN = 800; // pass-rate 0 -> 1100, pass-rate 1 -> 1900

function passRateToElo(passRate) {
  const r = Math.max(0, Math.min(1, passRate));
  return Math.round(ELO_BASELINE + ELO_SPAN * (r - 0.5));
}

function loadContestantsRegistry(projectRoot) {
  const p = path.join(projectRoot, '.planning', 'bench-contestants.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return []; }
}

function findOrSynthContestant(projectRoot, model) {
  const list = loadContestantsRegistry(projectRoot);
  const existing = list.find((c) => c.id === model.id);
  if (existing) {
    if (existing.kind === 'local-ollama') {
      return harness.makeOllamaContestant({
        id: existing.id,
        model: existing.model || model.id,
        baseURL: existing.baseURL,
      });
    }
    if (existing.kind === 'http') {
      return harness.makeHttpContestant({
        id: existing.id,
        baseURL: existing.baseURL,
        apiKey: existing.apiKey || '',
        model: existing.model || model.id,
      });
    }
    if (existing.kind === 'runtime-cli') {
      return harness.makeRuntimeCliContestant({
        id: existing.id,
        runtime: existing.runtime,
      });
    }
    // Unknown kind — fall through to local-ollama default.
  }
  // Default: assume Ollama-served model with id = model.id
  return harness.makeOllamaContestant({ id: model.id, model: model.id });
}

/**
 * Run a bench for one model and update the registry.
 *
 * @param {string} projectRoot
 * @param {string} modelId
 * @param {object} [opts]
 * @param {string} [opts.set]       bench set stem (default: `${kind}-default`)
 * @param {boolean} [opts.dryRun]   describe + skip persistence
 * @returns {Promise<object>}       see header
 */
async function runBenchForModel(projectRoot, modelId, opts = {}) {
  const model = registry.getModel(projectRoot, modelId);
  if (!model) {
    const err = new Error(`Model not found: ${modelId}`);
    err.code = 'NO_MODEL';
    throw err;
  }

  const setStem = opts.set || `${model.kind}-default`;

  let problemSet;
  try {
    problemSet = harness.loadProblemSet(setStem, projectRoot);
  } catch (err) {
    const e = new Error(`Failed to load bench set "${setStem}": ${err.message}`);
    e.code = 'NO_SET';
    throw e;
  }

  const contestant = findOrSynthContestant(projectRoot, model);

  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      set: problemSet.id,
      model: modelId,
      contestantId: contestant.id,
      problems: problemSet.problems.length,
    };
  }

  const results = await harness.runContestant(contestant, problemSet);
  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const passCount = results.filter((r) => r.score >= 1).length;
  const passRate = results.length === 0 ? 0 : passCount / results.length;
  const elo = passRateToElo(passRate);

  const resultObj = harness.buildResult(
    { contestant, results, totalScore, passCount },
    problemSet.id
  );
  const writtenPath = harness.writeResult(resultObj, projectRoot);

  // Record on registry (appends to model.bench_results, updates last_bench_at).
  registry.recordBenchResult(projectRoot, modelId, { set: problemSet.id, elo });

  return {
    ok: true,
    set: problemSet.id,
    model: modelId,
    contestantId: contestant.id,
    passCount,
    problems: results.length,
    passRate,
    elo,
    resultId: resultObj.id,
    writtenPath,
  };
}

module.exports = {
  runBenchForModel,
  passRateToElo,
  ELO_BASELINE,
  ELO_SPAN,
};
