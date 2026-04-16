"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Identified } from "@/components/devid/Identified";
import { cn } from "@/lib/utils";
import { PlanningSystemBarRow } from "./PlanningSystemBarRow";
import { planningFmtCount } from "./planning-system-format";
import type { PlanningActiveAgentLane, PlanningDepthCount, PlanningRuntimeCount } from "./planning-system-types";

const FEED_MAX_LINES = 20;

type PlanningSystemRuntimeActivityPanelProps = {
  topRuntimeCount: number;
  runtimeDistribution: PlanningRuntimeCount[];
  runtimeSessions: PlanningRuntimeCount[];
  activeAssignments?: {
    depth_distribution: PlanningDepthCount[];
    active_agents: PlanningActiveAgentLane[];
    stale_agents: PlanningActiveAgentLane[];
  };
};

type LiveSnapshotChange = { file: string; event: string; timestamp: number; size?: number };

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function pushFeedLine(prev: string[], line: string): string[] {
  const next = [...prev, line];
  return next.length > FEED_MAX_LINES ? next.slice(-FEED_MAX_LINES) : next;
}

function formatChangeLine(c: LiveSnapshotChange) {
  const sz = c.size != null ? ` · ${c.size}b` : "";
  return `[${formatTime(c.timestamp)}] ${c.event} · ${c.file}${sz}`;
}

function formatStateLine(data: Record<string, unknown>, ts: number) {
  const phase = data.phase != null ? String(data.phase) : "—";
  const ms = data.milestone != null ? String(data.milestone) : "—";
  const tasks = data.tasks as { done?: number; planned?: number; inProgress?: number } | undefined;
  const t =
    tasks != null
      ? `tasks planned=${tasks.planned ?? "?"}/in=${tasks.inProgress ?? "?"}/done=${tasks.done ?? "?"}`
      : "tasks —";
  return `[${formatTime(ts)}] state · phase=${phase} · ${ms} · ${t}`;
}

function formatJsonLine(kind: string, raw: string, ts: number) {
  if (kind === "heartbeat") return `[${formatTime(ts)}] heartbeat`;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (kind === "agents") {
      const arr = Array.isArray(parsed) ? parsed : [];
      return `[${formatTime(ts)}] agents · ${arr.length} cluster(s)`;
    }
    const data = parsed as Record<string, unknown>;
    if (kind === "state") return formatStateLine(data, ts);
    if (kind === "change") return formatChangeLine(data as unknown as LiveSnapshotChange);
    if (kind === "cli-activity") {
      const file = data.file != null ? String(data.file) : "?";
      const ev = data.event != null ? String(data.event) : "?";
      return `[${formatTime(ts)}] cli-activity · ${file} (${ev})`;
    }
    if (kind === "graph-rebuilt") return `[${formatTime(ts)}] graph-rebuilt`;
  } catch {
    /* ignore */
  }
  const one = raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
  return `[${formatTime(ts)}] ${kind} · ${one}`;
}

function PlanningLiveFeedTab({ liveEnabled }: { liveEnabled: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastRx, setLastRx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const bumpPulse = useCallback(() => {
    setPulseKey((k) => k + 1);
    setLastRx(Date.now());
  }, []);

  const append = useCallback((kind: string, raw: string) => {
    const ts = Date.now();
    setLines((prev) => pushFeedLine(prev, formatJsonLine(kind, raw, ts)));
    bumpPulse();
  }, [bumpPulse]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "development") {
      setError("Live stream is available only when the site runs in development (NODE_ENV=development).");
      return;
    }

    let cancelled = false;

    void fetch("/api/dev/live?snapshot=1")
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then((res) => {
        if (cancelled || !res.ok) return;
        const recent = (res.data as { recentChanges?: LiveSnapshotChange[] }).recentChanges ?? [];
        const seed = recent.map((c) => formatChangeLine(c)).slice(-FEED_MAX_LINES);
        if (seed.length) setLines(seed);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "development") return;
    if (!liveEnabled) {
      esRef.current?.close();
      esRef.current = null;
      setConnected(false);
      return;
    }

    const url = new URL("/api/dev/live", window.location.origin).toString();
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
      bumpPulse();
    };

    const onMsg =
      (kind: string) =>
      (ev: MessageEvent) => {
        append(kind, typeof ev.data === "string" ? ev.data : JSON.stringify(ev.data));
      };

    es.addEventListener("change", onMsg("change"));
    es.addEventListener("state", onMsg("state"));
    es.addEventListener("heartbeat", onMsg("heartbeat"));
    es.addEventListener("cli-activity", onMsg("cli-activity"));
    es.addEventListener("graph-rebuilt", onMsg("graph-rebuilt"));
    es.addEventListener("agents", onMsg("agents"));

    es.onerror = () => {
      setConnected(es.readyState === EventSource.OPEN);
      if (es.readyState === EventSource.CLOSED) {
        setError("Stream closed. Switch away from Live feed and back to reconnect.");
      }
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [liveEnabled, append, bumpPulse]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            key={pulseKey}
            className={cn(
              "inline-block size-2.5 shrink-0 rounded-full transition-transform duration-300",
              connected ? "animate-pulse bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.55)]" : "bg-muted-foreground/40",
            )}
            aria-hidden
          />
          <span className="text-[11px] font-medium text-foreground">
            {connected ? "Receiving events" : "Connecting…"}
          </span>
        </div>
        {lastRx != null ? (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            Last line {formatTime(lastRx)}
          </span>
        ) : null}
        <Badge variant="outline" className="text-[10px]">
          Last {FEED_MAX_LINES} lines
        </Badge>
      </div>
      {error ? <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p> : null}
      <pre
        className={cn(
          "max-h-[22rem] min-h-[10rem] overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-foreground",
          "whitespace-pre-wrap break-all",
        )}
        aria-live="polite"
        aria-relevant="additions"
      >
        {lines.length ? lines.join("\n") : "Open this tab and touch planning files or the CLI — lines appear here."}
      </pre>
      <p className="text-[10px] text-muted-foreground">
        Source: <code className="rounded bg-muted/80 px-1">GET /api/dev/live</code> (SSE). Planning file watches and{" "}
        <code className="rounded bg-muted/80 px-1">.gad-log/*.jsonl</code> bumps show as{" "}
        <code className="rounded bg-muted/80 px-1">cli-activity</code>.
      </p>
    </div>
  );
}

export function PlanningSystemRuntimeActivityPanel({
  topRuntimeCount,
  runtimeDistribution,
  runtimeSessions,
  activeAssignments,
}: PlanningSystemRuntimeActivityPanelProps) {
  const [runtimeTab, setRuntimeTab] = useState("overview");
  const topActiveAgents = (activeAssignments?.active_agents ?? []).slice(0, 5);

  const overview = (
    <>
      <div className="space-y-2.5">
        {runtimeDistribution.length > 0 ? (
          runtimeDistribution.map((entry) => (
            <PlanningSystemBarRow
              key={`events-${entry.runtime}`}
              label={entry.runtime}
              value={entry.count ?? 0}
              max={topRuntimeCount}
              suffix="events"
            />
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No runtime-attributed events captured yet.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {runtimeSessions.map((entry) => (
          <Badge key={`sessions-${entry.runtime}`} variant="outline">
            {entry.runtime}: {planningFmtCount(entry.sessions)} sessions
          </Badge>
        ))}
        {(activeAssignments?.depth_distribution ?? []).map((entry) => (
          <Badge key={`depth-${entry.depth}`} variant="outline">
            depth {entry.depth}: {planningFmtCount(entry.count)} lane{entry.count === 1 ? "" : "s"}
          </Badge>
        ))}
      </div>
      {topActiveAgents.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border/60 bg-background/30 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Active agent lanes</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            {topActiveAgents.map((lane) => (
              <div key={lane.agent_id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] text-foreground">{lane.agent_id}</p>
                  <p>
                    {lane.runtime} · role={lane.agent_role} · depth={lane.depth}
                    {lane.resolved_model
                      ? ` · ${lane.resolved_model}`
                      : lane.model_profile
                        ? ` · ${lane.model_profile}`
                        : ""}
                  </p>
                </div>
                <Badge variant="secondary">{lane.tasks.length} task{lane.tasks.length === 1 ? "" : "s"}</Badge>
              </div>
            ))}
          </div>
          {(activeAssignments?.stale_agents?.length ?? 0) > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {planningFmtCount(activeAssignments?.stale_agents.length)} stale lane(s) are being tracked separately.
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        This is pseudo real-time operational telemetry from the monorepo <code className="rounded bg-muted/80 px-1">.planning/.gad-log/</code>. It measures
        active system usage plus live assignment state from <code className="rounded bg-muted/80 px-1">.planning/.gad-agent-lanes.json</code>, not just
        preserved eval runs.
      </p>
    </>
  );

  return (
    <Identified as="PlanningSystemRuntimeActivityPanel" cid="planning-system-runtime-activity-panel" register={false} depth={1}>
      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Monorepo runtime activity</p>
          <CardTitle className="text-base">What the root `.gad-log` is seeing right now</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={runtimeTab} onValueChange={setRuntimeTab} className="w-full">
            <TabsList className="mb-4 h-8 w-fit gap-px">
              <TabsTrigger value="overview" className="px-3 text-xs">
                Overview
              </TabsTrigger>
              <TabsTrigger value="live" className="px-3 text-xs">
                Live feed
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-0 space-y-5">
              {overview}
            </TabsContent>
            <TabsContent value="live" className="mt-0" forceMount>
              <PlanningLiveFeedTab liveEnabled={runtimeTab === "live"} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </Identified>
  );
}
