import { notFound } from "next/navigation";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import {
  EVAL_PROJECTS,
  EVAL_TEMPLATES,
  PLANNING_ZIPS,
} from "@/lib/eval-data";
import { ProjectEmergentLineageSection } from "@/app/projects/[id]/ProjectEmergentLineageSection";
import { ProjectHeroSection } from "@/app/projects/[id]/ProjectHeroSection";
import { ProjectRunsSection } from "@/app/projects/[id]/ProjectRunsSection";
import { ProjectScoringWeightsSection } from "@/app/projects/[id]/ProjectScoringWeightsSection";
import { ProjectSkillsScopeSection } from "@/app/projects/[id]/ProjectSkillsScopeSection";
import { projectRuns } from "@/app/projects/[id]/project-detail-shared";

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
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <ProjectHeroSection project={project} planning={planning} template={template} />
      <ProjectSkillsScopeSection project={project} />
      <ProjectRunsSection runs={runs} />
      {project.workflow === "emergent" && runs.length > 0 && (
        <ProjectEmergentLineageSection runs={runs} />
      )}
      <ProjectScoringWeightsSection project={project} />
      <Footer />
    </main>
  );
}
