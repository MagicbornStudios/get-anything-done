import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function LineagePageHero() {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Lineage"
        as="h1"
        preset="hero"
        title={
          <>
            GAD didn&apos;t invent this. <span className="gradient-text">It builds on two approaches.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        The problem every agent-driven development framework is trying to solve is the same one:{" "}
        <strong className="text-foreground">context rot</strong>. As a coding session runs longer,
        the agent&apos;s working memory drifts. What it decided an hour ago gets contradicted.
        Decisions resurface as new questions. Half-finished work becomes invisible because it&apos;s
        buried under the next concern. Eventually the agent is confidently producing inconsistent
        code against requirements it no longer remembers.
      </SiteProse>
      <SiteProse className="mt-4">
        Two earlier projects tried to fix this before GAD. Both are load-bearing in how GAD thinks
        about the loop, and GAD is &mdash; honestly &mdash; mostly a combination of their ideas plus
        a measurement layer stapled on.
      </SiteProse>
    </SiteSection>
  );
}
