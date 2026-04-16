"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import { useCommandBridge } from "./use-command-bridge";

type Phase = "eval-run" | "preserve" | "idle";

export function GenerationRunner({
  projectId,
  speciesName,
  nextVersion,
  onComplete,
  onClose,
}: {
  projectId: string;
  speciesName: string;
  /** Next version string, e.g. "v5". Caller computes from existing runs. */
  nextVersion: string;
  onComplete: () => void;
  onClose: () => void;
}) {
  const bridge = useCommandBridge();
  const [phase, setPhase] = useState<Phase>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const preserveTriggered = useRef(false);

  // Auto-scroll terminal output
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bridge.state]);

  // When eval run finishes with code 0, auto-trigger preserve
  useEffect(() => {
    if (
      phase === "eval-run" &&
      bridge.state.kind === "done" &&
      bridge.state.code === 0 &&
      !preserveTriggered.current
    ) {
      preserveTriggered.current = true;
      setPhase("preserve");
      bridge.run({
        subcommand: "eval",
        args: ["preserve", projectId, nextVersion, "--from", "latest"],
        projectId,
      });
    }
  }, [phase, bridge.state, bridge, projectId, nextVersion]);

  // When preserve finishes, signal completion
  useEffect(() => {
    if (phase === "preserve" && bridge.state.kind === "done" && bridge.state.code === 0) {
      onComplete();
    }
  }, [phase, bridge.state, onComplete]);

  const handleStart = useCallback(() => {
    preserveTriggered.current = false;
    setPhase("eval-run");
    bridge.run({
      subcommand: "eval",
      args: ["run", projectId, "--species", speciesName],
      projectId,
    });
  }, [bridge, projectId, speciesName]);

  const handleAbort = useCallback(() => {
    bridge.abort();
  }, [bridge]);

  const isRunning = bridge.state.kind === "running";
  const isDone = bridge.state.kind === "done";
  const isError = bridge.state.kind === "error";
  const lines = bridge.state.kind !== "idle" ? bridge.state.lines : [];
  const exitCode = bridge.state.kind === "done" ? bridge.state.code : null;
  const errorMessage = bridge.state.kind === "error" ? bridge.state.message : null;

  return (
    <SiteSection
      cid="species-generate-runner-site-section"
      sectionShell={false}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="flex flex-col w-full max-w-3xl max-h-[80vh] rounded-xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight">
              Generate: {speciesName}
            </h3>
            {phase !== "idle" && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider",
                  phase === "eval-run" && isRunning && "bg-blue-500/15 text-blue-400",
                  phase === "preserve" && isRunning && "bg-amber-500/15 text-amber-400",
                  isDone && exitCode === 0 && "bg-emerald-500/15 text-emerald-400",
                  (isError || (isDone && exitCode !== 0)) && "bg-red-500/15 text-red-400",
                )}
              >
                {isRunning && phase === "eval-run" && "running eval"}
                {isRunning && phase === "preserve" && "preserving"}
                {isDone && exitCode === 0 && phase === "preserve" && "complete"}
                {isDone && exitCode === 0 && phase === "eval-run" && "preserving..."}
                {isDone && exitCode !== 0 && `exit ${exitCode}`}
                {isError && "error"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <button
                type="button"
                onClick={handleAbort}
                className="rounded border border-red-500/40 px-2 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Abort
              </button>
            )}
            {!isRunning && (
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-border/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Terminal output */}
        <div
          ref={scrollRef}
          data-cid="species-generate-runner-terminal"
          className="flex-1 overflow-y-auto bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed min-h-[200px]"
        >
          {lines.length === 0 && bridge.state.kind === "idle" && (
            <p className="text-zinc-500">
              Ready to generate {speciesName} {nextVersion} for {projectId}.
            </p>
          )}
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap break-all",
                line.stream === "stderr" ? "text-red-400/80" : "text-zinc-300",
              )}
            >
              {line.text}
            </div>
          ))}
          {isRunning && (
            <span className="inline-block w-2 h-3.5 bg-zinc-400 animate-pulse ml-0.5" />
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
          <span className="text-[10px] text-muted-foreground font-mono">
            {projectId} / {speciesName} / {nextVersion}
          </span>
          {bridge.state.kind === "idle" && (
            <button
              type="button"
              onClick={handleStart}
              className="rounded bg-accent/90 px-3 py-1 text-xs font-medium text-accent-foreground hover:bg-accent transition-colors"
            >
              Start Generation
            </button>
          )}
          {isError && errorMessage && (
            <span className="text-[10px] text-red-400 font-mono">
              {errorMessage}
            </span>
          )}
        </div>
      </div>
    </SiteSection>
  );
}
