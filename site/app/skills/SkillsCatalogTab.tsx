"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SkillsCatalogCard } from "./SkillsCatalogCard";
import { SkillsSearchField } from "./SkillsSearchField";
import { CATEGORY_LABEL, SKILL_CATEGORIES, type SkillSummaryDTO } from "./skills-page-types";
import { cn } from "@/lib/utils";

export function SkillsCatalogTab({ summaries }: { summaries: SkillSummaryDTO[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    return summaries.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    });
  }, [summaries, query, category]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SkillsSearchField
          value={query}
          onChange={setQuery}
          placeholder="Search skills…"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {SKILL_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={category === cat ? "default" : "outline"}
              className={cn(
                "h-auto rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
                category === cat && "shadow-sm",
              )}
              onClick={() => setCategory(cat)}
            >
              {cat === "all" ? "All" : CATEGORY_LABEL[cat]}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skills match.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SkillsCatalogCard key={s.id} skill={s} />
          ))}
        </div>
      )}
    </div>
  );
}
