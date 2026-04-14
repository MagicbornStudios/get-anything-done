import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";
import type { RunHeroBaseProps } from "./run-hero-props";
import { RunHeroActionButtons } from "./RunHeroActionButtons";
import { RunHeroBackAndTitle } from "./RunHeroBackAndTitle";
import { RunHeroCallouts } from "./RunHeroCallouts";
import { RunHeroScoresBlock } from "./RunHeroScoresBlock";

export function RunHeroSection({
  run,
  playable,
  composite,
  humanScore,
  gateKnown,
  divergent,
  rateLimited,
  apiInterrupted,
  rateLimitNote,
  interruptionNote,
}: RunHeroBaseProps) {
  return (
    <SiteSection cid="run-hero-section-site-section">
      <Identified as="RunHero">
      <Identified as="RunHeroBackAndTitle">
        <RunHeroBackAndTitle
          run={run}
          gateKnown={gateKnown}
          rateLimited={rateLimited}
          apiInterrupted={apiInterrupted}
        />
      </Identified>

      <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <Identified as="RunHeroScoresAndCallouts" className="min-w-0">
          <Identified as="RunHeroScoresBlock">
            <RunHeroScoresBlock composite={composite} humanScore={humanScore} />
          </Identified>
          <Identified as="RunHeroCallouts">
            <RunHeroCallouts
              run={run}
              composite={composite}
              humanScore={humanScore}
              divergent={divergent}
              rateLimited={rateLimited}
              apiInterrupted={apiInterrupted}
              rateLimitNote={rateLimitNote}
              interruptionNote={interruptionNote}
            />
          </Identified>
        </Identified>
        <Identified as="RunHeroActionButtons">
          <RunHeroActionButtons run={run} playable={playable} />
        </Identified>
      </div>
      </Identified>
    </SiteSection>
  );
}
