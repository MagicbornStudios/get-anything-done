import { SEARCH_INDEX, type SearchEntry } from "@/lib/eval-data";

export const KIND_LABEL: Record<SearchEntry["kind"], string> = {
  decision: "Decision",
  task: "Task",
  phase: "Phase",
  glossary: "Glossary",
  question: "Question",
  bug: "Bug",
  skill: "Skill",
  agent: "Agent",
  command: "Command",
};

export const KIND_TINT: Record<SearchEntry["kind"], string> = {
  decision: "border-accent/40 bg-accent/10 text-accent",
  task: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  phase: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  glossary: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  question: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  bug: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  skill: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  agent: "border-pink-500/40 bg-pink-500/10 text-pink-300",
  command: "border-orange-500/40 bg-orange-500/10 text-orange-300",
};

export const KIND_ORDER: SearchEntry["kind"][] = [
  "decision",
  "task",
  "phase",
  "glossary",
  "question",
  "bug",
  "skill",
  "agent",
  "command",
];

const MAX_RESULTS_PER_KIND = 6;
const MAX_TOTAL_RESULTS = 50;

function score(entry: SearchEntry, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const id = entry.id.toLowerCase();
  const title = entry.title.toLowerCase();
  if (id === q) return 1000;
  if (id.startsWith(q)) return 500;
  if (title.startsWith(q)) return 300;
  if (id.includes(q)) return 200;
  if (title.includes(q)) return 150;
  if (entry.body.includes(q)) return 50;
  return 0;
}

export type SearchResultsByKind = Partial<Record<SearchEntry["kind"], SearchEntry[]>>;

/** `null` when the query is empty (caller should show the idle hint). */
export function groupSearchResults(query: string): SearchResultsByKind | null {
  if (!query.trim()) return null;
  const scored = SEARCH_INDEX.map((e) => ({ entry: e, s: score(e, query) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_TOTAL_RESULTS);

  const byKind: SearchResultsByKind = {};
  for (const r of scored) {
    const k = r.entry.kind;
    if (!byKind[k]) byKind[k] = [];
    if (byKind[k]!.length < MAX_RESULTS_PER_KIND) {
      byKind[k]!.push(r.entry);
    }
  }
  return byKind;
}

export function searchIndexSize(): number {
  return SEARCH_INDEX.length;
}
