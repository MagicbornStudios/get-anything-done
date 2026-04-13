"use client";

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

export function ProjectCard({ project }: Props) {
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

        <div className="flex items-center gap-2 pt-1">
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
