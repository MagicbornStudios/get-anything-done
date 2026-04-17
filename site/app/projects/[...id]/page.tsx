import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/site";
import {
  EVAL_PROJECTS,
  EVAL_TEMPLATES,
  PLANNING_ZIPS,
} from "@/lib/eval-data";
import { ProjectBugsSection } from "./ProjectBugsSection";
import { ProjectDetailTabs } from "./ProjectDetailTabs";
import { ProjectEmergentLineageSection } from "./ProjectEmergentLineageSection";
import { ProjectFindingsSection } from "./ProjectFindingsSection";
import { ProjectHeroSection } from "./ProjectHeroSection";
import { ProjectOperator, type ProjectOperatorProps } from "./ProjectOperator";
import { ProjectRequirementsSection } from "./ProjectRequirementsSection";
import { ProjectRunsSection } from "./ProjectRunsSection";
import { ProjectScoringWeightsSection } from "./ProjectScoringWeightsSection";
import { ProjectSkillsScopeSection } from "./ProjectSkillsScopeSection";
import { ProjectStatsBar } from "./ProjectStatsBar";
import { projectRuns } from "./project-detail-shared";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Walk apps/portfolio/public/evals/<project>/ for the highest preserved
 * vN directory. Server-side only — runs at build time under static export
 * and at request time under the dev server. Safe because the site is not
 * statically exporting this route.
 */
function resolvePreservedBuild(projectName: string): ProjectOperatorProps["preservedBuild"] {
  // REPO_ROOT: site is at vendor/get-anything-done/site; walk up 3x.
  const repoRoot = path.resolve(process.cwd(), "..", "..", "..");
  const projectDir = path.join(repoRoot, "apps", "portfolio", "public", "evals", projectName);
  if (!fs.existsSync(projectDir)) return null;
  let latest: string | null = null;
  try {
    const entries = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => parseInt(b.slice(1), 10) - parseInt(a.slice(1), 10));
    latest = entries[0] ?? null;
  } catch {
    return null;
  }
  if (!latest) return null;
  const versionDir = path.join(projectDir, latest);
  let fileCount = 0;
  let sizeBytes = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) {
        fileCount += 1;
        try { sizeBytes += fs.statSync(p).size; } catch {}
      }
    }
  };
  try { walk(versionDir); } catch {}
  return { path: versionDir, fileCount, sizeBytes, version: latest };
}

function resolveLatestGeneration(projectName: string): ProjectOperatorProps["latestGeneration"] {
  const repoRoot = path.resolve(process.cwd(), "..", "..", "..");
  // Try both eval roots where generations can live.
  const candidates = [
    path.join(repoRoot, "apps", "forge", "evals", projectName),
    path.join(repoRoot, "evals", projectName),
    path.join(repoRoot, "vendor", "get-anything-done", "evals", projectName),
  ];
  for (const projectDir of candidates) {
    if (!fs.existsSync(projectDir)) continue;
    try {
      const versions = fs.readdirSync(projectDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
        .map((e) => e.name)
        .sort((a, b) => parseInt(b.slice(1), 10) - parseInt(a.slice(1), 10));
      if (versions.length === 0) continue;
      const latest = versions[0];
      const vDir = path.join(projectDir, latest);
      const hasTrace = fs.existsSync(path.join(vDir, "TRACE.json"));
      const hasBuild = fs.existsSync(path.join(vDir, "run"));
      return { version: latest, hasBuild, hasTrace };
    } catch {}
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string[] }>;
}) {
  const { id } = await params;
  const joined = Array.isArray(id) ? id.join("/") : String(id);
  const project = EVAL_PROJECTS.find((p) => p.id === joined);
  if (!project) return { title: "Project not found" };
  return {
    title: `${project.name} — GAD project`,
    description: project.description ?? "",
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string[] }>;
}) {
  const { id } = await params;
  const joined = Array.isArray(id) ? id.join("/") : String(id);
  const project = EVAL_PROJECTS.find((p) => p.id === joined);
  if (!project) notFound();

  const runs = projectRuns(project.id);
  const template = EVAL_TEMPLATES.find((t) => t.project === project.id);
  const planning = PLANNING_ZIPS.find((p) => p.project === project.id);

  // Dev-only operator panel: resolve preserved build + latest generation on
  // the server so the client component just renders state.
  const projectName = project.project ?? project.id.split("/")[0];
  const preservedBuild = IS_DEV ? resolvePreservedBuild(projectName) : null;
  const latestGeneration = IS_DEV ? resolveLatestGeneration(projectName) : null;

  // Marketing-landing composition (task 45-13):
  //   Hero → StatsBar (at-a-glance numbers) → Runs → Findings (whitepaper
  //   cards) → Requirements → Skills scope → Emergent lineage (if applicable)
  //   → Bugs → Scoring weights. Findings moved above Requirements so
  //   visitors see outcomes before inputs. Workflow visualization and VCS
  //   showcase are scoped out to a 45-13 follow-up.
  const overviewContent = (
    <>
      <ProjectHeroSection project={project} planning={planning} template={template} />
      <ProjectStatsBar projectName={projectName} runs={runs} />
      <ProjectRunsSection runs={runs} />
      <ProjectFindingsSection projectId={project.id} />
      <ProjectRequirementsSection projectId={project.id} />
      <ProjectSkillsScopeSection project={project} runs={runs} />
      {project.workflow === "emergent" && runs.length > 0 ? (
        <ProjectEmergentLineageSection runs={runs} />
      ) : null}
      <ProjectBugsSection projectId={project.id} />
      <ProjectScoringWeightsSection project={project} />
    </>
  );

  return (
    <MarketingShell>
      {IS_DEV && (
        <ProjectOperator
          projectName={projectName}
          speciesName={project.species}
          preservedBuild={preservedBuild}
          latestGeneration={latestGeneration}
        />
      )}
      <ProjectDetailTabs overviewContent={overviewContent} projectId={project.id} />
    </MarketingShell>
  );
}
