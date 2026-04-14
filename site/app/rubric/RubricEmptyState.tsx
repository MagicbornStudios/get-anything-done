import { SiteProse, SiteSection } from "@/components/site";

export function RubricEmptyState() {
  return (
    <SiteSection cid="rubric-empty-state-site-section">
      <SiteProse size="sm">
        No projects have a human review rubric defined yet. Add a{" "}
        <code>human_review_rubric</code> block to a project&apos;s <code>gad.json</code> and regenerate
        site data.
      </SiteProse>
    </SiteSection>
  );
}

