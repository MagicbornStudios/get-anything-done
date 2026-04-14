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

// Deterministic hash → 0..360 hue. Used to pick gradient colors per project
// so every card has a stable visual identity even without a real card image.
function hashHue(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

function gradientForProject(p: { id: string; domain: string; techStack?: string | null }): string {
  const h1 = hashHue(p.id, 0);
  const h2 = hashHue(p.id, 1337);
  // Domain nudges lightness so game cards feel different from writing cards.
  const lightByDomain: Record<string, number> = {
    game: 40, video: 35, software: 38, tooling: 42, planning: 30,
  };
  const l1 = lightByDomain[p.domain] ?? 38;
  return `linear-gradient(135deg, hsl(${h1} 70% ${l1}%) 0%, hsl(${h2} 65% ${Math.max(15, l1 - 18)}%) 100%)`;
}

function initialsForProject(name: string): string {
  const words = name.replace(/[\/_-]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0]?.slice(0, 2) ?? "??").toUpperCase();
}

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

      // EVAL_PROJECTS uses a composite `<project>/<species>` id; the CLI
      // wants just the project name.
      const projectName = project.project ?? project.id.split("/")[0];

      try {
        const res = await fetch("/api/dev/launch-eval", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify({ projectId: projectName }),
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
        "group relative flex flex-col overflow-hidden border-border/70 bg-card/40 shadow-none transition-all hover:border-accent/40 hover:bg-card/60 hover:shadow-lg hover:shadow-accent/5",
        project.featured && "ring-1 ring-accent/20",
      )}
    >
      {/* Gradient hero strip — deterministic per project id, serves as a
          placeholder card image until real cardImage is dropped in. */}
      <div
        className="relative aspect-[16/9] w-full overflow-hidden"
        style={{ background: gradientForProject(project) }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-5xl font-bold tracking-tight text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            {initialsForProject(project.name)}
          </span>
        </div>
        {project.featured && (
          <div className="absolute right-2 top-2">
            <Badge className="gap-1 border-amber-500/40 bg-amber-500/20 text-amber-200 backdrop-blur-sm">
              <Star size={10} className="fill-amber-400" aria-hidden />
              Featured
            </Badge>
          </div>
        )}
        {project.species && (
          <div className="absolute left-2 top-2">
            <Badge variant="outline" className="border-white/30 bg-black/30 text-[10px] uppercase tracking-wider text-white backdrop-blur-sm">
              {project.species}
            </Badge>
          </div>
        )}
        {(project.runCount > 0 || project.playableCount > 0) && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {project.runCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Gamepad2 size={10} aria-hidden />
                {project.runCount}
              </span>
            )}
            {project.playableCount > 0 && (
              <span className="text-emerald-300">▶ {project.playableCount}</span>
            )}
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("text-[10px] uppercase tracking-wider", DOMAIN_TINT[project.domain])}
          >
            {DOMAIN_LABELS[project.domain]}
          </Badge>
          {project.techStack && (
            <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-[10px] text-sky-300">
              {project.techStack}
            </Badge>
          )}
          {project.contextFramework && project.contextFramework !== project.species && (
            <Badge variant="outline" className="border-purple-500/40 bg-purple-500/10 text-[10px] text-purple-300">
              {project.contextFramework}
            </Badge>
          )}
          {project.workflow && project.workflow !== project.contextFramework && (
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
        </div>

        <h3 className="text-sm font-semibold leading-tight text-foreground">
          {project.name}
        </h3>

        {project.description && (
          <p className="line-clamp-2 flex-1 text-xs leading-5 text-muted-foreground">
            {project.description}
          </p>
        )}

        {project.latestRound && (
          <div className="text-[11px] text-muted-foreground">
            Latest: <span className="text-foreground">{project.latestRound}</span>
          </div>
        )}

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
