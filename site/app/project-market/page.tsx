export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { MarketingShell } from "@/components/site";
import ProjectMarket from "@/components/project-market/ProjectMarket";
import {
  DEFAULT_PROJECT_ID,
  REGISTERED_PROJECTS,
} from "@/lib/project-config";
import { EVAL_PROJECTS } from "@/lib/eval-data";
import { DevCatalogBanner } from "@/components/dev/DevCatalogBanner";

export const metadata: Metadata = {
  title: "Project Market - GAD",
  description:
    "Browse all projects and species: games, video, software, and tooling. Play any scored build in your browser.",
};

// Task 44-30: when ?projectid= names a project that has eval rows, collapse
// the marketplace to that project's species. For the default framework id
// (no EVAL_PROJECTS rows) show the full marketplace untouched.
type PageSearchParams = Promise<{ projectid?: string | string[] }>;

export default async function ProjectMarketPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const rawProjectId = resolvedSearchParams?.projectid;
  const paramId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  const currentProject =
    paramId && REGISTERED_PROJECTS.some((p) => p.id === paramId)
      ? paramId
      : DEFAULT_PROJECT_ID;
  const hasEvalRows = EVAL_PROJECTS.some((p) => p.project === currentProject);
  const scopeProject = hasEvalRows ? currentProject : null;
  return (
    <MarketingShell>
      <DevCatalogBanner />
      <ProjectMarket scopeProject={scopeProject} />
    </MarketingShell>
  );
}
