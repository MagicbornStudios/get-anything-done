"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Rocket, Loader2, X, AlertTriangle, FolderOpen, FileCheck2, PauseCircle } from "lucide-react";
import { Identified } from "gad-visual-context";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";

type LogLine = { stream: "stdout" | "stderr" | "meta"; text: string };
type LaunchState =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "running"; lines: LogLine[] }
  | { kind: "done"; lines: LogLine[]; code: number | null }
  | { kind: "err"; lines: LogLine[]; message: string };

type PreservedBuild = {
  path: string;
  fileCount: number;
  sizeBytes: number;
  version: string;
} | null;

export type ProjectOperatorProps = {
  projectName: string;
  speciesName?: string;
  preservedBuild: PreservedBuild;
  latestGeneration?: { version: string; hasBuild: boolean; hasTrace: boolean } | null;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectOperator(props: ProjectOperatorProps) {
  const { projectName, preservedBuild, latestGeneration } = props;
  const [state, setState] = useState<LaunchState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalLines, setTerminalLines] = useState<LogLine[]>([]);
  const [terminalRunning, setTerminalRunning] = useState(false);
  const terminalAbortRef = useRef<AbortController | null>(null);
  const terminalLogRef = useRef<HTMLDivElement | null>(null);
  const terminalSurfaceRef = useRef<HTMLDivElement | null>(null);

  // Autoscroll terminal on new lines.
  useEffect(() => {
    if (state.kind === "running" || state.kind === "done" || state.kind === "err") {
      const el = logRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [state]);

  useEffect(() => {
    const el = terminalLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [terminalLines, terminalRunning]);

  useEffect(() => {
    if (!terminalSurfaceRef.current) return;
    terminalSurfaceRef.current.focus();
  }, []);

  const handleRun = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    const lines: LogLine[] = [];
    setState({ kind: "running", lines });

    try {
      const res = await fetch("/api/dev/launch-eval", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ projectId: projectName }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        setState({ kind: "err", lines, message: errText || `HTTP ${res.status}` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent = "message";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          currentEvent = "message";
          let dataStr = "";
          for (const rawLine of block.split("\n")) {
            if (rawLine.startsWith("event:")) currentEvent = rawLine.slice(6).trim();
            else if (rawLine.startsWith("data:")) dataStr += rawLine.slice(5).trim();
          }
          if (!dataStr) continue;
          let data: unknown;
          try { data = JSON.parse(dataStr); } catch { continue; }

          if (currentEvent === "stdout" || currentEvent === "stderr") {
            const line = (data as { line?: string }).line ?? "";
            lines.push({ stream: currentEvent, text: line });
            setState({ kind: "running", lines: [...lines] });
          } else if (currentEvent === "start") {
            const cmd = (data as { command?: string }).command ?? "";
            lines.push({ stream: "meta", text: `$ ${cmd}` });
            setState({ kind: "running", lines: [...lines] });
          } else if (currentEvent === "exit") {
            const code = (data as { code?: number | null }).code ?? null;
            setState({ kind: "done", lines: [...lines], code });
          } else if (currentEvent === "error") {
            const message = (data as { message?: string }).message ?? "error";
            setState({ kind: "err", lines: [...lines], message });
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        setState({ kind: "err", lines, message: "aborted" });
      } else {
        setState({ kind: "err", lines, message: err instanceof Error ? err.message : "network error" });
      }
    } finally {
      abortRef.current = null;
    }
  }, [projectName]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClear = useCallback(() => {
    setState({ kind: "idle" });
  }, []);

  const runTerminalCommand = useCallback(async () => {
    const command = terminalCommand.trim();
    if (!command || terminalRunning) return;

    const controller = new AbortController();
    terminalAbortRef.current = controller;
    setTerminalRunning(true);
    setTerminalLines((prev) => [...prev, { stream: "meta", text: `$ ${command}` }]);

    try {
      const res = await fetch("/api/dev/terminal", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ command }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        setTerminalLines((prev) => [...prev, { stream: "stderr", text: errText || `HTTP ${res.status}` }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent = "message";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          currentEvent = "message";
          let dataStr = "";
          for (const rawLine of block.split("\n")) {
            if (rawLine.startsWith("event:")) currentEvent = rawLine.slice(6).trim();
            else if (rawLine.startsWith("data:")) dataStr += rawLine.slice(5).trim();
          }
          if (!dataStr) continue;
          let data: unknown;
          try { data = JSON.parse(dataStr); } catch { continue; }

          if (currentEvent === "stdout" || currentEvent === "stderr") {
            const line = (data as { line?: string }).line ?? "";
            const streamType: LogLine["stream"] = currentEvent;
            setTerminalLines((prev) => [...prev, { stream: streamType, text: line }]);
          } else if (currentEvent === "exit") {
            const code = (data as { code?: number | null }).code ?? null;
            setTerminalLines((prev) => [...prev, { stream: "meta", text: `— exited (${code ?? "null"})` }]);
          } else if (currentEvent === "error") {
            const message = (data as { message?: string }).message ?? "error";
            setTerminalLines((prev) => [...prev, { stream: "stderr", text: message }]);
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setTerminalLines((prev) => [
          ...prev,
          { stream: "stderr", text: err instanceof Error ? err.message : "network error" },
        ]);
      } else {
        setTerminalLines((prev) => [...prev, { stream: "meta", text: "— aborted" }]);
      }
    } finally {
      terminalAbortRef.current = null;
      setTerminalRunning(false);
    }
  }, [terminalCommand, terminalRunning]);

  const abortTerminalCommand = useCallback(() => {
    terminalAbortRef.current?.abort();
  }, []);

  const clearTerminal = useCallback(() => {
    setTerminalLines([]);
  }, []);

  const isRunning = state.kind === "running";
  const showLogs = state.kind === "running" || state.kind === "done" || state.kind === "err";
  const lines = showLogs ? state.lines : [];

  return (
    <SiteSection cid="project-operator-dev-controls-site-section">
      <Identified as="ProjectOperator" cid="project-operator-dev-controls" className="mx-auto max-w-6xl py-2">
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent p-5">
          {/* Header: dev-mode callout */}
          <Identified as="ProjectOperatorHeader" cid="project-operator-dev-controls-header" className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-200">
                Operator controls (dev only)
              </h2>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              NODE_ENV=development
            </span>
          </Identified>

          {/* Status strip: preserved build + latest generation */}
          <Identified as="ProjectOperatorStatusStrip" cid="project-operator-dev-controls-status-strip" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Identified as="ProjectOperatorPreservedBuildCard" cid="project-operator-preserved-build-card" className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <FileCheck2 size={11} aria-hidden />
                Preserved build
              </div>
              {preservedBuild ? (
                <div className="space-y-0.5">
                  <div className="font-mono text-xs text-emerald-300">
                    {preservedBuild.version} · {preservedBuild.fileCount} files · {formatBytes(preservedBuild.sizeBytes)}
                  </div>
                  <div className="break-all font-mono text-[10px] text-muted-foreground">
                    {preservedBuild.path}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No preserved static build. Run an eval with{" "}
                  <code className="rounded bg-black/30 px-1 py-0.5">gad eval preserve</code>{" "}
                  after a successful build.
                </div>
              )}
            </Identified>

            <Identified as="ProjectOperatorLatestGenerationCard" cid="project-operator-latest-generation-card" className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <FolderOpen size={11} aria-hidden />
                Latest generation
              </div>
              {latestGeneration ? (
                <div className="space-y-0.5">
                  <div className="font-mono text-xs text-foreground">{latestGeneration.version}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {latestGeneration.hasTrace ? "trace ✓" : "trace ✗"} ·{" "}
                    {latestGeneration.hasBuild ? "build ✓" : "build ✗"}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No generations yet.</div>
              )}
            </Identified>
          </Identified>

          {/* Action row */}
          <Identified as="ProjectOperatorActions" cid="project-operator-dev-controls-actions" className="mb-3 flex flex-wrap items-center gap-2">
            {state.kind === "idle" && (
              <button
                type="button"
                onClick={() => setState({ kind: "confirm" })}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                <Rocket size={12} aria-hidden />
                Run new eval
              </button>
            )}
            {state.kind === "confirm" && (
              <>
                <span className="text-xs text-amber-200">
                  This will scaffold a NEW eval generation via{" "}
                  <code className="rounded bg-black/30 px-1 py-0.5 font-mono">
                    gad eval run --project {projectName} --execute
                  </code>
                  . It does NOT run the agent — it just produces the EXEC.json spec.
                </span>
                <button
                  type="button"
                  onClick={handleRun}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/60 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
                >
                  <Rocket size={12} aria-hidden />
                  Confirm run
                </button>
                <button
                  type="button"
                  onClick={() => setState({ kind: "idle" })}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-card/40"
                >
                  Cancel
                </button>
              </>
            )}
            {isRunning && (
              <>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                  Running… {lines.length} lines captured
                </span>
                <button
                  type="button"
                  onClick={handleAbort}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                >
                  <PauseCircle size={12} aria-hidden />
                  Abort
                </button>
              </>
            )}
            {(state.kind === "done" || state.kind === "err") && (
              <>
                {state.kind === "done" && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    Exit code {state.code ?? "null"}
                  </span>
                )}
                {state.kind === "err" && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                    <X size={12} aria-hidden />
                    {state.message}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-card/40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setState({ kind: "confirm" })}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Rocket size={12} aria-hidden />
                  Run again
                </button>
              </>
            )}
          </Identified>

          {/* Terminal panel */}
          <Identified
            as="ProjectOperatorTerminal"
            cid="project-operator-dev-controls-terminal"
            className="rounded-lg border border-border/60 bg-black/60"
          >
            <div
              ref={logRef}
              className="h-80 overflow-auto p-3 font-mono text-[11px] leading-relaxed"
            >
              {!showLogs && (
                <div className="text-muted-foreground">
                  Terminal idle. Output from <code>gad eval run</code> will stream here.
                </div>
              )}
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "whitespace-pre-wrap",
                    line.stream === "stderr" && "text-rose-300",
                    line.stream === "stdout" && "text-emerald-100",
                    line.stream === "meta" && "text-amber-300",
                  )}
                >
                  {line.text || "\u00a0"}
                </div>
              ))}
              {state.kind === "done" && (
                <div className="pt-2 text-muted-foreground">
                  — process exited with code {state.code ?? "null"}
                </div>
              )}
              {state.kind === "err" && (
                <div className="pt-2 text-rose-400">— {state.message}</div>
              )}
            </div>
          </Identified>

          <Identified
            as="ProjectOperatorInteractiveTerminal"
            cid="project-operator-interactive-terminal"
            className="mt-4 rounded-lg border border-border/60 bg-card/40 p-3"
          >
            <Identified
              as="ProjectOperatorInteractiveTerminalControls"
              cid="project-operator-interactive-terminal-controls"
              className="mb-2 flex flex-wrap items-center gap-2"
            >
              <span className="text-[10px] text-muted-foreground">
                Click terminal, type command, press Enter.
              </span>
              <button
                type="button"
                onClick={() => void runTerminalCommand()}
                disabled={terminalRunning || !terminalCommand.trim()}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {terminalRunning ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Rocket size={12} aria-hidden />}
                Run
              </button>
              <button
                type="button"
                onClick={abortTerminalCommand}
                disabled={!terminalRunning}
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PauseCircle size={12} aria-hidden />
                Abort
              </button>
              <button
                type="button"
                onClick={clearTerminal}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-card/40"
              >
                Clear
              </button>
            </Identified>

            <Identified
              as="ProjectOperatorInteractiveTerminalOutput"
              cid="project-operator-interactive-terminal-output"
              className="rounded-md border border-border/60 bg-black/60"
            >
              <div
                ref={(node) => {
                  terminalSurfaceRef.current = node;
                  terminalLogRef.current = node;
                }}
                tabIndex={0}
                onClick={() => terminalSurfaceRef.current?.focus()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runTerminalCommand();
                    return;
                  }
                  if (e.key === "Backspace") {
                    e.preventDefault();
                    setTerminalCommand((prev) => prev.slice(0, -1));
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setTerminalCommand("");
                    return;
                  }
                  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    setTerminalCommand((prev) => prev + e.key);
                  }
                }}
                className="h-72 overflow-auto p-3 font-mono text-[11px] leading-relaxed outline-none ring-0 focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {terminalLines.length === 0 ? (
                  <div className="text-muted-foreground">Interactive terminal idle. Run a command to begin.</div>
                ) : null}
                {terminalLines.map((line, i) => (
                  <div
                    key={`term-${i}`}
                    className={cn(
                      "whitespace-pre-wrap",
                      line.stream === "stderr" && "text-rose-300",
                      line.stream === "stdout" && "text-emerald-100",
                      line.stream === "meta" && "text-amber-300",
                    )}
                  >
                    {line.text || "\u00a0"}
                  </div>
                ))}
                <div className="mt-1 flex items-center gap-1 text-emerald-200">
                  <span>{terminalRunning ? "…" : ">"}</span>
                  <span className={cn("min-w-0 break-all", terminalRunning && "opacity-60")}>
                    {terminalCommand}
                    <span className="inline-block h-3 w-[1px] animate-pulse bg-emerald-200 align-middle" aria-hidden />
                  </span>
                </div>
              </div>
            </Identified>
          </Identified>
        </div>
      </Identified>
    </SiteSection>
  );
}
