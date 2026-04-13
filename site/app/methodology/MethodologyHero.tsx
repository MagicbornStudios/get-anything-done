import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function MethodologyHero() {
  return (
    <SiteSection>
      <Identified as="MethodologyHeroHeading">
        <SiteSectionHeading
          kicker="Methodology"
          as="h1"
          preset="hero"
          title={
            <>
              Every formula, <span className="gradient-text">every weight,</span> every cap.
            </>
          }
        />
      </Identified>
      <Identified as="MethodologyHeroProse">
        <SiteProse className="mt-6">
          This page is the appendix. Every number on the site — every bar, every composite, every
          &quot;gate passed&quot; badge — traces back to one of the formulas below. If you want to verify a
          run yourself, pull its{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TRACE.json</code> from GitHub and
          run the math from here.
        </SiteProse>
      </Identified>
    </SiteSection>
  );
}
