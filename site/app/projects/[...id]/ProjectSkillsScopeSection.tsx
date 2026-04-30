import type { EvalRunRecord } from "@/lib/eval-data";
import type { EvalProjectMeta } from "@/lib/eval-data";
import { BROOD_SKILL_AGGREGATION } from "@/lib/eval-data";
import { Identified } from "gad-visual-context";
import { SKILLS } from "@/lib/catalog.generated";
import { scopedSkillsFor } from "./project-detail-shared";
import { latestProjectRun, buildProjectSkillScopeRows } from "./project-skill-scope-model";
import { ProjectSkillsScopeExplorer } from "./ProjectSkillsScopeExplorer";
import { PROJECT_SKILLS_SCOPE_SECTION_BAND_CID } from "./project-skills-scope-constants";
import { SiteSection, SiteSectionHeading } from "@/components/site";

/** Resolve the brood aggregation bag for a project (or the parent project when viewing a species). */
function broodAggregationFor(project: EvalProjectMeta): Record<string, number> {
  // Species rows have id like "escape-the-dungeon/gad"; try the parent project first.
  const parentProject = project.project ?? project.id.split("/")[0] ?? project.id;
  return BROOD_SKILL_AGGREGATION[parentProject] ?? BROOD_SKILL_AGGREGATION[project.id] ?? {};
}

export function ProjectSkillsScopeSection({
  project,
  runs,
}: {
  project: EvalProjectMeta;
  runs: EvalRunRecord[];
}) {
  const scope = scopedSkillsFor({ workflow: project.workflow, id: project.id });
  const skillsById = new Map(SKILLS.map((s) => [s.id, s] as const));
  const latestRun = latestProjectRun(runs);
  const broodAggregation = broodAggregationFor(project);
  const { rows, latestVersion, hasPlayableBuild, hasTriggerTelemetry, hasBroodTelemetry, catalogTotal, broodTotal } = buildProjectSkillScopeRows({
    scope,
    latestRun,
    skillsById,
    broodAggregation,
  });

  return (
    <SiteSection cid={PROJECT_SKILLS_SCOPE_SECTION_BAND_CID} tone="muted">
      <Identified as="ProjectSkillsScopeHeading" cid="project-skills-scope-heading" className="block">
        <SiteSectionHeading kicker="Skills" preset="section" title="Catalog preview" />
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
          Tap a row to open the source. Usage bars only when the latest run lists expected triggers and has a playable
          build.
          {hasBroodTelemetry ? ` Invocation counts aggregated from ${broodTotal} skill trigger(s) across all generations.` : null}
        </p>
      </Identified>

      <ProjectSkillsScopeExplorer
        rows={rows}
        latestVersion={latestVersion}
        hasPlayableBuild={hasPlayableBuild}
        hasTriggerTelemetry={hasTriggerTelemetry}
        hasBroodTelemetry={hasBroodTelemetry}
        catalogTotal={catalogTotal}
        scopeKind={scope.kind}
      />
    </SiteSection>
  );
}
