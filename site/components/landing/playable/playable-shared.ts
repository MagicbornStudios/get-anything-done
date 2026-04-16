import type { EvalRunRecord, Workflow } from "@/lib/eval-data";
import type { ReviewState } from "@/lib/filter-store";

export const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export function runKey(r: { project: string; version: string }) {
  return `${r.project}/${r.version}`;
}

export const WORKFLOW_TINT: Record<Workflow, string> = {
  gad: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  bare: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  emergent: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

export function reviewStateFor(r: EvalRunRecord): ReviewState {
  const t = r.timing as Record<string, unknown> | null | undefined;
  if (t && (t.rate_limited === true || t.api_interrupted === true)) {
    return "excluded";
  }
  const norm = r.humanReviewNormalized;
  if (norm && !norm.is_empty && norm.aggregate_score != null) {
    return "reviewed";
  }
  if (r.humanReview && typeof r.humanReview.score === "number") {
    return "reviewed";
  }
  return "needs-review";
}

export const REVIEW_STATE_DOT: Record<ReviewState, string> = {
  reviewed: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]",
  "needs-review": "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)] animate-pulse",
  excluded: "bg-zinc-500",
};

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  reviewed: "Reviewed",
  "needs-review": "Needs review",
  excluded: "Excluded (interrupted)",
};

const ROUND_COLORS = [
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  "border-purple-500/40 bg-purple-500/10 text-purple-400",
  "border-sky-500/40 bg-sky-500/10 text-sky-400",
  "border-amber-500/40 bg-amber-500/10 text-amber-400",
  "border-rose-500/40 bg-rose-500/10 text-rose-400",
];

export function roundColor(round: string | null): string {
  if (!round) return "border-border/40 bg-card/20 text-muted-foreground";
  const num = parseInt(round.replace("Evolution ", ""), 10);
  if (isNaN(num)) return ROUND_COLORS[0];
  return ROUND_COLORS[(num - 1) % ROUND_COLORS.length];
}

export const WORKFLOW_HYPOTHESIS: Record<string, string> = {
  gad: "GAD framework",
  bare: "Freedom",
  emergent: "CSH",
};

export const STATUS_CHIP_STYLES: Record<"all" | ReviewState, { base: string; active: string }> = {
  all: {
    base: "border-border/70 text-muted-foreground hover:border-foreground/40",
    active: "border-purple-500/60 bg-purple-500/15 text-purple-300",
  },
  reviewed: {
    base: "border-border/70 text-muted-foreground hover:border-emerald-500/40",
    active: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300",
  },
  "needs-review": {
    base: "border-border/70 text-muted-foreground hover:border-rose-500/40",
    active: "border-rose-500/60 bg-rose-500/15 text-rose-300",
  },
  excluded: {
    base: "border-border/70 text-muted-foreground hover:border-zinc-400/40",
    active: "border-zinc-400/60 bg-zinc-500/15 text-zinc-300",
  },
};

export const PROJECT_FAMILIES: Array<{
  id: string;
  label: string;
  description: string;
  projects: string[];
}> = [
  {
    id: "escape-the-dungeon",
    label: "Escape the Dungeon",
    description: "Roguelike dungeon crawler — primary project across all evolution rounds",
    projects: [
      "escape-the-dungeon",
      "escape-the-dungeon-bare",
      "escape-the-dungeon-emergent",
    ],
  },
  {
    id: "gad-explainer-video",
    label: "GAD Explainer Video",
    description: "Remotion composition — planned species for video generation workflows",
    projects: ["gad-explainer-video"],
  },
  {
    id: "skill-evaluation-app",
    label: "Skill Evaluation App",
    description: "Interactive requirements editor — planned species for tooling workflows",
    projects: ["skill-evaluation-app"],
  },
];

export const ROUND_OPTIONS = ["Evolution 1", "Evolution 2", "Evolution 3", "Evolution 4", "Evolution 5"] as const;

export function fmtTokensShort(t: number | null | undefined): string {
  if (t == null) return "\u2014";
  if (t >= 1000) return `${Math.round(t / 1000)}K`;
  return String(t);
}

export function fmtTokensLong(t: number | null | undefined): string {
  if (t == null) return "\u2014";
  return t.toLocaleString("en-US");
}

export function fmtDuration(m: number | null | undefined): string {
  if (m == null) return "\u2014";
  return `${m} min`;
}

export function fmtTimestamp(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function parseRoundFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const match = hash.match(/round=(\d+)/);
  if (match) return `Evolution ${match[1]}`;
  return null;
}
