"use client";

import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { PlanningSystemBarRow } from "./PlanningSystemBarRow";
import { planningFmtCompactCount, planningFmtCount } from "./planning-system-format";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

type PlanningSystemProjectTokensPanelProps = {
  selfEval: PlanningSelfEvalLatest;
  topProjectTokenSource: number;
};

function StatTile({
  kicker,
  value,
  hint,
}: {
  kicker: string;
  value: number | null | undefined;
  hint: string;
}) {
  const full = planningFmtCount(value);
  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-background/40 p-3 sm:p-4">
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
    </div>
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
      <CardHeader className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Token footprint</p>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">
            Eval harness totals plus local CLI trace estimate
          </CardTitle>
          <HoverCard openDelay={80}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="How this panel is computed"
              >
                <Info className="h-4 w-4" aria-hidden />
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 text-xs leading-relaxed" side="left" align="start">
              <p className="font-medium text-foreground">Two pipelines</p>
              <p className="mt-2 text-muted-foreground">
                <strong className="font-medium text-foreground/90">Eval runs</strong> sum token fields from preserved{" "}
                <code className="rounded bg-muted/60 px-1 py-0.5 text-[10px]">evals/&lt;project&gt;/&lt;version&gt;/TRACE.json</code>{" "}
                (GAD evaluation harness — not species/generations).{" "}
                <strong className="font-medium text-foreground/90">Live estimate</strong> reads{" "}
                <code className="rounded bg-muted/60 px-1 py-0.5 text-[10px]">.planning/.trace-events.jsonl</code>{" "}
                and approximates tokens as serialized tool I/O length ÷ 4 — useful for trends, not billing.
              </p>
            </HoverCardContent>
          </HoverCard>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile
            kicker="Combined (dashboard total)"
            value={projectTokens?.combined_total_tokens}
            hint="Eval TRACE token sum plus the live trace-event estimate. The hydration ratio elsewhere on this page divides snapshot estimate by this total."
          />
          <StatTile
            kicker="Eval traces (summed)"
            value={projectTokens?.exact_eval_tokens}
            hint="Summed from preserved eval TRACE.json files only. Comparable across eval versions when those artifacts exist."
          />
          <StatTile
            kicker="Live CLI inputs (estimate)"
            value={projectTokens?.estimated_live_input_tokens}
            hint="Sum over trace events: each event’s inputs field, serialized, then length ÷ 4 as a rough token count."
          />
          <StatTile
            kicker="Live CLI outputs (estimate)"
            value={projectTokens?.estimated_live_output_tokens}
            hint="Same heuristic as inputs, applied to each event’s outputs field."
          />
        </div>

        <div className="rounded-xl border border-border/50 bg-background/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/85">Sources: </span>
          {traceFiles} trace file{traceFiles === 1 ? "" : "s"}, {planningFmtCount(traceEvents)} trace event
          {traceEvents === 1 ? "" : "s"} ingested for the live estimate. Hover KPI info icons or tile values for
          detail.
        </div>

        <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">No `.trace-events.jsonl` sources found for this build.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
