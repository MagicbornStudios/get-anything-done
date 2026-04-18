import { PlanningAppRedirectStub } from "@/components/site";

export const metadata = {
  title: "Planning moved to planning-app — GAD",
  description:
    "The /planning dashboard moved to the local planning-app (gad planning serve). Landing route ships as a deprecation stub for one release cycle.",
};

export default function PlanningDeprecatedPage() {
  return (
    <PlanningAppRedirectStub
      cid="planning-deprecated-stub"
      surface="Planning dashboard"
      targetPath="/planning"
      summary="The cross-project planning hub — Tasks, Decisions, Requirements, Notes, Workflows, SkillCandidates, System — now lives on the local planning-app. Run it on your machine to see live state; the landing site no longer hosts this view."
    />
  );
}
