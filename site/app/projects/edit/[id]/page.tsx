import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { EVAL_PROJECTS, EVAL_RUNS } from "@/lib/eval-data";
import { ProjectEditor } from "./ProjectEditor";

export const dynamic = "force-dynamic";

/** Read the human-readable name from evals/<slug>/project.json */
function resolveProjectName(slug: string): string | null {
  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..");
  const projectJson = path.join(repoRoot, "evals", slug, "project.json");
  try {
    if (fs.existsSync(projectJson)) {
      const data = JSON.parse(fs.readFileSync(projectJson, "utf8"));
      return data.name ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = EVAL_PROJECTS.find((p) => p.id === id || p.project === id);
  if (!project) return { title: "Project not found" };
  const slug = project.project ?? project.id.split("/")[0];
  const humanName = resolveProjectName(slug) ?? slug;
  return { title: `Edit — ${humanName}` };
}

export default async function ProjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { id } = await params;
  const project = EVAL_PROJECTS.find((p) => p.id === id || p.project === id);
  if (!project) notFound();

  const projectSlug = project.project ?? project.id.split("/")[0];
  const allProjectSpecies = EVAL_PROJECTS.filter(
    (p) => (p.project ?? p.id.split("/")[0]) === projectSlug,
  );
  const allRuns = EVAL_RUNS.filter((r) => r.project === projectSlug);

  // Resolve human-readable project name from project.json
  const projectDisplayName = resolveProjectName(projectSlug) ?? projectSlug;

  return (
    <ProjectEditor
      project={project}
      projectDisplayName={projectDisplayName}
      allProjects={allProjectSpecies}
      allRuns={allRuns}
    />
  );
}
