import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { planningFmtCount, planningFmtPercent } from "./planning-system-format";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

/**
 * Illustrative context ceilings for “% of window one snapshot fills” (Apr 2026).
 * Agent tokenizers differ; these are order-of-magnitude gauges, not billing.
 */
const REFERENCE_CONTEXT_WINDOWS = [
  { label: "Claude (≈200k ctx)", tokens: 200_000 },
  { label: "Codex-class (≈272k ctx)", tokens: 272_000 },
] as const;

function pctToneGoodHigh(pct: number) {
  if (pct >= 85) return "text-emerald-400";
  if (pct >= 55) return "text-amber-400";
  return "text-rose-400";
}

function barToneGoodHigh(pct: number) {
  if (pct >= 85) return "from-emerald-500/90 to-emerald-700/90";
  if (pct >= 55) return "from-amber-400/90 to-amber-700/90";
  return "from-rose-400/90 to-rose-700/90";
}

/** Lower ratio is better (stress). */
function overheadTone(ratio: number) {
  if (ratio <= 0.12) return "text-emerald-400";
  if (ratio <= 0.22) return "text-amber-400";
  return "text-rose-400";
}

function overheadBar(ratio: number) {
  if (ratio <= 0.12) return "from-emerald-500/90 to-emerald-700/90";
  if (ratio <= 0.22) return "from-amber-400/90 to-amber-700/90";
  return "from-rose-400/90 to-rose-700/90";
}

/** Lower fill % of a reference window is better (snapshot tax). */
function snapshotWindowTone(pct: number) {
  if (pct <= 8) return "text-emerald-400";
  if (pct <= 18) return "text-amber-400";
  return "text-rose-400";
}

function snapshotWindowBar(pct: number) {
  if (pct <= 8) return "from-emerald-500/90 to-emerald-700/90";
  if (pct <= 18) return "from-amber-400/90 to-amber-700/90";
  return "from-rose-400/90 to-rose-700/90";
}

export function PlanningSystemStatCards({ selfEval }: { selfEval: PlanningSelfEvalLatest }) {
  const projectTokens = selfEval.project_tokens;
  const activeAssignments = selfEval.active_assignments;
  const h = selfEval.hydration;
  const snapCount = h.snapshot_count ?? 0;
  const snapTotal = h.estimated_snapshot_tokens ?? 0;
  const avgPerSnapshot = snapCount > 0 ? snapTotal / snapCount : 0;
  const compliance = selfEval.framework_compliance.score;
  const hydrationShare = h.overhead_ratio;
  const planningOverhead = selfEval.framework_overhead.ratio;

  const docsPct = compliance * 100;
  const docsTone = pctToneGoodHigh(docsPct);
  const docsBar = barToneGoodHigh(docsPct);
  const hydrTone = overheadTone(hydrationShare);
  const hydrBar = overheadBar(hydrationShare);
  const planTone = overheadTone(planningOverhead);
  const planBar = overheadBar(planningOverhead);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="space-y-2 pb-2 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Docs attribution
            </p>
            <CardTitle className={cn("text-3xl tabular-nums tracking-tight", docsTone)}>
              {planningFmtPercent(compliance)}
            </CardTitle>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Completed tasks with skill, agent, and type —{" "}
              {planningFmtCount(selfEval.framework_compliance.fully_attributed)} /{" "}
              {planningFmtCount(selfEval.framework_compliance.completed_tasks)} fully attributed
            </p>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40"
              title="Higher is better"
            >
              <div
                className={cn("h-full rounded-full bg-gradient-to-r transition-[width]", docsBar)}
                style={{ width: `${Math.min(100, docsPct)}%` }}
              />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader className="space-y-2 pb-2 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hydration overhead
            </p>
            <CardTitle className={cn("text-3xl tabular-nums tracking-tight", hydrTone)}>
              {planningFmtPercent(hydrationShare)}
            </CardTitle>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Estimated snapshot payload vs traced agent token volume (re-entry / `gad snapshot` tax)
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40" title="Lower is better">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r transition-[width]", hydrBar)}
                style={{ width: `${Math.min(100, hydrationShare * 100)}%` }}
              />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader className="space-y-2 pb-2 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Planning overhead
            </p>
            <CardTitle className={cn("text-3xl tabular-nums tracking-tight", planTone)}>
              {planningFmtPercent(planningOverhead)}
            </CardTitle>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Planning-file ops share of CLI file activity — framework tax on the loop
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40" title="Lower is better">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r transition-[width]", planBar)}
                style={{ width: `${Math.min(100, planningOverhead * 100)}%` }}
              />
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/40">
        <CardHeader className="pb-2 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Snapshot context load
          </p>
          <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
            {snapCount > 0 ? (
              <>
                ~{planningFmtCount(Math.round(avgPerSnapshot))} tok / snapshot ·{" "}
                {planningFmtCount(snapTotal)} tok total · {planningFmtCount(snapCount)} snapshots
              </>
            ) : (
              <span className="text-muted-foreground">No snapshot events in window — run `gad snapshot` to seed</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/90">Workflow boot</span> — one average `gad snapshot` vs
            published model context (char/4 estimate). <span className="font-medium text-foreground/90">Hydration</span>{" "}
            — overhead share above (snapshots vs full traced volume), not a second window fill.
          </p>
          {snapCount > 0 && avgPerSnapshot > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {REFERENCE_CONTEXT_WINDOWS.map(({ label, tokens }) => {
                const pct = Math.min(100, (avgPerSnapshot / tokens) * 100);
                const tone = snapshotWindowTone(pct);
                const fill = snapshotWindowBar(pct);
                return (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-medium text-foreground/90">{label}</span>
                      <span className={cn("font-mono text-xs tabular-nums", tone)}>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r", fill)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[11px] leading-tight text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider text-foreground/80">Active lanes</span>
        <span className="font-mono tabular-nums text-foreground">
          {planningFmtCount(activeAssignments?.total_active_agents ?? 0)} agents
        </span>
        <span className="text-border">·</span>
        <span className="font-mono tabular-nums text-foreground">
          {planningFmtCount(activeAssignments?.total_claimed_tasks ?? 0)} claimed
        </span>
        <span className="text-border">·</span>
        <span className="font-mono tabular-nums text-amber-600/90">
          {planningFmtCount(activeAssignments?.total_stale_agents ?? 0)} stale
        </span>
      </div>

      <Card className="border-border/60 bg-card/40">
        <CardHeader className="pb-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Project token accounting</p>
          <CardTitle className="text-2xl tabular-nums">
            {planningFmtCount(projectTokens?.combined_total_tokens ?? 0)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          eval exact + live trace estimate
        </CardContent>
      </Card>
    </div>
  );
}
