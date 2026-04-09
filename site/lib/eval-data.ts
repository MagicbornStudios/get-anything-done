/**
 * Public entry point for eval data. All runtime data comes from
 * eval-data.generated.ts (written by scripts/build-site-data.mjs during
 * prebuild). This file only re-exports and adds a few display helpers.
 */

export {
  EVAL_RUNS,
  EVAL_TEMPLATES,
  PLANNING_ZIPS,
  ROUND_SUMMARIES,
  FINDINGS_ROUND_3_RAW,
  FINDINGS_GENERAL_RAW,
  EVAL_PROJECTS,
  PRODUCED_ARTIFACTS,
  GAD_PACK_TEMPLATE,
  PLAYABLE_INDEX,
  WORKFLOW_LABELS,
  WORKFLOW_DESCRIPTIONS,
  type EvalRunRecord,
  type EvalScores,
  type EvalTemplateAsset,
  type PlanningZipAsset,
  type RoundSummary,
  type EvalProjectMeta,
  type ProducedArtifacts,
  type Workflow,
} from "./eval-data.generated";

import {
  EVAL_RUNS,
  PLAYABLE_INDEX,
  type EvalRunRecord,
  type Workflow,
} from "./eval-data.generated";

export const PROJECT_LABELS: Record<string, string> = {
  "escape-the-dungeon": "Escape the Dungeon · GAD",
  "escape-the-dungeon-bare": "Escape the Dungeon · Bare",
  "escape-the-dungeon-emergent": "Escape the Dungeon · Emergent",
  "etd-brownfield-gad": "ETD Brownfield · GAD",
  "etd-brownfield-bare": "ETD Brownfield · Bare",
  "etd-brownfield-emergent": "ETD Brownfield · Emergent",
  "reader-workspace": "Reader Workspace",
};

export function runKey(r: { project: string; version: string }) {
  return `${r.project}/${r.version}`;
}

export function playableUrl(r: { project: string; version: string }): string | null {
  return PLAYABLE_INDEX[runKey(r)] ?? null;
}

export function runsByProject(): Array<{ project: string; runs: EvalRunRecord[] }> {
  const groups = new Map<string, EvalRunRecord[]>();
  for (const r of EVAL_RUNS) {
    const arr = groups.get(r.project) ?? [];
    arr.push(r);
    groups.set(r.project, arr);
  }
  // Sort each project's runs by version number ascending.
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const av = parseInt(a.version.slice(1), 10) || 0;
      const bv = parseInt(b.version.slice(1), 10) || 0;
      return av - bv;
    });
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([project, runs]) => ({ project, runs }));
}

export function runsByWorkflow(): Record<Workflow, EvalRunRecord[]> {
  const by: Record<Workflow, EvalRunRecord[]> = { gad: [], bare: [], emergent: [] };
  for (const r of EVAL_RUNS) {
    if (r.workflow in by) by[r.workflow as Workflow].push(r);
  }
  return by;
}

export function latestPlayableRuns(): EvalRunRecord[] {
  // One representative (latest version) per project that has a playable build.
  const latest = new Map<string, EvalRunRecord>();
  for (const r of EVAL_RUNS) {
    if (!playableUrl(r)) continue;
    const existing = latest.get(r.project);
    if (!existing) {
      latest.set(r.project, r);
    } else {
      const existingV = parseInt(existing.version.slice(1), 10) || 0;
      const thisV = parseInt(r.version.slice(1), 10) || 0;
      if (thisV > existingV) latest.set(r.project, r);
    }
  }
  return [...latest.values()].sort((a, b) => a.project.localeCompare(b.project));
}

export function findRun(project: string, version: string): EvalRunRecord | undefined {
  return EVAL_RUNS.find((r) => r.project === project && r.version === version);
}

export function humanReviewNotes(r: EvalRunRecord): string | null {
  return r.humanReview?.notes ?? null;
}

/**
 * True when the run hit a rate limit before completing. Rate-limited runs
 * are preserved as data points but explicitly excluded from cross-round
 * quality comparisons per decision gad-63.
 */
export function isRateLimited(r: EvalRunRecord): boolean {
  if (!r.timing) return false;
  // Field is on the nested raw timing object.
  const flag = (r.timing as Record<string, unknown>).rate_limited;
  return flag === true;
}

/**
 * Returns only runs suitable for cross-round comparison — completed runs
 * with a scored composite. Rate-limited runs are filtered out; runs without
 * a composite score are also filtered.
 */
export function comparableRuns(runs: EvalRunRecord[] = EVAL_RUNS): EvalRunRecord[] {
  return runs.filter((r) => !isRateLimited(r) && r.scores.composite != null);
}
