import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function FeatureRequestsHeroSection() {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Feature requests"
        as="h1"
        preset="hero"
        title={
          <>
            What we need from others. <span className="gradient-text">Tracked in public.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        GAD depends on features from external tools — Claude Code, Codex, the agentskills.io ecosystem. When we hit
        a blocker, we submit a feature request and track it here so our community can see what we&apos;re waiting on,
        what workarounds exist, and how it affects the research.
      </SiteProse>
    </SiteSection>
  );
}
