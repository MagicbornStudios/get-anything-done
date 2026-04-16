"use client";

import { useEffect, useMemo, useState } from "react";
import { Identified } from "@/components/devid/Identified";

type StatusKind = "ok" | "warn" | "unknown";
type StatusItem = {
  key: string;
  label: string;
  kind: StatusKind;
  detail: string;
};

type LiveSnapshot = {
  state?: { fileTimes?: Record<string, number> };
  recentChanges?: Array<{ file: string; timestamp: number }>;
};

export function PlanningLiveStatusPanel() {
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [graphReady, setGraphReady] = useState<null | { nodes: number }>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/dev/live?snapshot=1")
      .then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }))
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setLive(res.data as LiveSnapshot);
        else setLive({ recentChanges: [], state: { fileTimes: {} } });
      })
      .catch(() => {
        if (!cancelled) setLive(null);
      });

    void fetch("/api/dev/graph?format=json")
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          const nodes = Array.isArray((res.data as { nodes?: unknown[] }).nodes)
            ? ((res.data as { nodes: unknown[] }).nodes.length || 0)
            : 0;
          setGraphReady({ nodes });
        } else {
          setGraphReady(null);
        }
      })
      .catch(() => {
        if (!cancelled) setGraphReady(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statuses = useMemo<StatusItem[]>(() => {
    const latestChangeTs = Math.max(0, ...(live?.recentChanges?.map((c) => c.timestamp) ?? [0]));
    const activeRecently = latestChangeTs > 0 && Date.now() - latestChangeTs < 60_000;
    const hasFileTimes = Object.keys(live?.state?.fileTimes ?? {}).length > 0;
    return [
      {
        key: "watcher",
        label: "File watcher",
        kind: live ? (hasFileTimes ? "ok" : "unknown") : "unknown",
        detail: live
          ? hasFileTimes
            ? activeRecently
              ? "live endpoint reachable; recent planning changes observed"
              : "live endpoint reachable; no recent planning changes"
            : "live endpoint reachable; no planning file metadata"
          : "unknown/not wired in this environment",
      },
      {
        key: "tunnel",
        label: "Tunnel",
        kind: "unknown",
        detail: "unknown/not wired (no tunnel status endpoint in /api/dev)",
      },
      {
        key: "graph",
        label: "Graph indexing",
        kind: graphReady ? "ok" : "unknown",
        detail: graphReady
          ? `ready (derived from graph.json availability; nodes=${graphReady.nodes})`
          : "unknown (graph endpoint unavailable or no graph.json)",
      },
      {
        key: "logs",
        label: "Live logs stream",
        kind: live ? "ok" : "unknown",
        detail: live
          ? "available (derived: /api/dev/live snapshot reachable)"
          : "unknown/not wired in this environment",
      },
    ];
  }, [graphReady, live]);

  const tone = (kind: StatusKind) =>
    kind === "ok" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : kind === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-border/60 bg-muted/20 text-muted-foreground";

  return (
    <Identified as="PlanningLiveStatusPanel">
      <div className="rounded-md border border-border/60 bg-card/30 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live Status</div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {statuses.map((s) => (
            <Identified key={s.key} as={`PlanningLiveStatusItem-${s.key}`}>
              <div className={`rounded-sm border px-2 py-1.5 text-xs ${tone(s.kind)}`}>
                <div className="font-medium">{s.label}</div>
                <div className="mt-0.5 text-[11px] leading-4">{s.detail}</div>
              </div>
            </Identified>
          ))}
        </div>
      </div>
    </Identified>
  );
}

