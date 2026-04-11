import { type HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";
import { EVAL_RUNS, type EvalRunRecord } from "@/lib/eval-data";

/**
 * Duplicates the buildTrackData helper from /roadmap intentionally — the
 * landing page and /roadmap both need the chart and neither should pull
 * logic from the other. If the mapping changes, update both.
 */

/** Maps eval-run version → round label. Exported for Playable to reuse. */
export const ROUND_VERSION_MAP: Record<string, Record<string, string>> = {
  "escape-the-dungeon": {
    v1: "Round 1",
    v2: "Round 1",
    v3: "Round 1",
    v4: "Round 1",
    v5: "Round 1",
    v6: "Round 2",
    v7: "Round 2",
    v8: "Round 3",
    v9: "Round 4",
    v10: "Round 4",
    v11: "Round 5",
    v12: "Round 5",
  },
  "escape-the-dungeon-bare": {
    v1: "Round 2",
    v2: "Round 2",
    v3: "Round 3",
    v4: "Round 4",
    v5: "Round 4",
    v6: "Round 5",
  },
  "escape-the-dungeon-emergent": {
    v1: "Round 2",
    v2: "Round 3",
    v3: "Round 4",
    v4: "Round 4",
    v5: "Round 5",
    v6: "Round 5",
  },
  "gad-explainer-video": {
    v1: "Round 5",
  },
};

export function roundForRun(r: { project: string; version: string }): string | null {
  return ROUND_VERSION_MAP[r.project]?.[r.version] ?? null;
}

function scoreOf(r: EvalRunRecord): number | null {
  const agg = r.humanReviewNormalized?.aggregate_score;
  if (typeof agg === "number") return agg;
  const legacy = r.humanReview?.score;
  if (typeof legacy === "number") return legacy;
  return null;
}

export function buildTrackData(): HypothesisTrackPoint[] {
  const rounds = ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5"];
  const points: HypothesisTrackPoint[] = rounds.map((round) => ({
    round,
    freedom: null,
    csh: null,
    gad: null,
    contentDriven: null,
    codex: null,
  }));
  const byRound = new Map(points.map((p) => [p.round, p]));

  for (const run of EVAL_RUNS) {
    let round: string | undefined;
    let series: "gad" | "freedom" | "csh" | undefined;

    if (run.project === "escape-the-dungeon") {
      round = ROUND_VERSION_MAP["escape-the-dungeon"][run.version];
      series = "gad";
    } else if (run.project === "escape-the-dungeon-bare") {
      round = ROUND_VERSION_MAP["escape-the-dungeon-bare"][run.version];
      series = "freedom";
    } else if (run.project === "escape-the-dungeon-emergent") {
      round = ROUND_VERSION_MAP["escape-the-dungeon-emergent"][run.version];
      series = "csh";
    }

    if (!round || !series) continue;
    const point = byRound.get(round);
    if (!point) continue;

    const s = scoreOf(run);
    if (s == null) continue;

    const existing = point[series];
    if (existing == null || s > existing) {
      point[series] = s;
    }
  }

  return points;
}

export const EVAL_DOMAINS = [
  { id: "escape-the-dungeon", label: "Escape the Dungeon", hasData: true },
  { id: "gad-explainer-video", label: "GAD Explainer Video", hasData: false },
  { id: "skill-evaluation-app", label: "Skill Evaluation App", hasData: false },
] as const;
