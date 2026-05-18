/**
 * bench-elo/index.cjs — Bayesian ELO rating system for local bench arenas.
 *
 * Used by: lib/bench-harness, .planning/commands/bench.cjs,
 *          apps/desk benchmarks-panel Our-ELO tab (GLOBAL-T-247-10)
 *
 * All pure functions — no I/O. Callers own persistence.
 */

"use strict";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default K-factor for standard matches. Higher = faster rating movement. */
const DEFAULT_K = 32;

/** Baseline rating assigned to every new contestant. */
const DEFAULT_BASELINE = 1500;

/** Minimum rating floor — prevents collapse to 0 on long losing streaks. */
const RATING_FLOOR = 100;

// ── Core math ─────────────────────────────────────────────────────────────────

/**
 * expectedScore — probability that contestant A beats contestant B.
 * Standard logistic ELO formula.
 *
 * @param {number} ratingA
 * @param {number} ratingB
 * @returns {number} 0..1
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * updateRating — compute new ratings after a match.
 *
 * score=1   → winner took it
 * score=0   → loser took it (from winner perspective)
 * score=0.5 → draw
 *
 * Returns updated ratings for both sides; winner's new rating is first.
 *
 * @param {number} winnerRating
 * @param {number} loserRating
 * @param {number} [kFactor=32]
 * @param {number} [score=1]   actual score for winner (1=win, 0.5=draw)
 * @returns {{ winner: number, loser: number }}
 */
function updateRating(winnerRating, loserRating, kFactor = DEFAULT_K, score = 1) {
  if (typeof winnerRating !== "number" || typeof loserRating !== "number") {
    throw new TypeError("updateRating: ratings must be numbers");
  }
  const eWinner = expectedScore(winnerRating, loserRating);
  const eLoser = 1 - eWinner;
  const newWinner = Math.max(RATING_FLOOR, winnerRating + kFactor * (score - eWinner));
  const newLoser = Math.max(RATING_FLOOR, loserRating + kFactor * ((1 - score) - eLoser));
  return { winner: newWinner, loser: newLoser };
}

/**
 * applyResult — apply a single match result to a mutable ratings map.
 *
 * @param {Map<string, number>} ratingsMap  contestant-id → rating
 * @param {string} winnerId
 * @param {string} loserId
 * @param {number} [kFactor=32]
 * @param {number} [score=1]
 * @returns {Map<string, number>}  same map, mutated
 */
function applyResult(ratingsMap, winnerId, loserId, kFactor = DEFAULT_K, score = 1) {
  const wRating = ratingsMap.get(winnerId) ?? DEFAULT_BASELINE;
  const lRating = ratingsMap.get(loserId) ?? DEFAULT_BASELINE;
  const { winner, loser } = updateRating(wRating, lRating, kFactor, score);
  ratingsMap.set(winnerId, winner);
  ratingsMap.set(loserId, loser);
  return ratingsMap;
}

/**
 * bootstrapRatings — seed a Map with baseline rating for every contestant.
 *
 * @param {string[]} contestants  array of contestant ids
 * @param {number}   [baseline=1500]
 * @returns {Map<string, number>}
 */
function bootstrapRatings(contestants, baseline = DEFAULT_BASELINE) {
  if (!Array.isArray(contestants)) {
    throw new TypeError("bootstrapRatings: contestants must be an array");
  }
  const map = new Map();
  for (const id of contestants) {
    map.set(id, baseline);
  }
  return map;
}

/**
 * topN — sorted leaderboard slice from a ratings map.
 *
 * @param {Map<string, number>} ratingsMap
 * @param {number} [n=10]
 * @returns {Array<{ id: string, rating: number }>}
 */
function topN(ratingsMap, n = 10) {
  return [...ratingsMap.entries()]
    .map(([id, rating]) => ({ id, rating: Math.round(rating) }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, n);
}

/**
 * replayHistory — reconstruct final ratings from an ordered array of results.
 *
 * @param {Array<{ winner: string, loser: string, kFactor?: number, score?: number }>} results
 * @param {number} [baseline=1500]
 * @returns {Map<string, number>}
 */
function replayHistory(results, baseline = DEFAULT_BASELINE) {
  const ratings = new Map();
  for (const r of results) {
    if (!ratings.has(r.winner)) ratings.set(r.winner, baseline);
    if (!ratings.has(r.loser)) ratings.set(r.loser, baseline);
    applyResult(ratings, r.winner, r.loser, r.kFactor ?? DEFAULT_K, r.score ?? 1);
  }
  return ratings;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  DEFAULT_K,
  DEFAULT_BASELINE,
  RATING_FLOOR,
  expectedScore,
  updateRating,
  applyResult,
  bootstrapRatings,
  topN,
  replayHistory,
};
