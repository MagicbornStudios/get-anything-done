import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarketingShell, SiteInlineMetric, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { GLOSSARY, GLOSSARY_UPDATED } from "@/lib/eval-data";
import { GlossaryCategoryJumpNav } from "./GlossaryCategoryJumpNav";
import { GlossaryTermCard } from "./GlossaryTermCard";
import {
  GLOSSARY_CATEGORY_ORDER,
  groupGlossaryByCategory,
} from "./glossary-shared";

export const metadata = {
  title: "Glossary — GAD",
  description:
    "Every domain term used on this site. Compound-Skills Hypothesis, freedom hypothesis, emergent workflow, gate criterion, rubric, trace schema v4, and more.",
};

export default function GlossaryPage() {
  const grouped = groupGlossaryByCategory(GLOSSARY);
  const orderedCategories = GLOSSARY_CATEGORY_ORDER.filter((c) => grouped[c]?.length > 0);

  return (
    <MarketingShell>
      <SiteSection>
        <SiteSectionHeading
          kicker="Glossary"
          as="h1"
          preset="hero"
          title={
            <>
              Every term, one place.{" "}
              <span className="gradient-text">No more googling our jargon.</span>
            </>
          }
        />
        <SiteProse className="mt-6">
          We use a lot of project-specific language — CSH, freedom hypothesis, gate criterion, rubric,
          trace schema v4, emergent workflow. This page is the authoritative definition for every term,
          grouped by category. Any underlined dotted term elsewhere on the site links back here.
        </SiteProse>
        <SiteProse size="sm" className="mt-4">
          Source:{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-xs">data/glossary.json</code>
          {GLOSSARY_UPDATED && (
            <>
              {" · last updated "}
              <span className="tabular-nums">{GLOSSARY_UPDATED}</span>
            </>
          )}
          {" · "}
          <Link href="/questions" className="text-accent underline decoration-dotted">
            see open questions
          </Link>
        </SiteProse>

        <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{GLOSSARY.length}</span>{" "}
            terms
          </div>
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {orderedCategories.length}
            </span>{" "}
            categories
          </div>
        </div>

        <GlossaryCategoryJumpNav orderedCategories={orderedCategories} grouped={grouped} />
      </SiteSection>

      {orderedCategories.map((cat) => (
        <SiteSection
          key={cat}
          id={`category-${cat}`}
          tone="muted"
          className="last:border-b-0 last:bg-background"
        >
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <SiteSectionHeading
              icon={BookOpen}
              kicker={cat.replace(/-/g, " ")}
              kickerRowClassName="mb-0 flex-1 gap-3 capitalize"
              className="min-w-0 flex-1"
            />
            <Badge variant="outline" className="shrink-0">
              {grouped[cat].length}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {grouped[cat].map((t) => (
              <GlossaryTermCard key={t.id} term={t} />
            ))}
          </div>
        </SiteSection>
      ))}

      {GLOSSARY.length === 0 && (
        <SiteSection>
          <SiteProse size="sm">
            No glossary terms yet. Add entries to <code>data/glossary.json</code> and re-run prebuild.
          </SiteProse>
        </SiteSection>
      )}
    </MarketingShell>
  );
}
