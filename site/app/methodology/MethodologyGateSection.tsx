import { Gauge } from "lucide-react";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function MethodologyGateSection() {
  return (
    <SiteSection>
      <SiteSectionHeading icon={Gauge} kicker="Gate logic" title="Gates override everything" />
      <SiteProse size="md" className="mt-3">
        Starting with requirements v2, some criteria are marked{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">gate=&quot;true&quot;</code>. If any
        gate fails,{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">requirement_coverage</code>{" "}
        collapses to 0. This is how a run that &quot;ticks most boxes&quot; can still score near zero on
        the mechanical dimension — because one gate (e.g. G1 game loop softlocks) makes the rest
        meaningless.
      </SiteProse>
      <SiteProse size="md" className="mt-4">
        v1 runs (pre-gates) show a{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">pre-gate requirements</code> badge
        on their per-run pages instead of a pass/fail because the concept didn&apos;t exist yet. v3
        introduced four explicit gates (game loop, spell crafting, UI quality); v4 added a fifth
        (pressure mechanics).
      </SiteProse>

      <h3 className="mt-12 text-xl font-semibold tracking-tight">Low-score caps (v3+)</h3>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Layered on top of the weighted sum to prevent a broken run from reaching respectable territory
        on time-efficiency alone.
      </p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">If weighted sum &lt;</th>
              <th className="px-5 py-3 font-medium">Capped to</th>
              <th className="px-5 py-3 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-5 py-3 font-mono tabular-nums">0.20</td>
              <td className="px-5 py-3 font-mono tabular-nums text-accent">0.40</td>
              <td className="px-5 py-3 text-muted-foreground">
                Prevent near-zero runs from being falsely rescued by time efficiency bonuses.
              </td>
            </tr>
            <tr className="bg-background/20">
              <td className="px-5 py-3 font-mono tabular-nums">0.10</td>
              <td className="px-5 py-3 font-mono tabular-nums text-accent">0.25</td>
              <td className="px-5 py-3 text-muted-foreground">
                Reserved for runs that barely produced anything. Still appears in the results set but
                clearly distinct from a mid-tier run.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SiteSection>
  );
}
