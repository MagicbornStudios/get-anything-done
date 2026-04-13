import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GlossaryTerm } from "@/lib/eval-data";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { GlossaryTermCard } from "./GlossaryTermCard";

type GlossaryCategorySectionProps = {
  cat: string;
  terms: GlossaryTerm[];
};

export function GlossaryCategorySection({ cat, terms }: GlossaryCategorySectionProps) {
  return (
    <SiteSection id={`category-${cat}`} tone="muted" className="last:border-b-0 last:bg-background">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SiteSectionHeading
          icon={BookOpen}
          kicker={cat.replace(/-/g, " ")}
          kickerRowClassName="mb-0 flex-1 gap-3 capitalize"
          className="min-w-0 flex-1"
        />
        <Badge variant="outline" className="shrink-0">
          {terms.length}
        </Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {terms.map((t) => (
          <GlossaryTermCard key={t.id} term={t} />
        ))}
      </div>
    </SiteSection>
  );
}
