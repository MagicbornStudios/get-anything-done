import { Identified } from "@/components/devid/Identified";
import { MarketingShell, SiteSection, SiteSectionHeading, SiteProse } from "@/components/site";
import { FormulasPressureSection } from "./FormulasPressureSection";
import { FormulasFrameworkOverheadSection } from "./FormulasFrameworkOverheadSection";
import { FormulasLoopComplianceSection } from "./FormulasLoopComplianceSection";
import { FormulasDataSourcesSection } from "./FormulasDataSourcesSection";

export const metadata = {
  title: "Formulas — how GAD measures phase pressure and framework overhead",
  description:
    "Every formula GAD uses to score itself: pressure, framework overhead, loop compliance. Shannon-inspired framing for phase complexity and cross-cutting concerns.",
};

export default function FormulasPage() {
  return (
    <MarketingShell>
      <SiteSection cid="formulas-page-site-section">
        <Identified as="FormulasPageIntro">
          <SiteSectionHeading
            kicker="Formulas"
            as="h1"
            preset="hero-compact"
            title={
              <>
                Every number on this site <span className="gradient-text">has a formula.</span>
              </>
            }
          />
          <SiteProse className="mt-5">
            GAD scores itself continuously by reading its own planning artifacts and trace logs. This page documents every
            formula the{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">compute-self-eval.mjs</code> pipeline uses —
            pressure, framework overhead, loop compliance, crosscut detection — with the exact weights currently in effect.
            Weights are configurable in{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">site/data/self-eval-config.json</code>.
          </SiteProse>
        </Identified>
      </SiteSection>

      <Identified as="FormulasPressureSection">
        <FormulasPressureSection />
      </Identified>
      <Identified as="FormulasFrameworkOverheadSection">
        <FormulasFrameworkOverheadSection />
      </Identified>
      <Identified as="FormulasLoopComplianceSection">
        <FormulasLoopComplianceSection />
      </Identified>
      <Identified as="FormulasDataSourcesSection">
        <FormulasDataSourcesSection />
      </Identified>
    </MarketingShell>
  );
}

