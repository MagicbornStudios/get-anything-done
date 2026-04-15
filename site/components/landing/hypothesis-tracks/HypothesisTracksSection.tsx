"use client";

import { useState, useCallback } from "react";
import { HypothesisTracksActiveRoundBar } from "@/components/landing/hypothesis-tracks/HypothesisTracksActiveRoundBar";
import { HypothesisTracksChartPanel } from "@/components/landing/hypothesis-tracks/HypothesisTracksChartPanel";
import { HypothesisTracksDomainSelector } from "@/components/landing/hypothesis-tracks/HypothesisTracksDomainSelector";
import { HypothesisTracksIntro } from "@/components/landing/hypothesis-tracks/HypothesisTracksIntro";
import { HypothesisTracksRelatedLinks } from "@/components/landing/hypothesis-tracks/HypothesisTracksRelatedLinks";
import { buildTrackData } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

/**
 * Landing-page section rendering the interactive hypothesis-tracks chart.
 * Clicking a round on the chart scrolls to and filters the Playable Archive.
 */
export default function HypothesisTracksSection() {
  const [selectedDomain, setSelectedDomain] = useState("escape-the-dungeon");
  const data = buildTrackData();
  const [activeRound, setActiveRound] = useState<string | null>(null);

  const handleRoundClick = useCallback(
    (round: string) => {
      const next = activeRound === round ? null : round;
      setActiveRound(next);

      if (next) {
        const roundNum = next.replace("Evolution ", "");
        window.history.replaceState(null, "", `#play?round=${roundNum}`);
        const el = document.getElementById("play");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        window.history.replaceState(null, "", window.location.pathname);
      }
      window.dispatchEvent(new CustomEvent("round-filter", { detail: next }));
    },
    [activeRound]
  );

  const clearRoundFilter = useCallback(() => {
    setActiveRound(null);
    window.history.replaceState(null, "", window.location.pathname);
    window.dispatchEvent(new CustomEvent("round-filter", { detail: null }));
  }, []);

  return (
    <SiteSection id="tracks" cid="tracks-site-section" tone="muted" className="border-t border-border/60">
      <Identified as="LandingHypothesisTracksSection">
      <Identified as="HypothesisTracksIntro">
        <HypothesisTracksIntro />
      </Identified>

      <Identified as="HypothesisTracksDomainSelector">
        <HypothesisTracksDomainSelector
          selectedDomain={selectedDomain}
          onSelectDomain={(domainId) => {
            setSelectedDomain(domainId);
            setActiveRound(null);
            window.dispatchEvent(new CustomEvent("domain-filter", { detail: domainId }));
          }}
        />
      </Identified>

      <Identified as="HypothesisTracksChartPanel">
        <HypothesisTracksChartPanel
          data={data}
          onRoundClick={handleRoundClick}
          activeRound={activeRound}
        />
      </Identified>

      {activeRound && (
        <Identified as="HypothesisTracksActiveRoundBar">
          <HypothesisTracksActiveRoundBar activeRound={activeRound} onClear={clearRoundFilter} />
        </Identified>
      )}

      <Identified as="HypothesisTracksRelatedLinks">
        <HypothesisTracksRelatedLinks />
      </Identified>
      </Identified>
    </SiteSection>
  );
}

