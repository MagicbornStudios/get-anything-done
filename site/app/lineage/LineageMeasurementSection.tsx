import Link from "next/link";
import { GitBranch } from "lucide-react";

export function LineageMeasurementSection() {
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="mb-2 flex items-center gap-2">
          <GitBranch size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">What GAD adds</p>
        </div>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
          The measurement layer
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          GSD had the loop. RepoPlanner had the in-repo persistence. Both assumed their approaches
          worked &mdash; reasonably, based on author experience and developer intuition. GAD assumes
          nothing. The eval framework is the thing you can&apos;t find in either predecessor: a
          harness that runs the same task under different workflow conditions (GAD, bare, emergent),
          scores the output with both process metrics and human review, and publishes the results so
          cross-round comparisons are auditable.
        </p>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
          The{" "}
          <Link href="/findings/2026-04-08-round-3" className="text-accent hover:underline">
            freedom hypothesis
          </Link>{" "}
          is what this measurement layer is for. In round 3, the bare workflow (no framework, no
          skills, no CLI) produced a game that human reviewers rated higher than the GAD
          workflow&apos;s output. That&apos;s a result neither GSD nor RepoPlanner could surface,
          because neither had a way to test "does the framework actually help?" GAD forces us to
          confront the possibility that its own loop might be counterproductive on certain kinds of
          work &mdash; and then to redesign the experiment when the answer looks suspicious.
        </p>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
          If you&apos;re reading this page because you want to use a framework like this one: start
          with{" "}
          <a
            href="https://github.com/gsd-build/get-shit-done"
            className="text-accent hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Shit Done
          </a>{" "}
          if you want the simplest loop,{" "}
          <a
            href="https://repo-planner.vercel.app/"
            className="text-accent hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            RepoPlanner
          </a>{" "}
          if the in-repo persistence is what you care about, and{" "}
          <Link href="/gad" className="text-accent hover:underline">
            GAD
          </Link>{" "}
          if you want the planning loop <em>plus</em> the ability to measure whether it&apos;s
          helping you. None of these projects are in competition. They&apos;re three angles on the
          same problem.
        </p>
      </div>
    </section>
  );
}
