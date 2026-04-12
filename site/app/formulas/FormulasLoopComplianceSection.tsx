import { SiteSection, SiteSectionHeading, SiteProse } from "@/components/site";
import { Ref } from "@/components/refs/Ref";
import selfEvalData from "@/data/self-eval.json";
import { FormulasFormula } from "./FormulasFormula";

const latest = selfEvalData.latest;

export function FormulasLoopComplianceSection() {
  return (
    <SiteSection tone="muted" className="border-t border-border/60">
      <SiteSectionHeading kicker="Loop compliance" title="How often do sessions actually follow the GAD loop?" />
      <SiteProse className="mt-5 max-w-4xl">
        The canonical GAD loop (<Ref id="gad-18" />) says: start with{" "}
        <code className="rounded bg-card/60 px-1 text-accent">gad snapshot</code>, pick one task, implement, update
        planning docs, commit. Loop compliance measures the fraction of sessions that actually start with a snapshot
        call — the cheapest proxy for &quot;did the agent follow the loop.&quot;
      </SiteProse>

      <div className="mt-6 space-y-4">
        <FormulasFormula>loop_compliance = sessions_starting_with_snapshot / total_sessions</FormulasFormula>
      </div>

      {latest && (
        <div className="mt-6 rounded-xl border border-border/60 bg-card/30 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Current snapshot</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-4">
            <p className="text-4xl font-semibold tabular-nums text-foreground">
              {(latest.loop_compliance.score * 100).toFixed(0)}%
            </p>
            <p className="text-sm text-muted-foreground">
              {latest.loop_compliance.snapshot_starts} of {latest.loop_compliance.total_sessions} sessions
            </p>
          </div>
        </div>
      )}
    </SiteSection>
  );
}
