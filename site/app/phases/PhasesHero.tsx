import Link from "next/link";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { ALL_TASKS } from "@/lib/eval-data";
import type { PhaseRecord } from "@/lib/eval-data";
import { PhasesStat } from "@/app/phases/PhasesStat";

export function PhasesHero({ phases }: { phases: PhaseRecord[] }) {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Phases"
        as="h1"
        preset="hero"
        title={
          <>
            The project, in phases. <span className="gradient-text">One milestone at a time.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        Phases are the unit of project work in GAD — each one defines a goal, a set of tasks, and an
        expected outcome. This page renders every phase in{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 text-sm">.planning/ROADMAP.xml</code> with its
        task list and status. Distinct from{" "}
        <Link href="/roadmap" className="text-accent underline decoration-dotted">
          /roadmap
        </Link>{" "}
        which tracks eval rounds.
      </SiteProse>

      <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <PhasesStat label="Phases" value={phases.length.toString()} />
        <PhasesStat label="Tasks" value={ALL_TASKS.length.toString()} />
      </div>
    </SiteSection>
  );
}
