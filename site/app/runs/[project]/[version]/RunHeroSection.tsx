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
    <SiteSection>
      <RunHeroBackAndTitle
        run={run}
        gateKnown={gateKnown}
        rateLimited={rateLimited}
        apiInterrupted={apiInterrupted}
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <RunHeroScoresBlock composite={composite} humanScore={humanScore} />
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
        </div>
        <RunHeroActionButtons run={run} playable={playable} />
      </div>
    </SiteSection>
  );
}
