"use client";

import { Store } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function ProjectMarketHeader() {
  return (
    <SiteSection cid="project-market-header-site-section"
      tone="muted"
      className="border-t-0"
      shellClassName="pb-8 pt-24 md:pb-12 md:pt-32"
    >
      <Identified as="ProjectMarketHeader">
      <SiteSectionHeading
        icon={Store}
        kicker="Project market"
        kickerRowClassName="gap-2"
        as="h1"
        preset="hero-compact"
        titleClassName="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl"
        title={
          <>
            Every species. <span className="gradient-text">Playable in your browser.</span>
          </>
        }
      />
      <SiteProse className="mt-5 max-w-2xl">
        Browse the full catalog of species across games, video, software, and tooling. Each
        species is an evolutionary branch of a project that tests a hypothesis about how coding
        agents build under different conditions.
      </SiteProse>
      </Identified>
    </SiteSection>
  );
}

