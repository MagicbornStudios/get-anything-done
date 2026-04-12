"use client";

import { Button } from "@/components/ui/button";
import { SiteProse, SiteSectionHeading } from "@/components/site";

export function PlayableIntro() {
  return (
    <>
      <SiteSectionHeading
        kicker="Playable archive"
        preset="hero-compact"
        title={
          <>
            Every build we scored. <span className="gradient-text">Playable in your browser.</span>
          </>
        }
      />
      <SiteProse className="mt-5">
        These are the exact production builds the human reviewers scored — no rebuilds, no tweaks.
        Click a round on the{" "}
        <Button variant="link" className="h-auto p-0 text-lg font-normal text-accent" asChild>
          <a href="#tracks">hypothesis chart above</a>
        </Button>{" "}
        to filter, or use the controls below to search and filter. Hover any build badge for
        details.
      </SiteProse>
    </>
  );
}
