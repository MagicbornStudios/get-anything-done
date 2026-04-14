import { Identified } from "@/components/devid/Identified";
import Link from "next/link";
import { Star, Gamepad2, ExternalLink } from "lucide-react";
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

export function ProjectCard({ project }: Props) {

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
        </div>
      </CardContent>
    </Card>
    </Identified>
  );
}
