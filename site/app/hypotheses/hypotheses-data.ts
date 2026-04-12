import type { ComponentType } from "react";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";
import { EVAL_RUNS, type EvalRunRecord } from "@/lib/eval-data";

export interface HypothesisCard {
  id: string;
  name: string;
  decisionId: string;
  statement: string;
  track: string;
  evalProject: string | null;
  detailHref: string;
  status: "preliminary observation" | "discussing" | "resolved" | "not-yet-tested";
  latestEvidence: string;
  skepticLink: string;
}

export const HYPOTHESES: HypothesisCard[] = [
  {
    id: "freedom",
    name: "Freedom Hypothesis",
    decisionId: "gad-36",
    statement:
      "For creative implementation tasks, agent performance correlates inversely with framework constraint. Less prescribed structure leads to better output.",
    track: "Bare workflow track",
    evalProject: "escape-the-dungeon-bare",
    detailHref: "/freedom",
    status: "preliminary observation",
    latestEvidence:
      "Bare improved monotonically 0.10 → 0.50 → 0.70 → 0.805 across rounds 2-4 while GAD never exceeded 0.30 human review. N=4 vs N=5 — not statistically significant. Bare v5 scored highest ingenuity of round 4.",
    skepticLink: "/skeptic#freedom",
  },
  {
    id: "csh",
    name: "Compound-Skills Hypothesis",
    decisionId: "gad-65",
    statement:
      "A coding agent's skill library compounds in value over many rounds as skills are merged and tailored to the project. The emergent workflow should produce monotonically improving results.",
    track: "Emergent workflow track",
    evalProject: "escape-the-dungeon-emergent",
    detailHref: "/emergent",
    status: "preliminary observation",
    latestEvidence:
      "Emergent v4 scored 0.885 (highest round-4 result) after authoring 2 new skills, deprecating 1, and documenting disposition of every inherited skill in CHANGELOG.md. First observed full ratcheting cycle. N=2-3 runs — not enough to claim compounding.",
    skepticLink: "/skeptic#csh",
  },
  {
    id: "emergent-evolution",
    name: "Emergent-Evolution Hypothesis",
    decisionId: "gad-68",
    statement:
      "Synthesis of freedom + CSH. A coding agent given blank artifacts, requirements, and the ability to create/merge/find skills against a GAD-provided foundational pool will produce better work over time. Projects are themselves emergent.",
    track: "Emergent workflow track (same as CSH)",
    evalProject: "escape-the-dungeon-emergent",
    detailHref: "/emergent",
    status: "discussing",
    latestEvidence:
      "Working synthesis only. Depends on gad-73 fundamental skills triumvirate (find-skills / merge-skill / create-skill) existing — audit is unfinished. The metaphor (craftsman) is doing the heavy lifting more than evidence.",
    skepticLink: "/skeptic#emergent-evolution",
  },
  {
    id: "content-driven",
    name: "Content-Driven Hypothesis",
    decisionId: "gad-66",
    statement:
      "Given requirements AND a pre-authored content pack (spells, runes, items, NPCs, dialogue) extracted from prior runs, an agent will produce a more fleshed-out game on top — analogous to making a movie based on a book. Derivative work as a distinct research direction.",
    track: "Content-pack injection track (planned)",
    evalProject: null,
    detailHref: "/content-driven",
    status: "not-yet-tested",
    latestEvidence:
      "No runs yet. Resolved open question: this becomes its own eval track (escape-the-dungeon-inherited-content) distinct from greenfield emergent so CSH measurements stay clean. Comparison rules are intentionally different — content-pack and greenfield runs do NOT share a rubric.",
    skepticLink: "/skeptic",
  },
  {
    id: "pressure-measurable",
    name: "Pressure as measurable",
    decisionId: "gad-75",
    statement:
      "Constraint intensity on the agent during an eval is a first-class variable. Now operationalized programmatically (gad-79) as task_pressure = log2(R + 2G + C + 1) / log2(65) computed from REQUIREMENTS.xml structure.",
    track: "All tracks (metadata, not a rubric dimension)",
    evalProject: null,
    detailHref: "/roadmap",
    status: "resolved",
    latestEvidence:
      "Q1 + Q2 resolved 2026-04-09. Formula implemented in prebuild. v5 computed score: 0.884 (R=21, G=4, C=10, raw=39). Stored as TRACE metadata per gad-79, not a rubric dimension. Distinct from game_pressure (in-game player experience).",
    skepticLink: "/skeptic#pressure",
  },
];

export const STATUS_CONFIG: Record<
  HypothesisCard["status"],
  {
    tint: "outline" | "default" | "success" | "danger";
    icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
    label: string;
  }
> = {
  "preliminary observation": { tint: "default", icon: CircleDashed, label: "preliminary observation" },
  discussing: { tint: "outline", icon: CircleDashed, label: "discussing" },
  resolved: { tint: "success", icon: CheckCircle2, label: "operationalized" },
  "not-yet-tested": { tint: "outline", icon: XCircle, label: "not yet tested" },
};

export const TRACK_TINT: Record<string, string> = {
  "Bare workflow track": "border-emerald-500/40 bg-emerald-500/5",
  "Emergent workflow track": "border-amber-500/40 bg-amber-500/5",
  "Emergent workflow track (same as CSH)": "border-amber-500/40 bg-amber-500/5",
  "Content-pack injection track (planned)": "border-pink-500/40 bg-pink-500/5",
  "All tracks (metadata, not a rubric dimension)": "border-sky-500/40 bg-sky-500/5",
};

export function buildTrackData(): HypothesisTrackPoint[] {
  const roundForVersion: Record<string, string> = {
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
  };
  const bareRoundForVersion: Record<string, string> = {
    v1: "Round 2",
    v2: "Round 2",
    v3: "Round 3",
    v4: "Round 4",
    v5: "Round 4",
  };
  const emergentRoundForVersion: Record<string, string> = {
    v1: "Round 2",
    v2: "Round 3",
    v3: "Round 4",
    v4: "Round 4",
  };
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

  function scoreOf(r: EvalRunRecord): number | null {
    return r.humanReviewNormalized?.aggregate_score ?? r.humanReview?.score ?? null;
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
    const existing = point[series];
    if (existing == null || s > existing) point[series] = s;
  }
  return points;
}
