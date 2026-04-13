import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { Ref } from "@/components/refs/Ref";

export function ContributeHeroSection() {
  return (
    <SiteSection>
      <Identified as="ContributeHeroSection">
      <SiteSectionHeading
        kicker="Contribute"
        as="h1"
        preset="hero"
        title={
          <>
            Clone, install, <span className="gradient-text">talk to the agent.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        GAD is forkable. Everything &mdash; planning state, eval results, decisions, the site itself
        &mdash; lives in the repo. To contribute an experiment or run your own eval, you don&apos;t
        need to learn the framework. You clone, install, and have a conversation with a coding agent
        that already has the GAD skills available.
      </SiteProse>
      <SiteProse size="sm" className="mt-4">
        Anchor decision: <Ref id="gad-77" /> &mdash; contribution flow is human-first.{" "}
        <Ref id="gad-74" /> &mdash; the value of GAD is task management at scale, not faster software
        shipping.
      </SiteProse>

      <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-amber-100">
          <AlertTriangle size={14} aria-hidden />
          <strong>Fresh-clone test still open</strong>
        </div>
        <p className="text-xs leading-5 text-amber-200">
          We have not yet verified the contribution flow on a clean clone in a new repo. The
          instructions below describe what <em>should</em> work; if you hit a missing piece (settings,
          hooks, env vars), open an issue and tag it{" "}
          <Link
            href="/questions#fresh-clone-contribution-test"
            className="text-amber-100 underline decoration-dotted"
          >
            fresh-clone-contribution-test
          </Link>
          .
        </p>
      </div>
      </Identified>
    </SiteSection>
  );
}
