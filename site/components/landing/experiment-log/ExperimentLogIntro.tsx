"use client";

import { SiteSectionIntro } from "@/components/site";

export function ExperimentLogIntro() {
  return (
    <SiteSectionIntro
      kicker="Experiment log"
      preset="hero-compact"
      title={
        <>
          Round by round. <span className="gradient-text">What we asked.</span> What the agents
          actually shipped.
        </>
      }
    >
      The experiment log is append-only. Each entry captures the requirements version, the
      workflow conditions that ran, the scores, and the key finding that drove the next
      round&apos;s changes.
    </SiteSectionIntro>
  );
}
