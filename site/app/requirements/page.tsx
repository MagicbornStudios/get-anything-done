import { RequirementsHero } from "@/app/requirements/RequirementsHero";
import { MarketingShell } from "@/components/site";
import { RequirementsProjectEmptySection } from "@/app/requirements/RequirementsProjectEmptySection";
import { RequirementsProjectSection } from "@/app/requirements/RequirementsProjectSection";
import { RequirementsVersionHistorySection } from "@/app/requirements/RequirementsVersionHistorySection";
import { groupRequirementsByProject } from "@/app/requirements/requirements-shared";

export const metadata = {
  title: "Requirements — GAD",
  description:
    "Every eval project's current REQUIREMENTS.xml, version history, and the v5 addendum requirements as addressable anchors. Pressure is a first-class axis (decision gad-75).",
};

export default function RequirementsPage() {
  const byProject = groupRequirementsByProject();

  return (
    <MarketingShell>
      <RequirementsHero />

      {[...byProject.entries()].map(([project, files]) => {
        const file = files[0];
        if (!file?.content) {
          return <RequirementsProjectEmptySection key={project} project={project} />;
        }
        return <RequirementsProjectSection key={project} project={project} file={file} />;
      })}

      <RequirementsVersionHistorySection />
    </MarketingShell>
  );
}
