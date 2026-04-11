import { Badge } from "@/components/ui/badge";
import { GSD_UPSTREAM } from "@/components/landing/lineage/lineage-shared";

export function LineageCopy() {
  return (
    <div>
      <p className="section-kicker">Lineage</p>
      <h2 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
        Built on the GSD principles, built to be measured.
      </h2>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
        GAD is downstream of{" "}
        <a
          href={GSD_UPSTREAM}
          className="text-accent underline-offset-4 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Get Shit Done
        </a>
        — small loops, visible state, executable specs. The talk is the creator&apos;s
        perspective on why tight planning loops beat ad-hoc prompting alone. We took those
        principles, wrote the CLI to make them cheap, and then bolted on an eval harness so
        drift and regressions show up in benchmarks instead of vibes.
      </p>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        The video starts at the segment where the structured-planning argument lands.
        The full talk is worth watching if you&apos;ve ever wondered why your agent is
        confidently producing the wrong code.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Badge variant="outline">Originated by gsd-build</Badge>
        <Badge variant="outline">Adapted for measurement</Badge>
        <Badge variant="outline">Eval-first since v1.0</Badge>
      </div>
    </div>
  );
}
