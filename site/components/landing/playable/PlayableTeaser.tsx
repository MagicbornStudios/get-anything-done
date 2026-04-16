"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { EVAL_RUNS, PLAYABLE_INDEX } from "@/lib/eval-data";
import type { EvalRunRecord } from "@/lib/eval-data";
import { Button } from "@/components/ui/button";
import { PlayableEmbedBlock } from "@/components/landing/playable/PlayableEmbedBlock";
import { PlayableDocModal } from "@/components/landing/playable/PlayableDocModal";
import {
  runKey,
  WORKFLOW_TINT,
  reviewStateFor,
  REVIEW_STATE_DOT,
  REVIEW_STATE_LABEL,
  roundColor,
} from "@/components/landing/playable/playable-shared";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import { WORKFLOW_LABELS } from "@/lib/eval-data";
import { cn } from "@/lib/utils";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionIntro } from "@/components/site";

/**
 * Teaser version of Playable for the home page.
 * Shows only a handful of highlighted runs (latest ETD round + explainer)
 * with a prominent link to the full /project-market.
 */
export default function PlayableTeaser() {
  const teaserRuns = useMemo<EvalRunRecord[]>(() => {
    const playable = EVAL_RUNS.filter((r) => PLAYABLE_INDEX[runKey(r)]);

    const etdProjects = [
      "escape-the-dungeon",
      "escape-the-dungeon-bare",
      "escape-the-dungeon-emergent",
    ];
    const etdRuns = playable.filter((r) => etdProjects.includes(r.project));

    let latestRoundNum = 0;
    for (const r of etdRuns) {
      const round = roundForRun(r);
      if (round) {
        const num = parseInt(round.replace("Evolution ", ""), 10) || 0;
        if (num > latestRoundNum) latestRoundNum = num;
      }
    }
    const latestRound = latestRoundNum > 0 ? `Evolution ${latestRoundNum}` : null;

    const etdLatest = latestRound
      ? etdRuns.filter((r) => roundForRun(r) === latestRound)
      : etdRuns.slice(-3);

    const explainerRuns = playable.filter((r) =>
      r.project.startsWith("gad-explainer-video"),
    );

    return [...etdLatest, ...explainerRuns].sort((a, b) => {
      if (a.project !== b.project) return a.project.localeCompare(b.project);
      const av = parseInt(a.version.slice(1), 10) || 0;
      const bv = parseInt(b.version.slice(1), 10) || 0;
      return av - bv;
    });
  }, []);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [modal, setModal] = useState<"requirements" | "skill" | null>(null);

  const selected = useMemo(() => {
    if (selectedKey) {
      return teaserRuns.find((r) => runKey(r) === selectedKey) ?? teaserRuns[0] ?? null;
    }
    const defaultRun = teaserRuns.find(
      (r) => r.project === "escape-the-dungeon-bare",
    );
    return defaultRun ?? teaserRuns[0] ?? null;
  }, [teaserRuns, selectedKey]);

  if (teaserRuns.length === 0) return null;

  const iframeSrc = selected ? PLAYABLE_INDEX[runKey(selected)] : null;

  return (
    <SiteSection id="play" cid="play-site-section" tone="muted" className="border-t border-border/60">
      <Identified as="LandingPlayableTeaser">
      <Identified as="PlayableTeaserIntro">
        <SiteSectionIntro
          kicker="Playable archive"
          preset="hero-compact"
          title={
            <>
              Live embeds from the archive. <span className="gradient-text">Pick a build.</span>
            </>
          }
        >
          This is the on-page slice of the generation archive — pick a scored build, load the iframe,
          and jump into requirements or skill text without leaving the landing route. The project market
          still lists all {EVAL_RUNS.length}+ generations when you need the full catalog.
        </SiteSectionIntro>
      </Identified>

      <Identified as="PlayableTeaserRunPicker" className="mt-6 flex flex-wrap gap-2">
        {teaserRuns.map((r) => {
          const key = runKey(r);
          const active = selected && runKey(selected) === key;
          const state = reviewStateFor(r);
          const round = roundForRun(r);
          return (
            <Button
              key={key}
              type="button"
              variant="ghost"
              onClick={() => setSelectedKey(key)}
              className={cn(
                "group h-auto gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-none",
                active
                  ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20 hover:bg-accent/90 hover:text-accent-foreground"
                  : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60 hover:text-foreground",
              )}
            >
              <span
                className={`size-2 shrink-0 rounded-full ${REVIEW_STATE_DOT[state]}`}
                aria-label={REVIEW_STATE_LABEL[state]}
              />
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                  active
                    ? "border-background/40 bg-background/20 text-accent-foreground"
                    : WORKFLOW_TINT[r.workflow],
                )}
              >
                {WORKFLOW_LABELS[r.workflow]}
              </span>
              <span>{r.project.replace("escape-the-dungeon", "etd")}</span>
              <span className="tabular-nums">{r.version}</span>
              {round && (
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                    active
                      ? "border-background/30 text-accent-foreground/80"
                      : roundColor(round),
                  )}
                >
                  {round.replace("Evolution ", "E")}
                </span>
              )}
            </Button>
          );
        })}
      </Identified>

      {selected && iframeSrc && (
        <Identified as="PlayableEmbedBlock">
          <PlayableEmbedBlock
            selected={selected}
            iframeSrc={iframeSrc}
            onOpenRequirements={() => setModal("requirements")}
            onOpenSkill={() => setModal("skill")}
          />
        </Identified>
      )}

      <Identified as="PlayableTeaserMarketCta" className="mt-8 flex justify-center">
        <Button
          size="lg"
          className="rounded-full bg-accent px-8 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 hover:bg-accent/90"
          asChild
        >
          <Link href="/project-market">
            <Gamepad2 size={16} aria-hidden />
            Browse all projects
            <ArrowRight size={16} aria-hidden />
          </Link>
        </Button>
      </Identified>

      <Identified as="PlayableDocModal">
        <PlayableDocModal
          modal={modal}
          selected={selected}
          onOpenChange={(open) => {
            if (!open) setModal(null);
          }}
        />
      </Identified>
      </Identified>
    </SiteSection>
  );
}


