"use client";

import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RunInfoPanel } from "@/components/landing/playable/RunInfoPanel";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import {
  fmtTokensShort,
  reviewStateFor,
  REVIEW_STATE_DOT,
  REVIEW_STATE_LABEL,
  roundColor,
  runKey,
  WORKFLOW_TINT,
} from "@/components/landing/playable/playable-shared";
import { WORKFLOW_LABELS, type EvalRunRecord } from "@/lib/eval-data";
import { cn } from "@/lib/utils";

export type PlayableRunGroup = {
  id: string;
  label: string;
  description: string;
  runs: EvalRunRecord[];
};

type Props = {
  groupedRuns: PlayableRunGroup[];
  selected: EvalRunRecord | null;
  onSelectRun: (key: string) => void;
};

export function PlayableRunGroups({ groupedRuns, selected, onSelectRun }: Props) {
  return (
    <>
      {groupedRuns.map((group) => {
        if (group.runs.length === 0) return null;
        return (
          <div key={group.id} className="mt-6">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
              <span className="text-[11px] text-muted-foreground">{group.description}</span>
              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {group.runs.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.runs.map((r) => {
                const key = runKey(r);
                const active = selected && runKey(selected) === key;
                const state = reviewStateFor(r);
                const round = roundForRun(r);
                return (
                  <HoverCard key={key} openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onSelectRun(key)}
                        className={cn(
                          "group h-auto gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-none",
                          active
                            ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20 hover:bg-accent/90 hover:text-accent-foreground"
                            : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60 hover:text-foreground"
                        )}
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${REVIEW_STATE_DOT[state]}`}
                          aria-label={REVIEW_STATE_LABEL[state]}
                        />
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            active ? "border-background/40 bg-background/20 text-accent-foreground" : WORKFLOW_TINT[r.workflow],
                          ].join(" ")}
                        >
                          {WORKFLOW_LABELS[r.workflow]}
                        </span>
                        <span>{r.project.replace("escape-the-dungeon", "etd")}</span>
                        <span className="tabular-nums">{r.version}</span>
                        {round && (
                          <span className={[
                            "rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                            active
                              ? "border-background/30 text-accent-foreground/80"
                              : roundColor(round),
                          ].join(" ")}>
                            {round.replace("Evolution ", "E")}
                          </span>
                        )}
                        {r.tokenUsage?.total_tokens != null && (
                          <span className={[
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                            active
                              ? "text-accent-foreground/60"
                              : "text-muted-foreground/60",
                          ].join(" ")}>
                            {fmtTokensShort(r.tokenUsage.total_tokens)}
                          </span>
                        )}
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent side="bottom" align="start" className="w-80">
                      <RunInfoPanel r={r} />
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
