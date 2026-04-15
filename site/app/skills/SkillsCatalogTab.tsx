"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Identified } from "@/components/devid/Identified";
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
    <Identified as="SkillsCatalogTabRoot" cid="skills-catalog-tab-root" className="block">
      <Identified as="SkillsCatalogControls" cid="skills-catalog-controls" className="mb-5 flex flex-wrap items-center gap-3">
        <SkillsSearchField
          value={query}
          onChange={setQuery}
          placeholder="Search skills..."
        />
        <Identified as="SkillsCatalogCategoryPills" cid="skills-catalog-category-pills" className="flex flex-wrap items-center gap-1.5">
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
        </Identified>
      </Identified>

      <Identified
        as="SkillsCatalogControlsAgentRefs"
        cid="skills-catalog-controls-agent-refs"
        className="mb-4 rounded-md border border-border/50 bg-card/30 px-3 py-2 text-[11px] text-muted-foreground"
      >
        <p className="font-semibold uppercase tracking-wide text-[10px] text-foreground/80">
          Agent Handoff Reference
        </p>
        <p className="mt-1">
          Landmarks: <code className="rounded bg-background/70 px-1">cid=&quot;skills-catalog-controls&quot;</code>,{" "}
          <code className="rounded bg-background/70 px-1">cid=&quot;skills-catalog-grid&quot;</code>,{" "}
          <code className="rounded bg-background/70 px-1">cid=&quot;skills-catalog-card-first&quot;</code>.
        </p>
        <p className="mt-1">
          Site ref:{" "}
          <Link href="/standards" className="text-accent underline decoration-dotted">
            /standards
          </Link>{" "}
          · Code ref:{" "}
          <code className="rounded bg-background/70 px-1">site/app/skills/SkillsCatalogTab.tsx</code>{" "}
          + <code className="rounded bg-background/70 px-1">site/app/skills/SkillsCatalogCard.tsx</code>
        </p>
        <p className="mt-1">
          Quick prompt: “Edit <code className="rounded bg-background/70 px-1">cid=&quot;skills-catalog-controls&quot;</code>{" "}
          and children. Keep Identified <code className="rounded bg-background/70 px-1">as</code>/<code className="rounded bg-background/70 px-1">cid</code>{" "}
          stable, update first-card anchor, and include both site+code references.”
        </p>
      </Identified>

      {filtered.length === 0 ? (
        <Identified as="SkillsCatalogEmptyState" cid="skills-catalog-empty-state" className="text-sm text-muted-foreground">
          No skills match.
        </Identified>
      ) : (
        <Identified as="SkillsCatalogGrid" cid="skills-catalog-grid" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s, index) => (
            <SkillsCatalogCard key={s.id} skill={s} index={index} />
          ))}
        </Identified>
      )}
    </Identified>
  );
}
