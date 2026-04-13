import { MarketingShell, SiteProse, SiteSection } from "@/components/site";
import { GLOSSARY } from "@/lib/eval-data";
import { GlossaryCategorySection } from "./GlossaryCategorySection";
import { GlossaryHeroSection } from "./GlossaryHeroSection";
import { GLOSSARY_CATEGORY_ORDER, groupGlossaryByCategory } from "./glossary-shared";

export const metadata = {
  title: "Glossary — GAD",
  description:
    "Every domain term used on this site. Compound-Skills Hypothesis, freedom hypothesis, emergent workflow, gate criterion, rubric, trace schema v4, and more.",
};

export default function GlossaryPage() {
  const grouped = groupGlossaryByCategory(GLOSSARY);
  const orderedCategories = GLOSSARY_CATEGORY_ORDER.filter((c) => grouped[c]?.length > 0);

  return (
    <MarketingShell>
      <GlossaryHeroSection orderedCategories={orderedCategories} grouped={grouped} />

      {orderedCategories.map((cat) => (
        <GlossaryCategorySection key={cat} cat={cat} terms={grouped[cat]} />
      ))}

      {GLOSSARY.length === 0 && (
        <SiteSection>
          <SiteProse size="sm">
            No glossary terms yet. Add entries to <code>data/glossary.json</code> and re-run prebuild.
          </SiteProse>
        </SiteSection>
      )}
    </MarketingShell>
  );
}
