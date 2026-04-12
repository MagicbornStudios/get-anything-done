import type { GlossaryTerm } from "@/lib/eval-data";

export const GLOSSARY_CATEGORY_TINT: Record<string, string> = {
  hypothesis: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  workflow: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  evaluation: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  framework: "bg-purple-500/15 text-purple-300 border-purple-500/40",
  "game-design": "bg-pink-500/15 text-pink-300 border-pink-500/40",
  process: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  infra: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

export const GLOSSARY_CATEGORY_ORDER = [
  "hypothesis",
  "workflow",
  "evaluation",
  "framework",
  "game-design",
  "process",
  "infra",
] as const;

export function groupGlossaryByCategory(terms: GlossaryTerm[]) {
  const groups: Record<string, GlossaryTerm[]> = {};
  for (const t of terms) {
    (groups[t.category] ??= []).push(t);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => a.term.localeCompare(b.term));
  }
  return groups;
}
