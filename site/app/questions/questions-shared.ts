import type { OpenQuestion } from "@/lib/eval-data";

export const CATEGORY_TINT: Record<string, string> = {
  hypothesis: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  evaluation: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  site: "bg-purple-500/15 text-purple-300 border-purple-500/40",
  framework: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  tooling: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  "game-design": "bg-pink-500/15 text-pink-300 border-pink-500/40",
};

export const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const STATUS_TINT: Record<string, "success" | "default" | "outline"> = {
  open: "default",
  discussing: "outline",
  resolved: "success",
};

export function groupByCategory(questions: OpenQuestion[]) {
  const groups: Record<string, OpenQuestion[]> = {};
  for (const q of questions) {
    (groups[q.category] ??= []).push(q);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort(
      (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    );
  }
  return groups;
}
