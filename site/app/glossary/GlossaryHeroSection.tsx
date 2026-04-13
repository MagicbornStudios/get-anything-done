import Link from "next/link";
import { GLOSSARY, GLOSSARY_UPDATED, type GlossaryTerm } from "@/lib/eval-data";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { GlossaryCategoryJumpNav } from "./GlossaryCategoryJumpNav";

type GlossaryHeroSectionProps = {
  orderedCategories: string[];
  grouped: Record<string, GlossaryTerm[]>;
};

export function GlossaryHeroSection({ orderedCategories, grouped }: GlossaryHeroSectionProps) {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Glossary"
        as="h1"
        preset="hero"
        title={
          <>
            Every term, one place. <span className="gradient-text">No more googling our jargon.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        We use a lot of project-specific language — CSH, freedom hypothesis, gate criterion, rubric, trace schema v4,
        emergent workflow. This page is the authoritative definition for every term, grouped by category. Any underlined
        dotted term elsewhere on the site links back here.
      </SiteProse>
      <SiteProse size="sm" className="mt-4">
        Source: <code className="rounded bg-card/60 px-1 py-0.5 text-xs">data/glossary.json</code>
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
          <span className="text-2xl font-semibold tabular-nums text-foreground">{GLOSSARY.length}</span> terms
        </div>
        <div>
          <span className="text-2xl font-semibold tabular-nums text-foreground">{orderedCategories.length}</span>{" "}
          categories
        </div>
      </div>

      <GlossaryCategoryJumpNav orderedCategories={orderedCategories} grouped={grouped} />
    </SiteSection>
  );
}
