"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types — mirrors the API response from /api/dev/evals/projects/[id]/system
// ---------------------------------------------------------------------------

interface SystemStats {
  framework_overhead?: { ratio?: number };
  project_tokens?: { combined_total_tokens?: number };
  totals?: { events?: number; sessions?: number; gad_cli_calls?: number };
  framework_compliance?: {
    score?: number;
    completed_tasks?: number;
    with_skill?: number;
    with_agent?: number;
    with_type?: number;
    fully_attributed?: number;
  };
  hydration?: {
    snapshot_count?: number;
    estimated_snapshot_tokens?: number;
    total_project_tokens?: number;
    overhead_ratio?: number;
  };
  [key: string]: unknown;
}

interface RecentActivityEntry {
  timestamp?: string;
  event?: string;
  file?: string;
  kind?: string;
  [key: string]: unknown;
}

interface SystemApiResponse {
  stats?: SystemStats;
  recentActivity?: RecentActivityEntry[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCount(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return value.toLocaleString();
}

function fmtPercent(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `${(value * 100).toFixed(1)}%`;
}

function overheadTone(ratio: number): { text: string; bar: string } {
  if (ratio <= 0.12) return { text: "text-emerald-400", bar: "from-emerald-500/90 to-emerald-700/90" };
  if (ratio <= 0.22) return { text: "text-amber-400", bar: "from-amber-400/90 to-amber-700/90" };
  return { text: "text-rose-400", bar: "from-rose-400/90 to-rose-700/90" };
}

function formatTs(raw: string | undefined): string {
  if (!raw) return "\u2014";
  try {
    return new Date(raw).toLocaleTimeString(undefined, {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SystemStatCards({ stats }: { stats: SystemStats }) {
  const overhead = stats.framework_overhead?.ratio;
  const tokens = stats.project_tokens?.combined_total_tokens;
  const totals = stats.totals;
  const compliance = stats.framework_compliance;

  const hasOverhead = overhead != null;
  const tone = hasOverhead ? overheadTone(overhead) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {hasOverhead && tone && (
          <Card className="border-border/60 bg-card/50">
            <CardHeader className="space-y-2 pb-2 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Planning overhead
              </p>
              <CardTitle className={`text-3xl tabular-nums tracking-tight ${tone.text}`}>
                {fmtPercent(overhead)}
              </CardTitle>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Planning-file ops share of CLI file activity
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40" title="Lower is better">
                <div
                  className={`h-full rounded-full bg-gradient-to-r transition-[width] ${tone.bar}`}
                  style={{ width: `${Math.min(100, overhead * 100)}%` }}
                />
              </div>
            </CardHeader>
          </Card>
        )}

        {tokens != null && (
          <Card className="border-border/60 bg-card/50">
            <CardHeader className="space-y-2 pb-2 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total tokens
              </p>
              <CardTitle className="text-3xl tabular-nums tracking-tight">
                {fmtCount(tokens)}
              </CardTitle>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Eval exact + live trace estimate
              </p>
            </CardHeader>
          </Card>
        )}
      </div>

      {totals && (
        <div className="grid gap-3 grid-cols-3">
          <Card className="border-border/60 bg-card/40">
            <CardHeader className="pb-1 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Events</p>
              <CardTitle className="text-xl tabular-nums">{fmtCount(totals.events)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/60 bg-card/40">
            <CardHeader className="pb-1 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessions</p>
              <CardTitle className="text-xl tabular-nums">{fmtCount(totals.sessions)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/60 bg-card/40">
            <CardHeader className="pb-1 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">GAD CLI calls</p>
              <CardTitle className="text-xl tabular-nums">{fmtCount(totals.gad_cli_calls)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {compliance && compliance.completed_tasks != null && compliance.completed_tasks > 0 && (
        <Card className="border-border/60 bg-card/40">
          <CardHeader className="pb-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Framework compliance
            </p>
            <CardTitle className="text-2xl tabular-nums">
              {fmtPercent(compliance.score)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            <Badge variant="outline" className="text-[10px]">
              {fmtCount(compliance.completed_tasks)} completed
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {fmtCount(compliance.fully_attributed)} fully attributed
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {fmtCount(compliance.with_skill)} with skill
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SystemRecentActivity({ entries }: { entries: RecentActivityEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/40">
      <CardHeader className="pb-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recent activity</p>
        <CardTitle className="text-base">Latest system events</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {entries.slice(0, 20).map((entry, i) => {
            const key = `${entry.timestamp ?? ""}-${entry.event ?? ""}-${i}`;
            return (
              <div
                key={key}
                className="flex items-start gap-3 rounded border border-border/40 bg-muted/20 px-3 py-1.5"
              >
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {formatTs(entry.timestamp)}
                </span>
                <span className="min-w-0 flex-1 text-xs text-foreground">
                  {entry.event ?? entry.kind ?? "event"}
                  {entry.file ? (
                    <span className="ml-1 text-muted-foreground">{entry.file}</span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ProjectSystemTabProps {
  projectId: string;
}

export function ProjectSystemTab({ projectId }: ProjectSystemTabProps) {
  const [data, setData] = useState<SystemApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/dev/evals/projects/${encodeURIComponent(projectId)}/system`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((json: SystemApiResponse) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div
        data-cid="project-system-tab-site-section"
        className="mx-auto max-w-5xl px-4 py-8"
      >
        <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          Loading system data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-cid="project-system-tab-site-section"
        className="mx-auto max-w-5xl px-4 py-8"
      >
        <div className="rounded-md border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-400">
          Failed to load system data: {error}
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const recentActivity = data?.recentActivity ?? [];

  const hasStats =
    stats != null &&
    (stats.framework_overhead != null ||
      stats.project_tokens != null ||
      stats.totals != null ||
      stats.framework_compliance != null);

  if (!hasStats && recentActivity.length === 0) {
    return (
      <div
        data-cid="project-system-tab-site-section"
        className="mx-auto max-w-5xl px-4 py-16 text-center"
      >
        <p className="text-sm text-muted-foreground">
          No system data available. System data is populated from{" "}
          <code className="rounded bg-muted/60 px-1">self-eval.json</code>{" "}
          when an eval has been scored.
        </p>
      </div>
    );
  }

  return (
    <div
      data-cid="project-system-tab-site-section"
      className="mx-auto max-w-5xl space-y-6 px-4 py-8"
    >
      {hasStats && stats && <SystemStatCards stats={stats} />}
      <SystemRecentActivity entries={recentActivity} />
    </div>
  );
}
