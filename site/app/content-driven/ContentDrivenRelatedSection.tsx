import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteSection, SiteSectionHeading } from "@/components/site";

const linkClass =
  "h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1.5 font-semibold hover:border-accent hover:text-accent [&_svg]:size-3";

export function ContentDrivenRelatedSection() {
  return (
    <SiteSection>
      <SiteSectionHeading kicker="Related" className="mb-4" />
      <div className="flex flex-wrap gap-3 text-sm">
        <Button variant="outline" size="sm" className={linkClass} asChild>
          <Link href="/hypotheses">
            All hypotheses
            <ArrowRight size={12} aria-hidden />
          </Link>
        </Button>
        <Button variant="outline" size="sm" className={linkClass} asChild>
          <Link href="/freedom">
            Freedom Hypothesis
            <ArrowRight size={12} aria-hidden />
          </Link>
        </Button>
        <Button variant="outline" size="sm" className={linkClass} asChild>
          <Link href="/emergent">
            Compound-Skills Hypothesis
            <ArrowRight size={12} aria-hidden />
          </Link>
        </Button>
        <Button variant="outline" size="sm" className={linkClass} asChild>
          <Link href="/methodology#content-pack-injection-baseline">
            Resolved open question
            <ArrowRight size={12} aria-hidden />
          </Link>
        </Button>
      </div>
    </SiteSection>
  );
}
