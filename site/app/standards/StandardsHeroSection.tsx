import { Ref } from "@/components/refs/Ref";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export default function StandardsHeroSection() {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Standards"
        as="h1"
        preset="hero"
        title={
          <>
            Two canonical references. <span className="gradient-text">Cited on every skill page.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        GAD is a research framework, not a new skill format. The way we author skills, evaluate them,
        and load them into agents follows two open references that already exist. This page is the
        single canonical citation point — every other skill-related page on the site links here rather
        than repeating the standards inline.
      </SiteProse>
      <SiteProse size="sm" className="mt-4">
        Anchor decisions: <Ref id="gad-70" /> (Anthropic guide as canonical reference),{" "}
        <Ref id="gad-80" /> (agentskills.io adoption +{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 text-xs">skills/</code> convention),{" "}
        <Ref id="gad-81" /> (skill-count policy derived from both sources).
      </SiteProse>
    </SiteSection>
  );
}
