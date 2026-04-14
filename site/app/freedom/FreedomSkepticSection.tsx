import Link from "next/link";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function FreedomSkepticSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading kicker="Why this is a preliminary observation, not a finding" className="mb-6" />
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm leading-6 text-muted-foreground">
        <p className="mb-3 font-semibold text-rose-200">
          Skeptic note (read{" "}
          <Link href="/skeptic#freedom" className="underline">
            /skeptic
          </Link>{" "}
          for the full critique):
        </p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
            <span>
              N=5 is not a curve. The &quot;monotonic improvement&quot; is exactly the kind of pattern
              random noise produces about 1 in 16 times by chance.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
            <span>
              Each bare version targets a harder requirements set. The score improvement may be
              &quot;requirements got clearer&quot; rather than &quot;bare is better than GAD.&quot;
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
            <span>
              Bare and GAD use different AGENTS.md prompts. The &quot;framework&quot; variable is conflated
              with the &quot;system prompt&quot; variable.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
            <span>
              GAD&apos;s design assumes multi-session work; single-shot game implementation is
              not its strength case. We may be testing GAD against the wrong benchmark.
            </span>
          </li>
        </ul>
      </div>
      <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
        What would falsify the freedom hypothesis: a round where bare produces a worse game than GAD on the
        same requirements with N ≥ 3 replicates per condition, OR a different task domain where GAD beats
        bare. Neither has been run.
      </p>
    </SiteSection>
  );
}
