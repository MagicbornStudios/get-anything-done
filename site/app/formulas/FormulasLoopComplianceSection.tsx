import { SiteSection, SiteSectionHeading, SiteProse } from "@/components/site";
import { Ref } from "@/components/refs/Ref";
import selfEvalData from "@/data/self-eval.json";
import { FormulasFormula } from "./FormulasFormula";

const latest = selfEvalData.latest;

export function FormulasLoopComplianceSection() {
  return (
    <SiteSection cid="formulas-loop-compliance-section-site-section" tone="muted" className="border-t border-border/60">
      <SiteSectionHeading kicker="Framework compliance" title="How much of the work is actually tracked through the framework?" />
      <SiteProse className="mt-5 max-w-4xl">
        The old loop-compliance ratio overcounted startup ritual and undercounted actual framework use. The current
        discipline metric follows <Ref id="gad-104" /> and the planning docs directly: completed tasks should carry
        the framework attribution fields that make later analysis possible.
      </SiteProse>

      <div className="mt-6 space-y-4">
        <FormulasFormula>framework_compliance = fully_attributed_done_tasks / completed_tasks</FormulasFormula>
        <FormulasFormula>hydration_overhead = estimated_snapshot_tokens / total_project_tokens</FormulasFormula>
      </div>

      {latest && (
        <div className="mt-6 rounded-xl border border-border/60 bg-card/30 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Current snapshot</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-4">
            <p className="text-4xl font-semibold tabular-nums text-foreground">
              {(latest.framework_compliance.score * 100).toFixed(0)}%
            </p>
            <p className="text-sm text-muted-foreground">
              {latest.framework_compliance.fully_attributed} of {latest.framework_compliance.completed_tasks} completed tasks
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {(latest.hydration.overhead_ratio * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">
              {latest.hydration.snapshot_count} snapshots • {latest.hydration.estimated_snapshot_tokens.toLocaleString()} estimated hydration tokens
            </p>
          </div>
        </div>
      )}
    </SiteSection>
  );
}

