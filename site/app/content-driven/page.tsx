import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
import { ContentDrivenFramingSection } from "./ContentDrivenFramingSection";
import { ContentDrivenHeroSection } from "./ContentDrivenHeroSection";
import { ContentDrivenMeasureSection } from "./ContentDrivenMeasureSection";
import { ContentDrivenRelatedSection } from "./ContentDrivenRelatedSection";
import { ContentDrivenStatusSection } from "./ContentDrivenStatusSection";

export const metadata = {
  title: "Content-Driven Hypothesis — GAD",
  description:
    "Planned eval track: content-pack injection. Given requirements AND a pre-authored content pack extracted from prior runs, does an agent produce a more fleshed-out game? Analogous to making a movie based on a book.",
};

export default function ContentDrivenPage() {
  return (
    <MarketingShell>
      <Identified as="ContentDrivenHeroSection">
        <ContentDrivenHeroSection />
      </Identified>
      <Identified as="ContentDrivenMeasureSection">
        <ContentDrivenMeasureSection />
      </Identified>
      <Identified as="ContentDrivenFramingSection">
        <ContentDrivenFramingSection />
      </Identified>
      <Identified as="ContentDrivenStatusSection">
        <ContentDrivenStatusSection />
      </Identified>
      <Identified as="ContentDrivenRelatedSection">
        <ContentDrivenRelatedSection />
      </Identified>
    </MarketingShell>
  );
}
