import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROJECT_LABELS, WORKFLOW_LABELS } from "@/lib/eval-data";
import type { RunHeroBaseProps } from "./run-hero-props";

type RunHeroBackAndTitleProps = Pick<
  RunHeroBaseProps,
  "run" | "gateKnown" | "rateLimited" | "apiInterrupted"
>;

export function RunHeroBackAndTitle({ run, gateKnown, rateLimited, apiInterrupted }: RunHeroBackAndTitleProps) {
  return (
    <>
      <Identified as="RunHeroBackLink">
        <Button
          variant="ghost"
          className="mb-6 h-auto gap-2 px-0 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
          asChild
        >
          <Link href="/#results">
            <ArrowLeft size={14} aria-hidden />
            Back to results
          </Link>
        </Button>
      </Identified>

      <Identified as="RunHeroBadges" className="flex flex-wrap items-center gap-3">
        <Badge variant="default">{WORKFLOW_LABELS[run.workflow]}</Badge>
        <Badge variant="outline">{run.version}</Badge>
        <Badge variant="outline">requirements {run.requirementsVersion}</Badge>
        <Badge variant="outline">{run.date}</Badge>
        {gateKnown ? (
          run.requirementCoverage!.gate_failed ? (
            <Badge variant="danger">Gate failed</Badge>
          ) : (
            <Badge variant="success">Gate passed</Badge>
          )
        ) : (
          <Badge variant="outline">pre-gate requirements</Badge>
        )}
        {rateLimited && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-300">
            {"\u26A0"} rate limited — not comparable
          </Badge>
        )}
        {apiInterrupted && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-300">
            {"\u26A0"} API interrupted — not comparable
          </Badge>
        )}
      </Identified>

      <Identified as="RunHeroTitleBlock">
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
          {PROJECT_LABELS[run.project] ?? run.project}
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {run.project}/{run.version}
        </p>
      </Identified>
    </>
  );
}
