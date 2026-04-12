"use client";

import { SiteProse, SiteSectionHeading } from "@/components/site";

export function ExperimentLogIntro() {
  return (
    <>
      <SiteSectionHeading
        kicker="Experiment log"
        preset="hero-compact"
        title={
          <>
            Round by round. <span className="gradient-text">What we asked.</span> What the agents
            actually shipped.
          </>
        }
      />
      <SiteProse className="mt-5">
        The experiment log is append-only. Each entry captures the requirements version, the
        workflow conditions that ran, the scores, and the key finding that drove the next
        round&apos;s changes.
      </SiteProse>
    </>
  );
}
