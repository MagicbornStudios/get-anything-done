import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import type { EvalRunRecord } from "@/lib/eval-data";
import { fmtTimestamp } from "@/components/landing/playable/playable-shared";

function runtimeLabel(runtime: Record<string, unknown> | null | undefined) {
  if (!runtime) return "—";
  const id = typeof runtime.id === "string" && runtime.id ? runtime.id : "unknown";
  const model = typeof runtime.model === "string" && runtime.model ? runtime.model : null;
  return model ? `${id} · ${model}` : id;
}

export function RunProcessMetricsSection({ run }: { run: EvalRunRecord }) {
  const runtimesInvolved = (run.runtimesInvolved ?? []).filter(Boolean);
  const started = typeof run.timing?.started === "string" ? run.timing.started : null;
  const ended = typeof run.timing?.ended === "string" ? run.timing.ended : null;

  return (
    <SiteSection>
      <SiteSectionHeading kicker="Process metrics" title="How the agent actually worked" />
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Primary runtime</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{runtimeLabel(run.runtimeIdentity)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {runtimesInvolved.length > 0
              ? `${runtimesInvolved.length} runtime record(s) preserved`
              : "older runs may not carry runtime attribution yet"}
          </CardContent>
        </Card>

        {run.timing && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Wall clock</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {run.timing.duration_minutes != null ? `${run.timing.duration_minutes}m` : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {run.timing.phases_completed ?? 0} phases · {run.timing.tasks_completed ?? 0} tasks
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Started</CardDescription>
                <CardTitle className="text-base">{fmtTimestamp(started)}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Run start captured in TRACE timing metadata
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Ended</CardDescription>
                <CardTitle className="text-base">{fmtTimestamp(ended)}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Missing end time usually means the run was scaffolded but never finalized
              </CardContent>
            </Card>
          </>
        )}

        {run.tokenUsage && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tool uses</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{run.tokenUsage.tool_uses ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {run.tokenUsage.total_tokens != null ? `${run.tokenUsage.total_tokens.toLocaleString()} tokens` : ""}
              {run.tokenUsage.note ? ` · ${run.tokenUsage.note}` : ""}
            </CardContent>
          </Card>
        )}

        {run.gitAnalysis && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Commits</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{run.gitAnalysis.total_commits ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {run.gitAnalysis.task_id_commits ?? 0} with task id · {run.gitAnalysis.batch_commits ?? 0} batch
            </CardContent>
          </Card>
        )}

        {run.planningQuality && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Planning docs</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{run.planningQuality.decisions_captured ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              decisions captured · {run.planningQuality.phases_planned ?? 0} phases planned
            </CardContent>
          </Card>
        )}
      </div>

      {runtimesInvolved.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {runtimesInvolved.map((runtime, index) => (
            <span
              key={`${String(runtime.id ?? "runtime")}-${index}`}
              className="rounded-full border border-border/60 bg-card/30 px-2.5 py-1"
            >
              {runtimeLabel(runtime)}
            </span>
          ))}
        </div>
      )}
    </SiteSection>
  );
}
