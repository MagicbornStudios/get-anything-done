import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteSection, SiteSectionHeading, SiteProse } from "@/components/site";
import selfEvalConfig from "@/data/self-eval-config.json";
import selfEvalData from "@/data/self-eval.json";
import { FormulasFormula } from "./FormulasFormula";

const overheadCfg = selfEvalConfig.framework_overhead;
const latest = selfEvalData.latest;

export function FormulasFrameworkOverheadSection() {
  return (
    <SiteSection cid="formulas-framework-overhead-section-site-section" className="border-t border-border/60">
      <SiteSectionHeading kicker="Framework overhead" title="How much of the work is planning vs building?" />
      <SiteProse className="mt-5 max-w-4xl">
        Overhead measures the ratio of planning-file operations (reads/writes on .planning/ XML files) to total file
        operations. A healthy framework keeps overhead below 15%. Too high means you&apos;re maintaining the framework
        more than using it.
      </SiteProse>

      <div className="mt-6 space-y-4">
        <FormulasFormula>overhead_ratio = planning_ops / (planning_ops + source_ops)</FormulasFormula>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">≤ excellent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-emerald-400">
              {(overheadCfg.score_thresholds.excellent * 100).toFixed(0)}%
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Score: 1.0 — framework stays out of the way</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">≤ acceptable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-sky-400">
              {(overheadCfg.score_thresholds.acceptable * 100).toFixed(0)}%
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Score: 0.7 — tolerable cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">≤ concerning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-amber-400">
              {(overheadCfg.score_thresholds.concerning * 100).toFixed(0)}%
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Score: 0.4 — ceremony is eating real work</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">&gt; concerning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-rose-400">
              &gt;{(overheadCfg.score_thresholds.concerning * 100).toFixed(0)}%
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Score: 0.1 — framework is the bottleneck</p>
          </CardContent>
        </Card>
      </div>

      {latest && (
        <div className="mt-6 rounded-xl border border-border/60 bg-card/30 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Current snapshot</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-4">
            <p className="text-4xl font-semibold tabular-nums text-foreground">
              {(latest.framework_overhead.ratio * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">
              {latest.framework_overhead.planning_ops} planning ops /{" "}
              {latest.framework_overhead.planning_ops + latest.framework_overhead.source_ops} total — score{" "}
              <strong className="text-foreground">{latest.framework_overhead.score}</strong>
            </p>
          </div>
        </div>
      )}
    </SiteSection>
  );
}

