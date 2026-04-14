import { SiteSectionIntro } from "@/components/site";

export function WorkflowIntro() {
  return (
    <SiteSectionIntro
      kicker="The loop"
      preset="hero-compact"
      title={
        <>
          Five steps. <span className="gradient-text">Every session.</span> No variation.
        </>
      }
    >
      snapshot → pick one task → implement → update planning docs → commit. The CLI gives the
      agent a single command to re-hydrate context; skills tell the agent what methodology to
      apply; subagents do the expensive work off the main thread. That&apos;s the whole
      framework.
    </SiteSectionIntro>
  );
}

