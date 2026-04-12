import { SiteProse, SiteSectionHeading } from "@/components/site";

export function WorkflowIntro() {
  return (
    <>
      <SiteSectionHeading
        kicker="The loop"
        preset="hero-compact"
        title={
          <>
            Five steps. <span className="gradient-text">Every session.</span> No variation.
          </>
        }
      />
      <SiteProse className="mt-5">
        snapshot → pick one task → implement → update planning docs → commit. The CLI gives the
        agent a single command to re-hydrate context; skills tell the agent what methodology to
        apply; subagents do the expensive work off the main thread. That&apos;s the whole
        framework.
      </SiteProse>
    </>
  );
}
