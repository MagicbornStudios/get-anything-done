import type { EvalRunRecord } from "@/lib/eval-data";
import type { EvalProjectMeta } from "@/lib/eval-data";
import { Identified } from "@/components/devid/Identified";
import { SKILLS } from "@/lib/catalog.generated";
import { scopedSkillsFor } from "./project-detail-shared";
import { latestProjectRun, buildProjectSkillScopeRows } from "./project-skill-scope-model";
import { ProjectSkillsScopeExplorer } from "./ProjectSkillsScopeExplorer";
import { PROJECT_SKILLS_SCOPE_SECTION_BAND_CID } from "./project-skills-scope-constants";
import { SiteSection, SiteSectionHeading } from "@/components/site";

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
  const { rows, latestVersion, hasPlayableBuild, hasTriggerTelemetry, catalogTotal } = buildProjectSkillScopeRows({
    scope,
    latestRun,
    skillsById,
  });

  return (
    <SiteSection cid={PROJECT_SKILLS_SCOPE_SECTION_BAND_CID} tone="muted">
      <Identified as="ProjectSkillsScopeHeading" cid="project-skills-scope-heading" className="block">
        <SiteSectionHeading kicker="Skills" preset="section" title="Catalog preview" />
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
          Tap a row to open the source. Usage bars only when the latest run lists expected triggers and has a playable
          build.
        </p>
      </Identified>

      <ProjectSkillsScopeExplorer
        rows={rows}
        latestVersion={latestVersion}
        hasPlayableBuild={hasPlayableBuild}
        hasTriggerTelemetry={hasTriggerTelemetry}
        catalogTotal={catalogTotal}
        scopeKind={scope.kind}
      />
    </SiteSection>
  );
}
