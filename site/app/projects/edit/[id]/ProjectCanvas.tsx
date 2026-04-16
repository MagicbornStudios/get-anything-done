"use client";

import { useMemo } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";
import type { EditorSelection } from "./ProjectEditor";

type SpeciesGroup = {
  species: string;
  contextFramework: string | null;
  runs: EvalRunRecord[];
  latest: EvalRunRecord | null;
};

function groupBySpecies(
  project: EvalProjectMeta,
  allProjects: EvalProjectMeta[],
  allRuns: EvalRunRecord[],
): SpeciesGroup[] {
  const projectSlug = project.project ?? project.id.split("/")[0];
  const speciesRows = allProjects.filter(
    (p) => (p.project ?? p.id.split("/")[0]) === projectSlug,
  );

  return speciesRows.map((sp) => {
    const runs = allRuns
      .filter((r) => r.project === sp.project && r.species === sp.species)
      .sort((a, b) => {
        const va = parseInt(a.version.replace("v", ""), 10);
        const vb = parseInt(b.version.replace("v", ""), 10);
        return vb - va;
      });
    return {
      species: sp.species ?? sp.workflow ?? "default",
      contextFramework: sp.contextFramework,
      runs,
      latest: runs[0] ?? null,
    };
  });
}

function SpeciesCard({
  group,
  selected,
  onSelectSpecies,
  onSelectGeneration,
}: {
  group: SpeciesGroup;
  selected: boolean;
  onSelectSpecies: () => void;
  onSelectGeneration: (version: string) => void;
}) {
  return (
    // cid prototype: project-editor-species-card-<species>-site-section
    <SiteSection
      cid={`project-editor-species-card-${group.species}-site-section` as const}
      sectionShell={false}
      className={cn(
        "border rounded-lg transition-colors cursor-pointer",
        selected
          ? "border-accent/60 bg-accent/5"
          : "border-border/60 bg-card/30 hover:bg-card/50",
      )}
    >
      <div className="p-4" onClick={onSelectSpecies}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{group.species}</h3>
            <p className="text-xs text-muted-foreground">
              {group.contextFramework ?? "no framework"} &middot;{" "}
              {group.runs.length} generation{group.runs.length !== 1 ? "s" : ""}
            </p>
          </div>
          {group.latest && (
            <span className="text-xs font-mono text-muted-foreground">
              latest: {group.latest.version}
            </span>
          )}
        </div>

        {/* Generation grid (brood) */}
        {group.runs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {group.runs.map((run) => (
              // cid prototype: project-editor-generation-chip-<species>-<version>-site-section
              <button
                key={run.version}
                type="button"
                onClick={() => onSelectGeneration(run.version)}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-mono transition-colors",
                  "border border-border/40 hover:border-accent/60 hover:bg-accent/10",
                )}
              >
                {run.version}
                {run.traceSchemaVersion >= 4 && (
                  <span className="text-[9px] text-emerald-400" title="trace v4+">
                    &#x2022;
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {group.runs.length === 0 && (
          <p className="mt-3 text-[10px] text-muted-foreground/50">
            No generations yet
          </p>
        )}
      </div>
    </SiteSection>
  );
}

export function ProjectCanvas({
  project,
  allProjects,
  allRuns,
  selection,
  onSelect,
}: {
  project: EvalProjectMeta;
  allProjects: EvalProjectMeta[];
  allRuns: EvalRunRecord[];
  selection: EditorSelection;
  onSelect: (s: EditorSelection) => void;
}) {
  const species = useMemo(
    () => groupBySpecies(project, allProjects, allRuns),
    [project, allProjects, allRuns],
  );

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {project.name?.split("/")[0] ?? project.id}
        </h2>
        <p className="text-xs text-muted-foreground">
          {species.length} species &middot;{" "}
          {species.reduce((n, s) => n + s.runs.length, 0)} total generations
        </p>
      </div>

      {/* Species grid */}
      <SiteSection
        cid="project-editor-species-grid-site-section"
        sectionShell={false}
        className="border-b-0"
      >
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {species.map((g) => (
            <SpeciesCard
              key={g.species}
              group={g}
              selected={
                (selection.kind === "species" || selection.kind === "generation") &&
                selection.species === g.species
              }
              onSelectSpecies={() =>
                onSelect({ kind: "species", species: g.species })
              }
              onSelectGeneration={(version) =>
                onSelect({ kind: "generation", species: g.species, version })
              }
            />
          ))}
          {species.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              No species defined for this project yet.
            </p>
          )}
        </div>
      </SiteSection>
    </div>
  );
}
