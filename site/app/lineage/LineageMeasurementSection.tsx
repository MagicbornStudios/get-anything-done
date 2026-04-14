import Link from "next/link";
import { GitBranch } from "lucide-react";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function LineageMeasurementSection() {
  return (
    <SiteSection cid="lineage-measurement-section-site-section" tone="muted">
      <SiteSectionHeading
        icon={GitBranch}
        kicker="What GAD adds"
        title="The measurement layer"
      />
      <SiteProse className="mt-5">
        GSD had the loop. RepoPlanner had the in-repo persistence. Both assumed their approaches
        worked &mdash; reasonably, based on author experience and developer intuition. GAD assumes
        nothing. The eval framework is the thing you can&apos;t find in either predecessor: a
        harness that runs the same task under different workflow conditions (GAD, bare, emergent),
        scores the output with both process metrics and human review, and publishes the results so
        cross-round comparisons are auditable.
      </SiteProse>
      <SiteProse className="mt-4">
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
      </SiteProse>
      <SiteProse className="mt-4">
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
      </SiteProse>
    </SiteSection>
  );
}

