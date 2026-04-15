"use client";

import { useEffect, useState } from "react";
import { ROUND_SUMMARIES } from "@/lib/eval-data";
import { Round4PressureCallout } from "@/components/landing/shared/Round4PressureCallout";
import { RoundResultsEmptyRound } from "@/components/landing/round-results/RoundResultsEmptyRound";
import { RoundResultsHeader } from "@/components/landing/round-results/RoundResultsHeader";
import { RoundResultsRoundConclusion } from "@/components/landing/round-results/RoundResultsRoundConclusion";
import { RoundResultsRunCard } from "@/components/landing/round-results/RoundResultsRunCard";
import { RoundResultsTbdSection } from "@/components/landing/round-results/RoundResultsTbdSection";
import { useRoundResultsRuns } from "@/components/landing/round-results/use-round-results-runs";
import { SiteSection } from "@/components/site";

export default function RoundResults() {
  const [globalRoundFilter, setGlobalRoundFilter] = useState<string | null>(null);

  useEffect(() => {
    const onRound = (e: Event) => {
      setGlobalRoundFilter((e as CustomEvent<string | null>).detail);
    };
    window.addEventListener("round-filter", onRound);
    return () => window.removeEventListener("round-filter", onRound);
  }, []);

  const [localRoundFilter, setLocalRoundFilter] = useState<string | null>(null);

  const effectiveRound = localRoundFilter ?? globalRoundFilter;
  const { displayRuns, tbdRuns } = useRoundResultsRuns(effectiveRound);

  const roundSummary = effectiveRound
    ? ROUND_SUMMARIES.find((s) => s.round === effectiveRound)
    : null;

  return (
    <SiteSection id="results" cid="results-site-section" tone="muted" className="border-t border-border/60">
      <RoundResultsHeader
        effectiveRound={effectiveRound}
        localRoundFilter={localRoundFilter}
        globalRoundFilter={globalRoundFilter}
        onLocalRoundChange={setLocalRoundFilter}
      />

      {displayRuns.length > 0 && (
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {displayRuns.map((run) => (
            <RoundResultsRunCard key={`${run.project}-${run.version}`} run={run} />
          ))}
        </div>
      )}

      <RoundResultsTbdSection runs={tbdRuns} />

      {displayRuns.length === 0 && tbdRuns.length === 0 && effectiveRound && (
        <RoundResultsEmptyRound roundLabel={effectiveRound} />
      )}

      {effectiveRound && roundSummary && (
        <RoundResultsRoundConclusion roundLabel={effectiveRound} summary={roundSummary} />
      )}

      {!effectiveRound && <Round4PressureCallout />}
    </SiteSection>
  );
}

