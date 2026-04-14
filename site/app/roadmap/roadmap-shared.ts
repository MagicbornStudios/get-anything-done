import { EVAL_RUNS, TASK_PRESSURE, type EvalRunRecord } from "@/lib/eval-data";
import type { HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";

/**
 * Per-round task_pressure. Values for rounds with a current template
 * (v4/v5) are COMPUTED programmatically from REQUIREMENTS.xml structure per
 * decision gad-79. Values for historical rounds (v1-v3) without a current
 * template remain as author-rated estimates until their XMLs are
 * reconstructed. Annotations come from the round context.
 */
export function tierLabel(score: number): string {
  if (score >= 0.85) return "High";
  if (score >= 0.65) return "Medium-High";
  if (score >= 0.45) return "Medium";
  if (score >= 0.25) return "Low-Medium";
  return "Low";
}

export const PRESSURE_ANNOTATIONS: Record<string, { note: string; source: "computed" | "authored" }> = {
  "Evolution 1": {
    source: "authored",
    note: "12 systems-focused criteria, no gates. Agents could ship invisible backend and still score 1.0 on requirement_coverage. v1 template not preserved — this is an estimated value until the v1 XML is reconstructed.",
  },
  "Evolution 2": {
    source: "authored",
    note: "Added 2 gate criteria and UI-first mandate. Vertical-slice priority introduced. v2 template not preserved — estimated.",
  },
  "Evolution 3": {
    source: "authored",
    note: "3 explicit gates (game-loop, spell-crafting, UI quality). Rubric weights shifted toward human review. v3 template not preserved — estimated.",
  },
  "Evolution 4": {
    source: "computed",
    note: "4 gates including pressure-mechanics gate itself. Authored-only, ingenuity requirement, forge must tie to encounter design. v4 is the first round with a preserved current template — pressure is COMPUTED from REQUIREMENTS.xml structure (gad-79).",
  },
  "Evolution 5": {
    source: "computed",
    note: "v5 adds 21 requirements on top of v4 base via the <addendum> block: rule-based combat, entity-trait action policies, save checkpoints, spells-as-ingredients, visual map, event-driven rendering. Pressure is COMPUTED from the v5 REQUIREMENTS.xml including the addendum (gad-79).",
  },
};

// Manual fallback values for pre-v4 rounds without a preserved current template.
export const AUTHORED_PRESSURE: Record<string, number> = {
  "Evolution 1": 0.15,
  "Evolution 2": 0.35,
  "Evolution 3": 0.55,
};

// Map round number → requirements version that round targeted.
export const ROUND_TO_VERSION: Record<string, string> = {
  "Evolution 1": "v1",
  "Evolution 2": "v2",
  "Evolution 3": "v3",
  "Evolution 4": "v5", // v4 template now carries the v5 addendum — single source of truth
  "Evolution 5": "v5",
};

/**
 * Build the hypothesis-tracks chart data by grouping EVAL_RUNS per round and
 * per workflow, then extracting the aggregate human review score per
 * (round × workflow) cell. Missing cells become null (chart renders gap).
 */
export function buildTrackData(): HypothesisTrackPoint[] {
  const roundForVersion: Record<string, string> = {
    v1: "Evolution 1", v2: "Evolution 1", v3: "Evolution 1", v4: "Evolution 1", v5: "Evolution 1",
    v6: "Evolution 2", v7: "Evolution 2",
    v8: "Evolution 3",
    v9: "Evolution 4", v10: "Evolution 4",
  };
  const bareRoundForVersion: Record<string, string> = {
    v1: "Evolution 2", v2: "Evolution 2",
    v3: "Evolution 3",
    v4: "Evolution 4", v5: "Evolution 4",
  };
  const emergentRoundForVersion: Record<string, string> = {
    v1: "Evolution 2",
    v2: "Evolution 3",
    v3: "Evolution 4", v4: "Evolution 4",
  };

  const rounds = ["Evolution 1", "Evolution 2", "Evolution 3", "Evolution 4", "Evolution 5"];
  const points: HypothesisTrackPoint[] = rounds.map((round) => ({
    round,
    freedom: null,
    csh: null,
    gad: null,
    contentDriven: null,
    codex: null,
  }));
  const byRound = new Map(points.map((p) => [p.round, p]));

  // Pick the best-scoring run of each workflow per round. "Best" = highest
  // aggregate_score from the normalized rubric, falling back to legacy score.
  function scoreOf(r: EvalRunRecord): number | null {
    const agg = r.humanReviewNormalized?.aggregate_score;
    if (typeof agg === "number") return agg;
    const legacy = r.humanReview?.score;
    if (typeof legacy === "number") return legacy;
    return null;
  }

  for (const run of EVAL_RUNS) {
    let round: string | undefined;
    let series: "gad" | "freedom" | "csh" | undefined;

    if (run.project === "escape-the-dungeon") {
      round = roundForVersion[run.version];
      series = "gad";
    } else if (run.project === "escape-the-dungeon-bare") {
      round = bareRoundForVersion[run.version];
      series = "freedom";
    } else if (run.project === "escape-the-dungeon-emergent") {
      round = emergentRoundForVersion[run.version];
      series = "csh";
    }

    if (!round || !series) continue;
    const point = byRound.get(round);
    if (!point) continue;

    const s = scoreOf(run);
    if (s == null) continue;

    // Keep the best score per cell
    const existing = point[series];
    if (existing == null || s > existing) {
      point[series] = s;
    }
  }

  return points;
}

export function pressureForRound(round: string): { value: number; tier: string; note: string; source: "computed" | "authored" } {
  const annotation = PRESSURE_ANNOTATIONS[round];
  const version = ROUND_TO_VERSION[round];
  const computed = version ? TASK_PRESSURE[version] : undefined;

  if (computed && annotation?.source === "computed") {
    return {
      value: computed.score,
      tier: tierLabel(computed.score),
      note: annotation.note,
      source: "computed",
    };
  }

  const authored = AUTHORED_PRESSURE[round] ?? 0;
  return {
    value: authored,
    tier: tierLabel(authored),
    note: annotation?.note ?? "",
    source: "authored",
  };
}

export const FUTURE_ROUNDS = [
  {
    round: "Evolution 5",
    title: "Greenfield, three-condition, requirements v5",
    body: "**Status:** planned — blocked on HTTP 529 investigation before GAD v11 retry.\n\n**Conditions:** GAD v11, Bare v6, Emergent v5. Serial execution per gad-67.\n\n**What we expect to learn:** (a) does the compound-skills hypothesis hold when requirements expand by 21 items simultaneously? (b) can the GAD workflow finally finish a round against pressure-tier High without api interruption? (c) does Bare's monotonic improvement continue, or does the v5 complexity leap break the pattern?\n\n**Hypothesis tested:** CSH primary. Freedom hypothesis as secondary measurement.",
  },
  {
    round: "Evolution 6",
    title: "Content-pack injection experiment",
    body: "**Status:** queued — depends on gad-66 content-pack extraction CLI.\n\n**New eval track:** escape-the-dungeon-inherited-content. Runs a new build on top of a preserved content pack (spells, runes, items, NPCs) extracted from the best round-5 runs.\n\n**Hypothesis tested:** content-driven hypothesis. Distinct from freedom and CSH — we do NOT compare content-pack runs to runs on the same rubric.",
  },
  {
    round: "Evolution 7",
    title: "Codex vs Claude Code comparison",
    body: "**Status:** queued — depends on gad.json `runner` field extension.\n\n**Setup:** identical requirements (likely v4 for cleanest comparison, re-run as a hypothesis revisit per gad-72), identical workflows, different agent runtime. One worktree per runner, serial execution.\n\n**Hypothesis tested:** runtime-effect hypothesis. New line of data, not a new requirements version.",
  },
];

export const ROADMAP_PRESSURE_ROUNDS = [
  "Evolution 1",
  "Evolution 2",
  "Evolution 3",
  "Evolution 4",
  "Evolution 5",
] as const;
