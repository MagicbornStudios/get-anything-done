import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

export function RunGateReportSection({ run }: { run: EvalRunRecord }) {
  if (!run.requirementCoverage) return null;
  const cov = run.requirementCoverage;
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Gate report</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Requirement coverage</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total criteria</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{cov.total_criteria ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Fully met</CardDescription>
              <CardTitle className="text-3xl tabular-nums text-emerald-400">
                {cov.fully_met ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Partially met</CardDescription>
              <CardTitle className="text-3xl tabular-nums text-amber-400">
                {cov.partially_met ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Not met</CardDescription>
              <CardTitle className="text-3xl tabular-nums text-red-400">{cov.not_met ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>
        {cov.gate_notes && (
          <div className="mt-6 rounded-2xl border border-border/70 bg-card/40 p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Reviewer notes on gates
            </p>
            <p className="mt-2 text-base leading-7 text-foreground">{cov.gate_notes}</p>
          </div>
        )}
      </div>
    </section>
  );
}
