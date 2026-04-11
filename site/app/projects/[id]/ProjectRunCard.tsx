import Link from "next/link";
import { FileCode2, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCED_ARTIFACTS, playableUrl, type EvalRunRecord } from "@/lib/eval-data";

export function ProjectRunCard({ run }: { run: EvalRunRecord }) {
  const composite = run.scores.composite ?? 0;
  const human = run.humanReview?.score ?? null;
  const playable = playableUrl(run);
  const produced = PRODUCED_ARTIFACTS[`${run.project}/${run.version}`];

  return (
    <Card className="transition-colors hover:border-accent/60">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <Badge variant="default">{run.version}</Badge>
          <Badge variant="outline">reqs {run.requirementsVersion}</Badge>
        </div>
        <CardTitle className="mt-2 text-lg">composite {composite.toFixed(3)}</CardTitle>
        <CardDescription>
          {human != null ? `human ${human.toFixed(2)}` : "human review pending"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {run.humanReview?.notes && (
          <p className="line-clamp-3 text-xs text-muted-foreground">{run.humanReview.notes}</p>
        )}
        {produced && (
          <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
            {produced.skillFiles.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-emerald-300">
                <FileCode2 size={9} aria-hidden />
                {produced.skillFiles.length} skill{produced.skillFiles.length === 1 ? "" : "s"}
              </span>
            )}
            {produced.agentFiles.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/5 px-2 py-0.5 text-sky-300">
                {produced.agentFiles.length} agent{produced.agentFiles.length === 1 ? "" : "s"}
              </span>
            )}
            {produced.planningFiles.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-amber-300">
                {produced.planningFiles.length} planning
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
          <Link
            href={`/runs/${run.project}/${run.version}`}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-semibold text-accent hover:underline"
          >
            full breakdown →
          </Link>
          {playable && (
            <a
              href={playable}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 font-semibold text-accent hover:bg-accent/20"
            >
              <Gamepad2 size={10} aria-hidden />
              play
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
