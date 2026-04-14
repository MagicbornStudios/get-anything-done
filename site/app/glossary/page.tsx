import { MarketingShell, SiteSection, SiteSectionHeading, SiteProse } from "@/components/site";
import { GLOSSARY } from "@/lib/eval-data";
import GlossaryIndex from "./GlossaryIndex";

export const metadata = {
  title: "Glossary — GAD",
  description:
    "Searchable glossary of GAD terms, workflow vocabulary, eval concepts, and framework language.",
};

export default function GlossaryPage() {
  const terms = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));

  return (
    <MarketingShell>
      <SiteSection>
        <SiteSectionHeading
          kicker="Glossary"
          as="h1"
          preset="hero-compact"
          title="Searchable index of framework terms"
        />
        <SiteProse className="mt-5 max-w-3xl">
          This page is meant to be functional: short definitions, stable anchors, alias search, and category filters.
          It is the shared vocabulary surface for GAD terminology.
        </SiteProse>
        <GlossaryIndex terms={terms} />
      </SiteSection>
    </MarketingShell>
  );
}
