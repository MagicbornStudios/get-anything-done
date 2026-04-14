import { CRITIQUES } from "./skeptic-shared";
import { Identified } from "@/components/devid/Identified";
import { PageIdentified } from "@/components/devid/PageIdentified";
import { MarketingShell, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import SkepticHypothesisPaginatedSection from "./SkepticHypothesisPaginatedSection";

export const metadata = {
  title: "Skeptic — devils-advocate critique of every hypothesis",
  description:
    "Every hypothesis we've claimed, held to its strongest critique. The credibility move is admitting what we don't know. Source: .planning/docs/SKEPTIC.md.",
};

export default function SkepticPage() {
  return (
    <MarketingShell>
      <SiteSection cid="skeptic-hypotheses-site-section">
        <Identified as="HypothesesPageIntro">
          <SiteSectionHeading
            kicker="Hypotheses"
            as="h2"
            title={
              <>
                Every research hypothesis, <span className="gradient-text">wired to its eval track.</span>
              </>
            }
          />
          <SiteProse className="mt-6">
            This framing block now lives here: each hypothesis is tied to an eval track, then
            pressure-tested through the strongest critique before any claim is treated as credible.
          </SiteProse>
          <SiteProse size="sm" className="mt-4">
            Labels: <strong className="text-foreground">preliminary observation</strong> means we have
            seen a pattern and named it, but sample size is too small to call it a finding.{" "}
            <strong className="text-foreground">discussing</strong> means we are still working out what
            the hypothesis even claims.{" "}
            <strong className="text-foreground">operationalized</strong> means it has a concrete
            computable definition. <strong className="text-foreground">not yet tested</strong> means no
            runs have produced data against it.
          </SiteProse>
        </Identified>
      </SiteSection>
      <PageIdentified as="SkepticHypothesisPaginatedSection">
        <SkepticHypothesisPaginatedSection critiques={CRITIQUES} />
      </PageIdentified>
    </MarketingShell>
  );
}

