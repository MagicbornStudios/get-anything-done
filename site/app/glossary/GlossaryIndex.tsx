"use client";

import { useMemo, useState } from "react";
import type { GlossaryTerm } from "@/lib/eval-data";

type GlossaryIndexProps = {
  terms: GlossaryTerm[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function GlossaryIndex({ terms }: GlossaryIndexProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(terms.map((term) => term.category))).sort()],
    [terms],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    return terms.filter((term) => {
      if (category !== "all" && term.category !== category) return false;
      if (!q) return true;
      const haystack = [
        term.term,
        term.id,
        term.short,
        term.category,
        ...term.aliases,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [category, query, terms]);

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/30 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search terms, aliases, categories"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
            aria-label="Search glossary"
          />
          <div className="text-xs text-muted-foreground sm:min-w-fit">
            {filtered.length} of {terms.length} terms
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((value) => {
            const active = value === category;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={
                  active
                    ? "rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent"
                    : "rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
                }
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((term) => (
          <article
            key={term.id}
            id={term.id}
            className="rounded-2xl border border-border/60 bg-card/20 p-4 scroll-mt-24"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{term.term}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{term.short}</p>
              </div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{term.category}</div>
            </div>

            {term.aliases.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {term.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
