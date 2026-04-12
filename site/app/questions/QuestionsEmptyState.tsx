import { SiteProse, SiteSection } from "@/components/site";

export function QuestionsEmptyState() {
  return (
    <SiteSection>
      <SiteProse size="sm">
        No open questions yet. Add entries to <code>data/open-questions.json</code> and re-run
        prebuild.
      </SiteProse>
    </SiteSection>
  );
}
