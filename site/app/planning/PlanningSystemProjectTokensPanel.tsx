"use client";

/**
 * Visual-context landmarks: outer shell is `PlanningSystemProjectTokensPanel` (PlanningSystemTab).
 * Inner regions share prefix `PlanningSystemProjectTokens*` so handoff can cite KPIs without guessing.
 */

import { Info } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanningSystemBarRow } from "./PlanningSystemBarRow";
import { planningFmtCompactCount, planningFmtCount } from "./planning-system-format";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

type PlanningSystemProjectTokensPanelProps = {
  selfEval: PlanningSelfEvalLatest;
  topProjectTokenSource: number;
};

function StatTile({
  landmarkAs,
  kicker,
  value,
  hint,
}: {
  /** Greppable dev-id token; parent is `PlanningSystemProjectTokensPanel`. */
  landmarkAs: string;
  kicker: string;
  value: number | null | undefined;
  hint: string;
}) {
  const full = planningFmtCount(value);
  return (
    <Identified
      as={landmarkAs}
      className="min-w-0 rounded-xl border border-border/50 bg-background/40 p-3 sm:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[11px] uppercase tracking-wider text-muted-foreground">{kicker}</p>
        <HoverCard openDelay={80} closeDelay={0}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`About: ${kicker}`}
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-72 text-xs leading-relaxed" side="top" align="end">
            <p className="text-popover-foreground">{hint}</p>
          </HoverCardContent>
        </HoverCard>
      </div>
      <p
        className="mt-1 break-all text-lg font-semibold leading-tight tabular-nums sm:text-xl"
        title={full}
      >
        {planningFmtCompactCount(value)}
      </p>
    </Identified>
  );
}

export function PlanningSystemProjectTokensPanel({
  selfEval,
  topProjectTokenSource,
}: PlanningSystemProjectTokensPanelProps) {
  const projectTokens = selfEval.project_tokens;
  const traceFiles = projectTokens?.trace_files ?? 0;
  const traceEvents = projectTokens?.trace_events ?? 0;

  return (
    <Card className="border-border/60 bg-card/40">
      <Tabs defaultValue="eval" className="w-full min-w-0">
        <CardHeader className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Token footprint</p>
          <Identified as="PlanningSystemProjectTokensHeading" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-auto">
              <TabsTrigger value="eval" className="text-xs sm:text-sm">
                Eval harness
              </TabsTrigger>
              <TabsTrigger value="cli" className="text-xs sm:text-sm">
                CLI trace log
              </TabsTrigger>
            </TabsList>
            <Identified as="PlanningSystemProjectTokensPipelineInfo" depth={2}>
              <HoverCard openDelay={80}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-center"
                    aria-label="How this panel is computed"
                  >
                    <Info className="h-4 w-4" aria-hidden />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 text-xs leading-relaxed" side="left" align="start">
                  <p className="font-medium text-foreground">Two different signals</p>
                  <p className="mt-2 text-muted-foreground">
                    <strong className="font-medium text-foreground/90">Eval harness</strong> sums token fields from
                    preserved{" "}
                    <code className="rounded bg-muted/60 px-1 py-0.5 text-[10px]">evals/&lt;project&gt;/&lt;version&gt;/TRACE.json</code>
                    — that is the evaluation harness’s own telemetry when runs are preserved.
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    <strong className="font-medium text-foreground/90">CLI trace log</strong> reads{" "}
                    <code className="rounded bg-muted/60 px-1 py-0.5 text-[10px]">.planning/.trace-events.jsonl</code>{" "}
                    and estimates “tokens” as serialized logged tool inputs/outputs (length ÷ 4). That is{" "}
                    <strong className="font-medium text-foreground/90">not</strong> the same as provider-reported
                    model tokens or guaranteed context-window usage — it is a rough size signal for local CLI
                    activity and trends on this repo only.
                  </p>
                </HoverCardContent>
              </HoverCard>
            </Identified>
          </Identified>
          <CardDescription className="text-xs leading-relaxed sm:text-sm">
            Use the tabs to separate eval artifacts from local CLI log volume — combined totals on the Eval tab feed
            hydration math elsewhere on this page.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <TabsContent value="eval" className="mt-0 space-y-4 ring-offset-0 focus-visible:ring-0">
            <Identified as="PlanningSystemProjectTokensTabEval" className="space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Numbers here come from preserved eval <code className="rounded bg-muted/60 px-1 py-0.5 text-[10px]">TRACE.json</code>{" "}
                files plus the dashboard “combined” denominator (eval + CLI estimate) used for hydration on this
                route.
              </p>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <StatTile
                  landmarkAs="PlanningSystemProjectTokensKpiCombined"
                  kicker="Combined (dashboard total)"
                  value={projectTokens?.combined_total_tokens}
                  hint="Eval TRACE token sum plus the CLI log estimate. The hydration ratio elsewhere on this page divides snapshot estimate by this total."
                />
                <StatTile
                  landmarkAs="PlanningSystemProjectTokensKpiEvalTraces"
                  kicker="Eval traces (summed)"
                  value={projectTokens?.exact_eval_tokens}
                  hint="Summed from preserved eval TRACE.json files only. Comparable across eval versions when those artifacts exist."
                />
              </div>
            </Identified>
          </TabsContent>

          <TabsContent value="cli" className="mt-0 space-y-4 ring-offset-0 focus-visible:ring-0">
            <Identified as="PlanningSystemProjectTokensTabCli" className="space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                This is <strong className="font-medium text-foreground/90">not</strong> “tokens the model consumed”
                from an API. It is a <strong className="font-medium text-foreground/90">heuristic on logged CLI/tool
                payloads</strong> (chars ÷ 4) so you can compare relative local activity — skip this tab if you only
                care about eval harness totals.
              </p>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <StatTile
                  landmarkAs="PlanningSystemProjectTokensKpiLiveInputs"
                  kicker="Logged inputs (estimate)"
                  value={projectTokens?.estimated_live_input_tokens}
                  hint="Sum over trace events: each event’s inputs field serialized, then length ÷ 4. Reflects what was logged, not necessarily full LLM context."
                />
                <StatTile
                  landmarkAs="PlanningSystemProjectTokensKpiLiveOutputs"
                  kicker="Logged outputs (estimate)"
                  value={projectTokens?.estimated_live_output_tokens}
                  hint="Same heuristic on each event’s outputs field. Still not provider billing tokens."
                />
              </div>

              <Identified
                as="PlanningSystemProjectTokensSourcesNote"
                className="rounded-xl border border-border/50 bg-background/30 p-3 text-[11px] leading-relaxed text-muted-foreground"
              >
                <span className="font-medium text-foreground/85">Sources: </span>
                {traceFiles} trace file{traceFiles === 1 ? "" : "s"}, {planningFmtCount(traceEvents)} trace event
                {traceEvents === 1 ? "" : "s"} in the JSONL used for this estimate. Hover KPI info icons or values for
                full figures.
              </Identified>

              <Identified as="PlanningSystemProjectTokensTraceFilesByVolume" className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Trace files by estimated volume
                </p>
                <div className="space-y-2.5">
                  {(projectTokens?.sources ?? []).length > 0 ? (
                    (projectTokens?.sources ?? []).map((source) => (
                      <PlanningSystemBarRow
                        key={source.path}
                        label={source.path}
                        value={source.estimated_total_tokens}
                        max={topProjectTokenSource}
                        suffix="tok"
                      />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No `.trace-events.jsonl` sources found for this build.
                    </p>
                  )}
                </div>
              </Identified>
            </Identified>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
