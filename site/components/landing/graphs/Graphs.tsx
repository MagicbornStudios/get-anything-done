import { GraphsDivergenceScatter } from "@/components/landing/graphs/GraphsDivergenceScatter";
import { GraphsIntro } from "@/components/landing/graphs/GraphsIntro";
import { GraphsProvenance } from "@/components/landing/graphs/GraphsProvenance";
import { GraphsRunsBarChart } from "@/components/landing/graphs/GraphsRunsBarChart";
import { barData, runsWithScores } from "@/components/landing/graphs/graphs-shared";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

/**
 * Interactive graphs section on the landing page.
 * Two charts:
 * 1. Divergence scatter (composite vs human review) — shows ALL hypotheses,
 *    color-coded by workflow. Points above the diagonal = human rates higher
 *    than automated composite. Points below = composite inflated.
 * 2. Per-run bar chart — all scored runs ordered by score, colored by workflow.
 *
 * Both recharts-based for interactivity (hover tooltips, click-through).
 */
export default function Graphs() {
  const scatterData = runsWithScores();
  const bars = barData();

  if (scatterData.length === 0 && bars.length === 0) return null;

  return (
    <SiteSection id="graphs" className="border-t border-border/60">
      <Identified as="LandingGraphs">
      <Identified as="GraphsIntro">
        <GraphsIntro />
      </Identified>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Identified as="GraphsDivergenceScatter">
          <GraphsDivergenceScatter scatterData={scatterData} />
        </Identified>
        <Identified as="GraphsRunsBarChart">
          <GraphsRunsBarChart bars={bars} />
        </Identified>
      </div>

      <Identified as="GraphsProvenance">
        <GraphsProvenance />
      </Identified>
      </Identified>
    </SiteSection>
  );
}
