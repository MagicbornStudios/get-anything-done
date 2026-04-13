import { ShieldQuestion } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { REPO } from "./skeptic-shared";

export default function SkepticHero() {
  return (
    <SiteSection>
      <Identified as="SkepticHeroHeading" register={false}>
        <SiteSectionHeading
        icon={ShieldQuestion}
        kicker="Skeptic"
        iconClassName="text-rose-400"
        kickerRowClassName="mb-6 gap-2"
        as="h1"
        preset="hero"
        title={
          <>
            Every claim we&apos;ve made,{" "}
            <span className="gradient-text">held to its strongest critique.</span>
          </>
        }
        />
      </Identified>
      <Identified as="SkepticHeroProsePrimary">
        <SiteProse className="mt-6">
        Research that doesn&apos;t critique itself isn&apos;t research. This page is the public
        commitment to taking our own claims apart. For every hypothesis the project has named &mdash;
        freedom, compound-skills, emergent-evolution, pressure, GAD&apos;s value prop &mdash; we
        state the steelman, then the strongest available critique, then the alternatives, then what
        would falsify it. Then we list concrete moves that would make us more credible.
        </SiteProse>
      </Identified>
      <Identified as="SkepticHeroProseSource">
        <SiteProse size="sm" className="mt-4">
        Source:{" "}
        <a
          href={`${REPO}/blob/main/.planning/docs/SKEPTIC.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-dotted"
        >
          .planning/docs/SKEPTIC.md
        </a>
        . This document gets updated as the critique deepens, not as the hypotheses get more
        confident.
        </SiteProse>
      </Identified>

      <Identified as="SkepticHeroThesisCallout" className="mt-8 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm leading-6 text-rose-200">
        <strong className="text-rose-100">The thesis of this page:</strong> confidence in
        early-stage research is the most dangerous failure mode. We have N=2-5 runs per condition
        across a single task domain with one human reviewer. Anything we&apos;ve claimed about
        &quot;monotonic improvement&quot; or &quot;hypothesis confirmed&quot; is premature. The right
        word for what we&apos;re doing is <em>exploratory analysis</em>, not <em>hypothesis testing</em>
        .
      </Identified>
    </SiteSection>
  );
}
