import { Badge } from "@/components/ui/badge";
import { GSD_UPSTREAM } from "@/components/landing/lineage/lineage-shared";
import { SiteProse, SiteSectionIntro } from "@/components/site";

export function LineageCopy() {
  return (
    <div>
      <SiteSectionIntro
        kicker="Lineage"
        preset="hero-compact"
        titleClassName="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl"
        title="Built on the GSD principles, built to be measured."
        proseClassName="max-w-2xl"
      >
        GAD is downstream of{" "}
        <a
          href={GSD_UPSTREAM}
          className="text-accent underline-offset-4 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Get Shit Done
        </a>
        — small loops, visible state, executable specs. The talk is the creator&apos;s perspective
        on why tight planning loops beat ad-hoc prompting alone. We took those principles, wrote
        the CLI to make them cheap, and then bolted on an eval harness so drift and regressions show
        up in benchmarks instead of vibes.
      </SiteSectionIntro>
      <SiteProse size="md" className="mt-4 max-w-2xl">
        The video starts at the segment where the structured-planning argument lands. The full talk
        is worth watching if you&apos;ve ever wondered why your agent is confidently producing the
        wrong code.
      </SiteProse>
      <div className="mt-8 flex flex-wrap gap-3">
        <Badge variant="outline">Originated by gsd-build</Badge>
        <Badge variant="outline">Adapted for measurement</Badge>
        <Badge variant="outline">Eval-first since v1.0</Badge>
      </div>
    </div>
  );
}

