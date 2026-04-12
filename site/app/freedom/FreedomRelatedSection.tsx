import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function FreedomRelatedSection() {
  return (
    <SiteSection>
      <SiteSectionHeading kicker="Related" className="mb-4" />
      <div className="flex flex-wrap gap-3 text-sm">
        <Button
          variant="outline"
          size="sm"
          className="h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1.5 font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
          asChild
        >
          <Link href="/hypotheses">
            All hypotheses
            <ArrowRight size={12} aria-hidden />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1.5 font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
          asChild
        >
          <Link href="/emergent">
            Compound-Skills Hypothesis (/emergent)
            <ArrowRight size={12} aria-hidden />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1.5 font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
          asChild
        >
          <Link href="/content-driven">
            Content-driven (planned)
            <ArrowRight size={12} aria-hidden />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1.5 font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
          asChild
        >
          <Link href="/projects/escape-the-dungeon-bare">
            escape-the-dungeon-bare project
            <ArrowRight size={12} aria-hidden />
          </Link>
        </Button>
      </div>
    </SiteSection>
  );
}
