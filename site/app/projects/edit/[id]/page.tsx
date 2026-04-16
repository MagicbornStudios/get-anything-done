import { notFound } from "next/navigation";
import { EVAL_PROJECTS } from "@/lib/eval-data";
import { ProjectEditor } from "./ProjectEditor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = EVAL_PROJECTS.find((p) => p.id === id || p.project === id);
  if (!project) return { title: "Project not found" };
  return { title: `Edit — ${project.name}` };
}

export default async function ProjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Step 1: dev gate — reject prod at module boundary
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { id } = await params;
  const project = EVAL_PROJECTS.find((p) => p.id === id || p.project === id);
  if (!project) notFound();

  return <ProjectEditor project={project} />;
}
