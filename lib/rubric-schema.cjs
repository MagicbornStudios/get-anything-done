/**
 * Human review rubric schema — phase 27 track 1.
 *
 * Replaces the single `human_review: { score, notes }` field in TRACE.json
 * with a structured dimensions object. Each dimension is scored 0.0-1.0 with
 * its own notes so reviewers can disagree about playability without throwing
 * out the rest. An aggregate score is derived from weighted dimensions;
 * legacy single-score runs remain readable through a synthesis path.
 *
 * Rubric versions are pinned to eval project gad.json under
 * `human_review_rubric`. Projects can define their own dimensions — the
 * schema only enforces the envelope.
 *
 * Referenced by phase 27 plan (27-01) and decision gad-61 (data production
 * priority).
 */

'use strict';

const DEFAULT_RUBRIC_VERSION = 'v1';

/**
 * Default rubric for escape-the-dungeon family. Projects can override via
 * gad.json `human_review_rubric`. Weights sum to 1.0.
 */
const DEFAULT_DIMENSIONS = Object.freeze([
  {
    key: 'playability',
    label: 'Playability',
    weight: 0.3,
    description:
      'Does the game actually run end-to-end? Title → new game → rooms → combat → return → continue. No softlocks. Inputs respond as expected.',
  },
  {
    key: 'ui_polish',
    label: 'UI polish',
    weight: 0.2,
    description:
      'Does the UI feel intentional? Icons, HP/mana bars, room-type visual differentiation, styled controls. Not raw ASCII or debug panels.',
  },
  {
    key: 'mechanics_implementation',
    label: 'Mechanics implementation',
    weight: 0.2,
    description:
      'Are the declared mechanics (combat, forge, rune crafting, resistances) functional and coherent? Do they produce the system loops the design doc describes?',
  },
  {
    key: 'ingenuity_requirement_met',
    label: 'Ingenuity requirement met',
    weight: 0.2,
    description:
      'v4 core principle: do starter abilities ACTUALLY feel insufficient? Does the forge produce spells that feel necessary rather than cosmetic? Can you reach floor 2 without crafting? If yes, the gate failed.',
  },
  {
    key: 'stability',
    label: 'Stability',
    weight: 0.1,
    description:
      'Does the game crash? Do scene transitions leave stale state? Does save/load work? Can you complete a run from start to end-of-content without reload?',
  },
]);

/**
 * Build an empty rubric shell ready for a reviewer to fill in. Takes an
 * optional dimensions override from a project's gad.json; falls back to the
 * defaults above.
 */
function emptyRubric(dimensionsOverride, rubricVersion = DEFAULT_RUBRIC_VERSION) {
  const dims = dimensionsOverride && dimensionsOverride.length > 0 ? dimensionsOverride : DEFAULT_DIMENSIONS;
  const dimensions = {};
  for (const d of dims) {
    dimensions[d.key] = { score: null, notes: null };
  }
  return {
    rubric_version: rubricVersion,
    dimensions,
    aggregate_score: null,
    notes: null,
    reviewed_by: null,
    reviewed_at: null,
  };
}

/**
 * Compute aggregate score from a populated rubric. Returns null if any
 * dimension is unscored (reviewer hasn't completed the rubric yet).
 */
function computeAggregate(rubric, dimensionsDef = DEFAULT_DIMENSIONS) {
  if (!rubric || !rubric.dimensions) return null;
  let sum = 0;
  let totalWeight = 0;
  for (const d of dimensionsDef) {
    const dim = rubric.dimensions[d.key];
    if (!dim || typeof dim.score !== 'number') {
      return null;
    }
    sum += dim.score * d.weight;
    totalWeight += d.weight;
  }
  if (totalWeight === 0) return null;
  return +(sum / totalWeight).toFixed(4);
}

/**
 * Detect whether a human_review block is the legacy single-score format or
 * the new dimensions format. Legacy has a top-level `score` number; new has
 * `dimensions` object + `rubric_version`.
 */
function isLegacyReview(humanReview) {
  if (!humanReview) return true;
  return humanReview.dimensions == null && typeof humanReview.score === 'number';
}

/**
 * Normalize ANY human_review block to the dimensions shape. Legacy runs get
 * a synthetic single-dimension `overall` so the site can render a consistent
 * shape. Used by build-site-data.mjs.
 */
function normalizeHumanReview(humanReview, dimensionsDef = DEFAULT_DIMENSIONS) {
  if (!humanReview) {
    return {
      rubric_version: 'legacy-none',
      dimensions: {},
      aggregate_score: null,
      notes: null,
      reviewed_by: null,
      reviewed_at: null,
      is_legacy: true,
    };
  }

  // Already in new format
  if (humanReview.dimensions != null) {
    return {
      rubric_version: humanReview.rubric_version ?? DEFAULT_RUBRIC_VERSION,
      dimensions: humanReview.dimensions,
      aggregate_score: humanReview.aggregate_score ?? computeAggregate(humanReview, dimensionsDef),
      notes: humanReview.notes ?? null,
      reviewed_by: humanReview.reviewed_by ?? null,
      reviewed_at: humanReview.reviewed_at ?? null,
      is_legacy: false,
    };
  }

  // Legacy format — synthesize a single `overall` dimension from the bare score
  const score = typeof humanReview.score === 'number' ? humanReview.score : null;
  return {
    rubric_version: 'legacy-v0',
    dimensions: {
      overall: {
        score,
        notes: humanReview.notes ?? null,
      },
    },
    aggregate_score: score,
    notes: humanReview.notes ?? null,
    reviewed_by: humanReview.reviewed_by ?? null,
    reviewed_at: humanReview.reviewed_at ?? null,
    is_legacy: true,
  };
}

/**
 * Validate a rubric object. Returns array of errors (empty if valid).
 */
function validateRubric(rubric, dimensionsDef = DEFAULT_DIMENSIONS) {
  const errors = [];
  if (!rubric || typeof rubric !== 'object') {
    return ['rubric is not an object'];
  }
  if (!rubric.dimensions) {
    errors.push('missing dimensions object');
    return errors;
  }
  for (const d of dimensionsDef) {
    const dim = rubric.dimensions[d.key];
    if (!dim) {
      errors.push(`missing dimension: ${d.key}`);
      continue;
    }
    if (dim.score != null) {
      if (typeof dim.score !== 'number') {
        errors.push(`${d.key}.score is not a number`);
      } else if (dim.score < 0 || dim.score > 1) {
        errors.push(`${d.key}.score out of range [0, 1]: ${dim.score}`);
      }
    }
  }
  return errors;
}

module.exports = {
  DEFAULT_RUBRIC_VERSION,
  DEFAULT_DIMENSIONS,
  emptyRubric,
  computeAggregate,
  isLegacyReview,
  normalizeHumanReview,
  validateRubric,
};
