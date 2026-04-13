import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/site";
import {
  EVAL_PROJECTS,
  EVAL_TEMPLATES,
  PLANNING_ZIPS,
} from "@/lib/eval-data";
import { ProjectBugsSection } from "./ProjectBugsSection";
import { ProjectEmergentLineageSection } from "./ProjectEmergentLineageSection";
import { ProjectFindingsSection } from "./ProjectFindingsSection";
import { ProjectHeroSection } from "./ProjectHeroSection";
import { ProjectRequirementsSection } from "./ProjectRequirementsSection";
import { ProjectRunsSection } from "./ProjectRunsSection";
import { ProjectScoringWeightsSection } from "./ProjectScoringWeightsSection";
import { ProjectSkillsScopeSection } from "./ProjectSkillsScopeSection";
import { projectRuns } from "./project-detail-shared";

export const dynamicParams = false;

export function generateStaticParams() {
  return EVAL_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = EVAL_PROJECTS.find((p) => p.id === id);
  if (!project) return { title: "Project not found" };
  return {
    title: `${project.name} — GAD eval project`,
    description: project.description ?? "",
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = EVAL_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const runs = projectRuns(project.id);
  const template = EVAL_TEMPLATES.find((t) => t.project === project.id);
  const planning = PLANNING_ZIPS.find((p) => p.project === project.id);

  return (
    <MarketingShell>
      <ProjectHeroSection project={project} planning={planning} template={template} />
      <ProjectSkillsScopeSection project={project} />
      <ProjectRunsSection runs={runs} />
      {project.workflow === "emergent" && runs.length > 0 ? (
        <ProjectEmergentLineageSection runs={runs} />
      ) : null}
      <ProjectRequirementsSection projectId={project.id} />
      <ProjectFindingsSection projectId={project.id} />
      <ProjectBugsSection projectId={project.id} />
      <ProjectScoringWeightsSection project={project} />
    </MarketingShell>
  );
}
