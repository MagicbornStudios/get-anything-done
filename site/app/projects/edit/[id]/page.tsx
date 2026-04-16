import { createRequire } from "node:module";
import path from "node:path";
import { notFound } from "next/navigation";
import { ProjectEditor } from "./ProjectEditor";
import { loadAllProjectMeta, loadAllRunRecords } from "../eval-data-runtime";

export const dynamic = "force-dynamic";

function getDataAccess() {
  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..");
  const dynamicRequire = createRequire(path.join(repoRoot, "lib", "package.json"));
  return dynamicRequire("./eval-data-access.cjs");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const da = getDataAccess();
  const project = da.getProject(id);
  const humanName = project?.name ?? id;
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
  const EVAL_PROJECTS = loadAllProjectMeta();
  const EVAL_RUNS = loadAllRunRecords();

  const project = EVAL_PROJECTS.find((p) => p.id === id || p.project === id);
  if (!project) notFound();

  const projectSlug = project.project ?? project.id.split("/")[0];
  const allProjectSpecies = EVAL_PROJECTS.filter(
    (p) => (p.project ?? p.id.split("/")[0]) === projectSlug,
  );
  const allRuns = EVAL_RUNS.filter((r) => r.project === projectSlug);

  const da = getDataAccess();
  const projectCfg = da.getProject(projectSlug);
  const projectDisplayName = projectCfg?.name ?? projectSlug;

  return (
    <ProjectEditor
      project={project}
      projectDisplayName={projectDisplayName}
      allProjects={allProjectSpecies}
      allRuns={allRuns}
    />
  );
}
