import { ROUND_SUMMARIES, type Workflow } from "@/lib/eval-data";
import roundsData from "@/data/rounds.json";

export const ROUND_RESULTS_REPO = "https://github.com/MagicbornStudios/get-anything-done";

export const ROUND_RESULTS_WORKFLOW_TINT: Record<Workflow, string> = {
  gad: "border-l-sky-400/70",
  bare: "border-l-emerald-400/70",
  emergent: "border-l-amber-400/70",
};

export const ROUND_SELECT_OPTIONS = ROUND_SUMMARIES.map((s) => s.round);

export type RoundHeadlineData = {
  kicker: string;
  headline: string;
  headlineHighlight: string;
  description: string;
};

export const ROUNDS_HEADLINE_MAP = roundsData as Record<string, RoundHeadlineData>;

export const ROUND_RESULTS_DEFAULT_HEADLINE: RoundHeadlineData = {
  kicker: "All results",
  headline: "Every scored run. Every condition.",
  headlineHighlight: "Every condition.",
  description: "All generation runs with human review scores, across all rounds and conditions.",
};
