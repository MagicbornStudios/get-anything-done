'use strict';
/**
 * lib/models/bench-gate.cjs — encapsulated bench-gate decision logic.
 *
 * shouldPromote(projectRoot, newId, oldId, opts?) -> { pass, reasons[], delta_elo, ... }
 *
 * Pass conditions:
 *   - ELO delta (candidate − active) >= min_improvement (from
 *     workflow.training.min_elo_improvement setting, default 10)
 *   - No regressions on must-pass bench tasks (if must_pass_sets configured
 *     in workflow.training.must_pass_sets, candidate must match-or-beat active
 *     on EACH listed set; otherwise pass).
 *
 * If oldId is null / no active model of same kind, pass=true with reason
 * 'no-incumbent' — first promotion is always allowed.
 *
 * If either side is missing bench results, behavior is controlled by opts:
 *   - opts.requireBench (default false) — missing bench results = fail
 *   - default — missing bench results = pass with 'no-bench-data' reason
 */

const { getModel, getCurrentElo, listModels } = require('./registry.cjs');

const DEFAULT_MIN_ELO_IMPROVEMENT = 10;

function readSetting(key, fallback) {
  try {
    const { getSetting } = require('../settings-registry.cjs');
    const v = getSetting(key);
    return v === undefined || v === null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

/**
 * Build a map of {benchSet -> latestElo} for a model.
 * Returns {} if the model has no bench_results.
 */
function latestEloPerSet(model) {
  if (!model || !model.bench_results || model.bench_results.length === 0) return {};
  const bySet = {};
  for (const r of model.bench_results) {
    const prev = bySet[r.set];
    if (!prev || new Date(r.ts).getTime() >= new Date(prev.ts).getTime()) {
      bySet[r.set] = r;
    }
  }
  const out = {};
  for (const [set, entry] of Object.entries(bySet)) out[set] = entry.elo;
  return out;
}

/**
 * shouldPromote — decide whether a staging candidate can replace the active model.
 *
 * @param {string} projectRoot - absolute path to project root (with .planning/)
 * @param {string} newId - candidate model id
 * @param {string|null} oldId - current active model id of same kind, or null
 * @param {object} [opts]
 * @param {number} [opts.minImprovement] - override min_elo_improvement
 * @param {string[]} [opts.mustPassSets] - bench set ids that must not regress
 * @param {boolean} [opts.requireBench=false] - fail when bench data missing
 * @param {string} [opts.headlineSet] - bench set whose ELO drives the gate decision
 *   (default: workflow.training.headline_bench_set setting, fallback 'general')
 * @returns {{pass: boolean, reasons: string[], delta_elo: number|null,
 *   candidate_elo: number|null, active_elo: number|null,
 *   regressions: string[]}}
 */
function shouldPromote(projectRoot, newId, oldId, opts = {}) {
  const reasons = [];
  const regressions = [];

  const candidate = getModel(projectRoot, newId);
  if (!candidate) {
    return {
      pass: false,
      reasons: [`candidate not found: ${newId}`],
      delta_elo: null,
      candidate_elo: null,
      active_elo: null,
      regressions: [],
    };
  }

  // No incumbent: first-promotion always passes
  if (!oldId) {
    return {
      pass: true,
      reasons: ['no-incumbent: first promotion of kind'],
      delta_elo: null,
      candidate_elo: getCurrentElo(projectRoot, newId),
      active_elo: null,
      regressions: [],
    };
  }

  const active = getModel(projectRoot, oldId);
  if (!active) {
    return {
      pass: true,
      reasons: [`active model not found: ${oldId} — treating as no-incumbent`],
      delta_elo: null,
      candidate_elo: getCurrentElo(projectRoot, newId),
      active_elo: null,
      regressions: [],
    };
  }

  const headlineSet = opts.headlineSet
    || readSetting('workflow.training.headline_bench_set', 'general');

  // Prefer the headline set; fall back to "any latest" if neither side has it
  const candPerSet = latestEloPerSet(candidate);
  const actvPerSet = latestEloPerSet(active);
  let candidateElo;
  let activeElo;
  if (candPerSet[headlineSet] !== undefined || actvPerSet[headlineSet] !== undefined) {
    candidateElo = candPerSet[headlineSet] !== undefined ? candPerSet[headlineSet] : null;
    activeElo = actvPerSet[headlineSet] !== undefined ? actvPerSet[headlineSet] : null;
  } else {
    candidateElo = getCurrentElo(projectRoot, newId);
    activeElo = getCurrentElo(projectRoot, oldId);
  }

  const requireBench = !!opts.requireBench;

  if (candidateElo === null || activeElo === null) {
    if (requireBench) {
      return {
        pass: false,
        reasons: ['no-bench-data: ELO missing; requireBench=true'],
        delta_elo: null,
        candidate_elo: candidateElo,
        active_elo: activeElo,
        regressions: [],
      };
    }
    return {
      pass: true,
      reasons: ['no-bench-data: ELO missing on one side; allowing promotion'],
      delta_elo: null,
      candidate_elo: candidateElo,
      active_elo: activeElo,
      regressions: [],
    };
  }

  const minImprovement = (typeof opts.minImprovement === 'number')
    ? opts.minImprovement
    : readSetting('workflow.training.min_elo_improvement', DEFAULT_MIN_ELO_IMPROVEMENT);

  const deltaElo = candidateElo - activeElo;
  if (deltaElo < minImprovement) {
    reasons.push(`elo_gate_failed: delta=${deltaElo} < min=${minImprovement} (candidate=${candidateElo}, active=${activeElo})`);
  } else {
    reasons.push(`elo_gate_passed: delta=${deltaElo} >= min=${minImprovement}`);
  }

  // Must-pass sets: candidate must match-or-beat active on each listed set
  const mustPassSets = Array.isArray(opts.mustPassSets)
    ? opts.mustPassSets
    : (readSetting('workflow.training.must_pass_sets', []) || []);

  if (mustPassSets.length > 0) {
    for (const setId of mustPassSets) {
      const c = candPerSet[setId];
      const a = actvPerSet[setId];
      if (c === undefined || a === undefined) {
        // Missing data on a must-pass set is a regression unless both sides absent
        if (c === undefined && a === undefined) continue;
        regressions.push(`${setId}: missing bench result (candidate=${c}, active=${a})`);
        continue;
      }
      if (c < a) {
        regressions.push(`${setId}: candidate=${c} < active=${a}`);
      }
    }
    if (regressions.length > 0) {
      reasons.push(`must_pass_regression: ${regressions.length} set(s)`);
    } else {
      reasons.push(`must_pass_passed: ${mustPassSets.length} set(s)`);
    }
  }

  const eloPasses = deltaElo >= minImprovement;
  const noRegressions = regressions.length === 0;
  return {
    pass: eloPasses && noRegressions,
    reasons,
    delta_elo: deltaElo,
    candidate_elo: candidateElo,
    active_elo: activeElo,
    regressions,
  };
}

/**
 * Convenience: find the active model of the same kind as `newId` and call
 * shouldPromote with it as oldId. Returns same shape as shouldPromote.
 */
function shouldPromoteAuto(projectRoot, newId, opts = {}) {
  const candidate = getModel(projectRoot, newId);
  if (!candidate) {
    return shouldPromote(projectRoot, newId, null, opts);
  }
  const sameKind = listModels(projectRoot, { kind: candidate.kind });
  const active = sameKind.find((m) => m.status === 'active' && m.id !== newId);
  return shouldPromote(projectRoot, newId, active ? active.id : null, opts);
}

module.exports = {
  shouldPromote,
  shouldPromoteAuto,
  DEFAULT_MIN_ELO_IMPROVEMENT,
};
