import type { EvalRunRecord } from "@/lib/eval-data";
import { PROJECT_FAMILIES } from "@/components/landing/playable/playable-shared";
import type { PlayableRunGroup } from "@/components/landing/playable/PlayableRunGroups";
import { domainForProject, type ProjectDomain } from "@/components/project-market/project-market-shared";

/** Group filtered runs by project family for the project-market playable strip. */
export function buildProjectMarketPlayableGroups(
  runs: EvalRunRecord[],
  domainFilter: ProjectDomain | null,
): PlayableRunGroup[] {
  const families = domainFilter
    ? PROJECT_FAMILIES.filter((f) =>
        f.projects.some((pid) => domainForProject(pid) === domainFilter),
      )
    : PROJECT_FAMILIES;

  const groupedRuns: PlayableRunGroup[] = families.map((family) => ({
    id: family.id,
    label: family.label,
    description: family.description,
    runs: runs.filter((r) => family.projects.includes(r.project)),
  }));

  const familyProjectIds = new Set(PROJECT_FAMILIES.flatMap((f) => f.projects));
  const ungroupedRuns = runs.filter((r) => !familyProjectIds.has(r.project));

  return [
    ...groupedRuns,
    ...(ungroupedRuns.length > 0
      ? [
          {
            id: "other",
            label: "Other projects",
            description: "Additional eval runs",
            runs: ungroupedRuns,
          },
        ]
      : []),
  ];
}
