import { Round4PressureCallout } from "@/components/landing/shared/Round4PressureCallout";
import { ResultsIntro } from "@/components/landing/results/ResultsIntro";
import { ResultsRunCard } from "@/components/landing/results/ResultsRunCard";
import { RESULT_DISPLAY_RUNS } from "@/components/landing/results/results-shared";
import { SiteSection } from "@/components/site";

export default function Results() {
  return (
    <SiteSection id="results" tone="muted" className="border-t border-border/60">
      <ResultsIntro />

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {RESULT_DISPLAY_RUNS.map((run) => (
          <ResultsRunCard key={`${run.project}-${run.version}`} run={run} />
        ))}
      </div>

      <Round4PressureCallout />
    </SiteSection>
  );
}
