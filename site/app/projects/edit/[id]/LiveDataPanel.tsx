"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";

type PlanningState = {
  phase?: string;
  status?: string;
  milestone?: string;
  tasks?: { planned: number; inProgress: number; done: number; total: number };
  decisions?: number;
  fileTimes?: Record<string, number>;
};

type ChangeEvent = {
  file: string;
  event: string;
  timestamp: number;
  size?: number;
};

type AgentSignal = {
  id: string;
  lastSeen: number;
  files: string[];
  inferredPhase: string | null;
};

export function LiveDataPanel() {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<PlanningState | null>(null);
  const [agents, setAgents] = useState<AgentSignal[]>([]);
  const [changes, setChanges] = useState<ChangeEvent[]>([]);
  const [expanded, setExpanded] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/dev/live");
    eventSourceRef.current = es;

    es.addEventListener("state", (e) => {
      try {
        setState(JSON.parse(e.data));
        setConnected(true);
      } catch { /* ignore */ }
    });

    es.addEventListener("change", (e) => {
      try {
        const change = JSON.parse(e.data);
        setChanges((prev) => [...prev.slice(-19), change]);
      } catch { /* ignore */ }
    });

    es.addEventListener("agents", (e) => {
      try {
        setAgents(JSON.parse(e.data));
      } catch { /* ignore */ }
    });

    es.addEventListener("cli-activity", (e) => {
      try {
        const activity = JSON.parse(e.data);
        setChanges((prev) => [...prev.slice(-19), { ...activity, file: `CLI: ${activity.file}` }]);
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  const ago = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  return (
    <SiteSection
      cid="project-editor-live-data-panel-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Live Data
            <span
              className={cn(
                "ml-1.5 inline-block h-1.5 w-1.5 rounded-full",
                connected ? "bg-emerald-400" : "bg-red-400",
              )}
            />
          </h2>
          <span className="text-[10px] text-muted-foreground/40">
            {expanded ? "▾" : "▸"}
          </span>
        </button>

        {expanded && (
          <div className="mt-2 space-y-3">
            {/* Current state */}
            {state && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Phase</span>
                  <span className="font-mono">{state.phase ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Milestone</span>
                  <span className="font-mono">{state.milestone ?? "—"}</span>
                </div>
                {state.tasks && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Tasks</span>
                    <span className="font-mono">
                      <span className="text-emerald-400">{state.tasks.done}d</span>
                      {" / "}
                      <span className="text-amber-400">{state.tasks.inProgress}ip</span>
                      {" / "}
                      <span className="text-muted-foreground">{state.tasks.planned}p</span>
                    </span>
                  </div>
                )}
                {state.decisions != null && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Decisions</span>
                    <span className="font-mono">{state.decisions}</span>
                  </div>
                )}
              </div>
            )}

            {/* Agent presence */}
            {agents.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase text-muted-foreground/60 mb-1">
                  Detected Agents ({agents.length})
                </h3>
                {agents.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-[10px] py-0.5"
                  >
                    <span className="font-mono text-accent">{a.id}</span>
                    <span className="text-muted-foreground">{ago(a.lastSeen)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recent changes */}
            {changes.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase text-muted-foreground/60 mb-1">
                  Recent Changes
                </h3>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {[...changes].reverse().map((c, i) => (
                    <div
                      key={`${c.timestamp}-${i}`}
                      className="flex items-center justify-between text-[10px]"
                    >
                      <span className="font-mono text-foreground/70 truncate max-w-[140px]">
                        {c.file}
                      </span>
                      <span className="text-muted-foreground/50 shrink-0">
                        {ago(c.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!connected && (
              <button
                type="button"
                onClick={connect}
                className="w-full rounded border border-border/40 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>
        )}
      </div>
    </SiteSection>
  );
}
