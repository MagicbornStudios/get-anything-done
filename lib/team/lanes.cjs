'use strict';
/**
 * lib/team/lanes.cjs — lane matching between worker specs and handoff frontmatter.
 *
 * Rules (M3.5):
 *   - If worker.lane is null/empty → worker accepts handoffs from any lane.
 *   - If handoff.lane is null/empty → any worker may take it.
 *   - Otherwise → case-insensitive string equality.
 *
 * Lane vocabulary is free-form. Composes with references/agent-lanes.md
 * without coupling — if operator writes "frontend" in both places, it works.
 */

function normalizeLane(s) {
  return (s == null ? '' : String(s)).trim().toLowerCase();
}

function matchesLane(workerLane, handoffLane) {
  const w = normalizeLane(workerLane);
  const h = normalizeLane(handoffLane);
  if (!w) return true;   // worker accepts everything
  if (!h) return true;   // handoff is lane-agnostic
  return w === h;
}

module.exports = { normalizeLane, matchesLane };
