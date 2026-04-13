import { Identified } from "@/components/devid/Identified";
import Link from "next/link";
import { FileCode2, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <Identified as="ProjectRunCardHeaderRow" className="flex items-center justify-between gap-3">
          <Badge variant="default">{run.version}</Badge>
          <Badge variant="outline">reqs {run.requirementsVersion}</Badge>
        </Identified>
        <Identified as="ProjectRunCardScores">
        <CardTitle className="mt-2 text-lg">composite {composite.toFixed(3)}</CardTitle>
        <CardDescription>
          {human != null ? `human ${human.toFixed(2)}` : "human review pending"}
        </CardDescription>
        </Identified>
      </CardHeader>
      <CardContent className="space-y-3">
        {run.humanReview?.notes ? (
          <Identified as="ProjectRunCardNotes" className="line-clamp-3 text-xs text-muted-foreground" tag="p">
            {run.humanReview.notes}
          </Identified>
        ) : null}
        {produced ? (
        <Identified as="ProjectRunCardProducedBadges" className="flex flex-wrap gap-1.5 text-[10px]">
            {produced.skillFiles.length > 0 && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 font-medium normal-case tracking-normal text-emerald-300"
              >
                <FileCode2 size={9} aria-hidden />
                {produced.skillFiles.length} skill{produced.skillFiles.length === 1 ? "" : "s"}
              </Badge>
            )}
            {produced.agentFiles.length > 0 && (
              <Badge
                variant="outline"
                className="border-sky-500/30 bg-sky-500/5 px-2 py-0.5 font-medium normal-case tracking-normal text-sky-300"
              >
                {produced.agentFiles.length} agent{produced.agentFiles.length === 1 ? "" : "s"}
              </Badge>
            )}
            {produced.planningFiles.length > 0 && (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/5 px-2 py-0.5 font-medium normal-case tracking-normal text-amber-300"
              >
                {produced.planningFiles.length} planning
              </Badge>
            )}
        </Identified>
        ) : null}
        <Identified as="ProjectRunCardActions" className="flex flex-wrap gap-2 pt-1 text-[11px]">
          <Button
            variant="outline"
            size="sm"
            className="h-auto rounded-full border-border/70 bg-background/50 px-3 py-1.5 font-semibold text-accent hover:text-accent"
            asChild
          >
            <Link href={`/runs/${run.project}/${run.version}`}>Full breakdown →</Link>
          </Button>
          {playable && (
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1 rounded-full border-accent/40 bg-accent/10 px-3 py-1.5 font-semibold text-accent hover:bg-accent/20 [&_svg]:size-2.5"
              asChild
            >
              <a href={playable} target="_blank" rel="noopener noreferrer">
                <Gamepad2 size={10} aria-hidden />
                Play
              </a>
            </Button>
          )}
        </Identified>
      </CardContent>
    </Card>
  );
}
