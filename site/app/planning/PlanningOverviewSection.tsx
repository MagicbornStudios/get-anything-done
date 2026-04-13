import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import type { PlanningState } from "@/lib/catalog.generated";
import selfEvalData from "@/data/self-eval.json";

export function PlanningOverviewSection({ state }: { state: PlanningState }) {
  const selfEval = selfEvalData.latest;
  const projectTokens = selfEval?.project_tokens;
  const combinedProjectTokens = projectTokens?.combined_total_tokens ?? selfEval?.evals?.tokens?.total ?? 0;
  const runtimeCount = selfEval?.runtime_distribution?.length ?? 0;
  const evalRuns = selfEval?.evals?.runs ?? 0;

  return (
    <SiteSection>
      <Identified as="PlanningOverviewIntro">
        <SiteSectionHeading
          kicker="Planning state"
          as="h1"
          preset="hero-compact"
          title={
            <>
              What&apos;s in flight <span className="gradient-text">right now.</span>
            </>
          }
        />
        <SiteProse className="mt-5">
          This page is built from{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">.planning/STATE.xml</code>,{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TASK-REGISTRY.xml</code>,{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">DECISIONS.xml</code>, root{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">.gad-log</code> telemetry, and preserved eval{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TRACE.json</code> artifacts. This is the
          framework&apos;s public operations console: planning state, self-eval metrics, runtime mix, and eval
          token accounting in one place.
        </SiteProse>
      </Identified>

      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Identified as="PlanningOverviewStat-currentPhase">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current phase</CardDescription>
              <CardTitle className="text-4xl tabular-nums gradient-text">
                {state.currentPhase ?? "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              milestone {state.milestone ?? "—"}
            </CardContent>
          </Card>
        </Identified>
        <Identified as="PlanningOverviewStat-openTasks">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open tasks</CardDescription>
              <CardTitle className="text-4xl tabular-nums text-accent">{state.openTasks.length}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              excluding done and cancelled
            </CardContent>
          </Card>
        </Identified>
        <Identified as="PlanningOverviewStat-traceEvents">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Trace events</CardDescription>
              <CardTitle className="text-4xl tabular-nums text-sky-300">
                {selfEval?.totals?.events?.toLocaleString?.() ?? "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {selfEval?.totals?.sessions ?? "—"} sessions in root telemetry
            </CardContent>
          </Card>
        </Identified>
        <Identified as="PlanningOverviewStat-projectTokens">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Project token accounting</CardDescription>
              <CardTitle className="text-4xl tabular-nums text-violet-300">
                {combinedProjectTokens.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {evalRuns} eval runs + live trace estimates
            </CardContent>
          </Card>
        </Identified>
        <Identified as="PlanningOverviewStat-runtimesTracked">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Runtimes tracked</CardDescription>
              <CardTitle className="text-4xl tabular-nums text-amber-300">{runtimeCount}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              from monorepo logs and eval artifacts
            </CardContent>
          </Card>
        </Identified>
        <Identified as="PlanningOverviewStat-tasksCompleted">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tasks completed</CardDescription>
              <CardTitle className="text-4xl tabular-nums text-emerald-400">{state.doneTasksCount}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              across the full project history
            </CardContent>
          </Card>
        </Identified>
        <Identified as="PlanningOverviewStat-loopCompliance">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Loop compliance</CardDescription>
              <CardTitle className="text-4xl tabular-nums text-foreground">
                {selfEval ? `${(selfEval.loop_compliance.score * 100).toFixed(0)}%` : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {selfEval
                ? `${selfEval.loop_compliance.snapshot_starts}/${selfEval.loop_compliance.total_sessions} sessions start with snapshot`
                : "self-eval unavailable"}
            </CardContent>
          </Card>
        </Identified>
        <Identified as="PlanningOverviewStat-lastUpdated">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last updated</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{state.lastUpdated ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">STATE.xml</CardContent>
          </Card>
        </Identified>
      </div>
    </SiteSection>
  );
}
