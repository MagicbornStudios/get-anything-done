import Link from "next/link";
import { Download, FileArchive, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  findPlanning,
  findTemplate,
  formatBytes,
  latestRun,
  projectRuns,
  type ProjectCard,
} from "@/components/landing/projects/projects-shared";
import { PROJECT_LABELS, WORKFLOW_LABELS, playableUrl } from "@/lib/eval-data";

type Props = {
  project: ProjectCard;
};

export function ProjectEvalCard({ project: p }: Props) {
  const runs = projectRuns(p.project);
  const latest = latestRun(p.project);
  const template = findTemplate(p.project);
  const planning = findPlanning(p.project);
  const playable = latest ? playableUrl(latest) : null;

  return (
    <Card className="flex h-full flex-col transition-colors hover:border-accent/60">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge variant="outline">{WORKFLOW_LABELS[p.workflow]}</Badge>
          {p.status === "planned" ? (
            <Badge variant="outline" className="border-amber-500/40 text-amber-300">
              planned
            </Badge>
          ) : (
            <Badge variant="success">active</Badge>
          )}
        </div>
        <CardTitle className="text-lg">
          <Button variant="link" className="h-auto p-0 text-lg font-semibold text-foreground hover:text-accent" asChild>
            <Link href={`/projects/${p.project}`}>{PROJECT_LABELS[p.project] ?? p.project}</Link>
          </Button>
        </CardTitle>
        <CardDescription className="font-mono text-[11px]">{p.project}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm leading-6 text-muted-foreground">{p.description}</p>

        {runs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {runs.map((r) => (
              <Button
                key={r.version}
                variant="outline"
                size="sm"
                className="h-auto gap-1 rounded-full border-border/70 bg-background/50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground hover:border-accent/60 hover:text-accent [&_svg]:size-2.5"
                asChild
              >
                <Link href={`/runs/${r.project}/${r.version}`}>
                  {r.version}
                  {r.humanReview?.score != null && (
                    <span className="text-accent">· {r.humanReview.score.toFixed(2)}</span>
                  )}
                </Link>
              </Button>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-4 text-[11px]">
          {planning && (
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1.5 rounded-full border-border/70 bg-background/50 px-3 py-1.5 font-semibold text-foreground hover:border-accent hover:text-accent [&_svg]:size-2.5"
              asChild
            >
              <a href={planning.zipPath} download>
                <Download size={10} aria-hidden />
                Planning ({formatBytes(planning.bytes)})
              </a>
            </Button>
          )}
          {template && (
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1.5 rounded-full border-border/70 bg-background/50 px-3 py-1.5 font-semibold text-muted-foreground hover:border-accent hover:text-accent [&_svg]:size-2.5"
              asChild
            >
              <a href={template.zipPath} download>
                <FileArchive size={10} aria-hidden />
                Template
              </a>
            </Button>
          )}
          {playable && (
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1.5 rounded-full border-accent/40 bg-accent/10 px-3 py-1.5 font-semibold text-accent hover:bg-accent/20 [&_svg]:size-2.5"
              asChild
            >
              <a href={playable} target="_blank" rel="noopener noreferrer">
                <Play size={10} aria-hidden />
                Play latest
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
