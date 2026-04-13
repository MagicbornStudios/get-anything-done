import { Identified } from "@/components/devid/Identified";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";
import { fmtTimestamp } from "@/components/landing/playable/playable-shared";
import { runtimeLabel } from "@/app/runs/[project]/[version]/run-process-metrics-runtime-label";

export function RunProcessMetricsCardGrid({ run }: { run: EvalRunRecord }) {
  const runtimesInvolved = (run.runtimesInvolved ?? []).filter(Boolean);
  const started = typeof run.timing?.started === "string" ? run.timing.started : null;
  const ended = typeof run.timing?.ended === "string" ? run.timing.ended : null;
  const lineage = run.agentLineage;

  return (
    <Identified as="RunProcessMetricsCards" className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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

      {lineage ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Agent lanes</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{lineage.total_agents}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {lineage.root_agent_count} root · {lineage.subagent_count} subagent · source {lineage.source}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Observed depth</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {lineage.max_depth_observed != null ? lineage.max_depth_observed : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {lineage.events_with_agent} traced event(s) with agent lineage
            </CardContent>
          </Card>
        </>
      ) : null}

      {run.timing ? (
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
      ) : null}

      {run.tokenUsage ? (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tool uses</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{run.tokenUsage.tool_uses ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {run.tokenUsage.total_tokens != null
              ? `${run.tokenUsage.total_tokens.toLocaleString()} tokens`
              : ""}
            {run.tokenUsage.note ? ` · ${run.tokenUsage.note}` : ""}
          </CardContent>
        </Card>
      ) : null}

      {run.gitAnalysis ? (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Commits</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{run.gitAnalysis.total_commits ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {run.gitAnalysis.task_id_commits ?? 0} with task id · {run.gitAnalysis.batch_commits ?? 0} batch
          </CardContent>
        </Card>
      ) : null}

      {run.planningQuality ? (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Planning docs</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{run.planningQuality.decisions_captured ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            decisions captured · {run.planningQuality.phases_planned ?? 0} phases planned
          </CardContent>
        </Card>
      ) : null}
    </Identified>
  );
}
