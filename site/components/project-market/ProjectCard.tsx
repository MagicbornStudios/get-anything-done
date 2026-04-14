"use client";

import { Identified } from "@/components/devid/Identified";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Star, Gamepad2, ExternalLink, Rocket, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DOMAIN_LABELS,
  DOMAIN_TINT,
  type EnrichedProject,
} from "@/components/project-market/project-market-shared";
import { WORKFLOW_TINT } from "@/components/landing/playable/playable-shared";
import type { Workflow } from "@/lib/eval-data";

type Props = {
  project: EnrichedProject;
};

const IS_DEV = process.env.NODE_ENV === "development";

type LogLine = { stream: "stdout" | "stderr" | "meta"; text: string };
type LaunchState =
  | { kind: "idle" }
  | { kind: "running"; lines: LogLine[] }
  | { kind: "done"; lines: LogLine[]; code: number | null }
  | { kind: "err"; lines: LogLine[]; message: string };

export function ProjectCard({ project }: Props) {
  const [launchState, setLaunchState] = useState<LaunchState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const handleLaunch = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (launchState.kind === "running") return;

      const controller = new AbortController();
      abortRef.current = controller;
      const lines: LogLine[] = [];
      setLaunchState({ kind: "running", lines });

      try {
        const res = await fetch("/api/dev/launch-eval", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify({ projectId: project.id }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          setLaunchState({ kind: "err", lines, message: errText || `HTTP ${res.status}` });
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
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (currentEvent === "stdout" || currentEvent === "stderr") {
              const line = (data as { line?: string }).line ?? "";
              lines.push({ stream: currentEvent, text: line });
              setLaunchState({ kind: "running", lines: [...lines] });
            } else if (currentEvent === "start") {
              const cmd = (data as { command?: string }).command ?? "";
              lines.push({ stream: "meta", text: `$ ${cmd}` });
              setLaunchState({ kind: "running", lines: [...lines] });
            } else if (currentEvent === "exit") {
              const code = (data as { code?: number | null }).code ?? null;
              setLaunchState({ kind: "done", lines: [...lines], code });
            } else if (currentEvent === "error") {
              const message = (data as { message?: string }).message ?? "error";
              setLaunchState({ kind: "err", lines: [...lines], message });
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          setLaunchState({ kind: "err", lines, message: "aborted" });
        } else {
          setLaunchState({
            kind: "err",
            lines,
            message: err instanceof Error ? err.message : "network error",
          });
        }
      } finally {
        abortRef.current = null;
      }
    },
    [launchState.kind, project.id],
  );

  const handleAbort = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    abortRef.current?.abort();
  }, []);

  return (
    <Identified as="ProjectCard" className="contents">
    <Card
      className={cn(
        "group relative overflow-hidden border-border/70 bg-card/40 shadow-none transition-colors hover:border-accent/40 hover:bg-card/60",
        project.featured && "ring-1 ring-accent/20",
      )}
    >
      {project.featured && (
        <div className="absolute right-3 top-3">
          <Badge className="gap-1 border-amber-500/40 bg-amber-500/15 text-amber-300">
            <Star size={10} className="fill-amber-400" aria-hidden />
            Featured
          </Badge>
        </div>
      )}
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("text-[10px] uppercase tracking-wider", DOMAIN_TINT[project.domain])}
          >
            {DOMAIN_LABELS[project.domain]}
          </Badge>
          {project.workflow && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase tracking-wider",
                WORKFLOW_TINT[project.workflow as Workflow] ?? "border-border/70 text-muted-foreground",
              )}
            >
              {project.workflow}
            </Badge>
          )}
          {project.evalMode && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border/50 text-muted-foreground">
              {project.evalMode}
            </Badge>
          )}
        </div>

        <h3 className="text-sm font-semibold leading-tight text-foreground pr-20">
          {project.name}
        </h3>

        {project.description && (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          {project.runCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Gamepad2 size={11} aria-hidden />
              {project.runCount} run{project.runCount !== 1 ? "s" : ""}
            </span>
          )}
          {project.playableCount > 0 && (
            <span className="inline-flex items-center gap-1 text-accent">
              {project.playableCount} playable
            </span>
          )}
          {project.latestRound && (
            <span>{project.latestRound}</span>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            View project
            <ExternalLink size={10} aria-hidden />
          </Link>
          {IS_DEV && (
            <>
              <button
                type="button"
                onClick={handleLaunch}
                disabled={launchState.kind === "running"}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                title="Dev-only: spawns `gad eval run --project <id> --execute` from the dev server and streams stdout/stderr back"
              >
                {launchState.kind === "running" ? (
                  <Loader2 size={10} className="animate-spin" aria-hidden />
                ) : (
                  <Rocket size={10} aria-hidden />
                )}
                Launch eval
              </button>
              {launchState.kind === "running" && (
                <button
                  type="button"
                  onClick={handleAbort}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
                  title="Abort the running child process"
                >
                  <X size={10} aria-hidden />
                  Abort
                </button>
              )}
            </>
          )}
        </div>
        {IS_DEV && launchState.kind !== "idle" && (
          <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border/60 bg-black/40 p-2 font-mono text-[10px] leading-relaxed">
            {launchState.lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  line.stream === "stderr" && "text-rose-300",
                  line.stream === "stdout" && "text-emerald-200",
                  line.stream === "meta" && "text-muted-foreground",
                )}
              >
                {line.text || "\u00a0"}
              </div>
            ))}
            {launchState.kind === "done" && (
              <div className="pt-1 text-muted-foreground">
                — process exited with code {launchState.code ?? "null"}
              </div>
            )}
            {launchState.kind === "err" && (
              <div className="pt-1 text-rose-400">— {launchState.message}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </Identified>
  );
}
