"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { SEARCH_INDEX, type SearchEntry } from "@/lib/eval-data";

const KIND_LABEL: Record<SearchEntry["kind"], string> = {
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

const KIND_TINT: Record<SearchEntry["kind"], string> = {
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

const KIND_ORDER: SearchEntry["kind"][] = [
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
  // Exact id match wins big
  if (id === q) return 1000;
  // Id prefix
  if (id.startsWith(q)) return 500;
  // Title starts with query
  if (title.startsWith(q)) return 300;
  // Id or title contains query
  if (id.includes(q)) return 200;
  if (title.includes(q)) return 150;
  // Body contains query (already lowercased at prebuild)
  if (entry.body.includes(q)) return 50;
  return 0;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Open with cmd-k / ctrl-k. Close with escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus the input when the modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return null;
    const scored = SEARCH_INDEX.map((e) => ({ entry: e, s: score(e, query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_TOTAL_RESULTS);

    const byKind: Record<string, SearchEntry[]> = {};
    for (const r of scored) {
      const k = r.entry.kind;
      if (!byKind[k]) byKind[k] = [];
      if (byKind[k].length < MAX_RESULTS_PER_KIND) {
        byKind[k].push(r.entry);
      }
    }
    return byKind;
  }, [query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Search (Ctrl+K)"
        aria-label="Open search"
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
      >
        <Search size={13} aria-hidden />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-background/80 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Global search"
        >
          <div
            className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
              <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search decisions, tasks, glossary, bugs, skills..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border/60 p-1 text-muted-foreground hover:border-accent hover:text-accent"
                aria-label="Close search"
              >
                <X size={12} aria-hidden />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {!query.trim() && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <p className="mb-2">Type to search.</p>
                  <p className="text-xs">
                    Try{" "}
                    <code className="rounded bg-card/60 px-1 py-0.5">gad-68</code>,{" "}
                    <code className="rounded bg-card/60 px-1 py-0.5">pressure</code>,{" "}
                    <code className="rounded bg-card/60 px-1 py-0.5">CSH</code>, or{" "}
                    <code className="rounded bg-card/60 px-1 py-0.5">forge</code>.
                  </p>
                </div>
              )}

              {results && Object.keys(results).length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No results for &quot;{query}&quot;.
                </div>
              )}

              {results && Object.keys(results).length > 0 && (
                <div>
                  {KIND_ORDER.filter((k) => results[k]?.length > 0).map((kind) => (
                    <div key={kind} className="border-b border-border/40 last:border-b-0">
                      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {KIND_LABEL[kind]} ({results[kind].length})
                      </div>
                      {results[kind].map((entry) => (
                        <Link
                          key={`${entry.kind}-${entry.id}`}
                          href={entry.href}
                          onClick={() => setOpen(false)}
                          className="flex items-start gap-3 border-t border-border/30 px-4 py-3 transition-colors first:border-t-0 hover:bg-card/40"
                        >
                          <span
                            className={`mt-0.5 inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-mono text-[10px] ${KIND_TINT[entry.kind]}`}
                          >
                            {entry.id}
                          </span>
                          <span className="text-sm text-foreground">{entry.title}</span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/60 bg-card/30 px-4 py-2 text-[10px] text-muted-foreground">
              <kbd className="rounded border border-border/60 bg-background/60 px-1 py-0.5 font-mono">
                ↵
              </kbd>{" "}
              to open ·{" "}
              <kbd className="rounded border border-border/60 bg-background/60 px-1 py-0.5 font-mono">
                esc
              </kbd>{" "}
              to close · {SEARCH_INDEX.length} entries indexed
            </div>
          </div>
        </div>
      )}
    </>
  );
}
