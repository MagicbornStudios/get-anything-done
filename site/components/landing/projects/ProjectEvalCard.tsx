import Link from "next/link";
import { Download, FileArchive, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
          <Link href={`/projects/${p.project}`} className="transition-colors hover:text-accent">
            {PROJECT_LABELS[p.project] ?? p.project}
          </Link>
        </CardTitle>
        <CardDescription className="font-mono text-[11px]">{p.project}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm leading-6 text-muted-foreground">{p.description}</p>

        {runs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {runs.map((r) => (
              <Link
                key={r.version}
                href={`/runs/${r.project}/${r.version}`}
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent"
              >
                {r.version}
                {r.humanReview?.score != null && (
                  <span className="text-accent">· {r.humanReview.score.toFixed(2)}</span>
                )}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-4 text-[11px]">
          {planning && (
            <a
              href={planning.zipPath}
              download
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Download size={10} aria-hidden />
              planning ({formatBytes(planning.bytes)})
            </a>
          )}
          {template && (
            <a
              href={template.zipPath}
              download
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <FileArchive size={10} aria-hidden />
              template
            </a>
          )}
          {playable && (
            <a
              href={playable}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 font-semibold text-accent transition-colors hover:bg-accent/20"
            >
              <Play size={10} aria-hidden />
              play latest
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
