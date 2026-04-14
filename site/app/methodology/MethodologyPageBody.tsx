"use client";

/**
 * Page-level dev-id registry for `/methodology`. `Identified` only registers when it
 * sits under a `SectionRegistryProvider`; that provider normally lives inside each
 * `SiteSection`, so bands wrapped from `page.tsx` need this outer shell + panel.
 */

import type { EvalRunRecord } from "@/lib/eval-data";
import { Identified } from "@/components/devid/Identified";
import { SectionRegistryProvider } from "@/components/devid/SectionRegistry";
import { SectionDevPanel } from "@/components/devid/SectionDevPanel";
import { MethodologyAgentRuntimesSection } from "@/app/methodology/MethodologyAgentRuntimesSection";
import { MethodologyCompositeSection } from "@/app/methodology/MethodologyCompositeSection";
import { MethodologyDataPipelineSection } from "@/app/methodology/MethodologyDataPipelineSection";
import { MethodologyGateSection } from "@/app/methodology/MethodologyGateSection";
import { MethodologyHero } from "@/app/methodology/MethodologyHero";
import { MethodologyLineageSection } from "@/app/methodology/MethodologyLineageSection";
import { MethodologyTemplateMatrixSection } from "@/app/methodology/MethodologyTemplateMatrixSection";
import { MethodologyWorkedExamplesSection } from "@/app/methodology/MethodologyWorkedExamplesSection";
import { MethodologyCliReviewSection } from "@/app/methodology/MethodologyCliReviewSection";
import { MethodologyOpenQuestionsSection } from "@/app/methodology/MethodologyOpenQuestionsSection";

export function MethodologyPageBody({ worked }: { worked: EvalRunRecord[] }) {
  return (
    <SectionRegistryProvider maxDepth={4}>
      <div className="relative isolate">
        <SectionDevPanel />
        <Identified as="MethodologyPageIntro">
          <MethodologyHero />
        </Identified>
        <Identified as="MethodologyPageCompositeSection">
          <MethodologyCompositeSection />
        </Identified>
        <Identified as="MethodologyPageGateSection">
          <MethodologyGateSection />
        </Identified>
        <Identified as="MethodologyPageDataPipelineSection">
          <MethodologyDataPipelineSection />
        </Identified>
        <Identified as="MethodologyPageAgentRuntimesSection">
          <MethodologyAgentRuntimesSection />
        </Identified>
        <Identified as="MethodologyPageWorkedExamplesSection">
          <MethodologyWorkedExamplesSection worked={worked} />
        </Identified>
        <Identified as="MethodologyPageLineageSection">
          <MethodologyLineageSection />
        </Identified>
        <Identified as="MethodologyPageTemplateMatrixSection">
          <MethodologyTemplateMatrixSection />
        </Identified>
        <Identified as="MethodologyPageCliReviewSection">
          <MethodologyCliReviewSection />
        </Identified>
        <Identified as="MethodologyPageOpenQuestionsSection">
          <MethodologyOpenQuestionsSection />
        </Identified>
      </div>
    </SectionRegistryProvider>
  );
}
