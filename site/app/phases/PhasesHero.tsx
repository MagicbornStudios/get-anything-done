import Link from "next/link";
import { ALL_TASKS } from "@/lib/eval-data";
import type { PhaseRecord } from "@/lib/eval-data";
import { PhasesStat } from "@/app/phases/PhasesStat";

export function PhasesHero({ phases }: { phases: PhaseRecord[] }) {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Phases</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          The project, in phases. <span className="gradient-text">One milestone at a time.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          Phases are the unit of project work in GAD — each one defines a goal, a set of tasks, and
          an expected outcome. This page renders every phase in{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-sm">.planning/ROADMAP.xml</code> with
          its task list and status. Distinct from{" "}
          <Link href="/roadmap" className="text-accent underline decoration-dotted">
            /roadmap
          </Link>{" "}
          which tracks eval rounds.
        </p>

        <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
          <PhasesStat label="Phases" value={phases.length.toString()} />
          <PhasesStat label="Tasks" value={ALL_TASKS.length.toString()} />
        </div>
      </div>
    </section>
  );
}
