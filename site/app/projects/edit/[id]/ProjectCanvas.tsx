"use client";

import { useCallback, useMemo, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";
import type { EditorSelection } from "./ProjectEditor";
import { GenerationRunner } from "./GenerationRunner";

type SpeciesGroup = {
  species: string;
  contextFramework: string | null;
  runs: EvalRunRecord[];
  latest: EvalRunRecord | null;
};

/** Hash a species name to a stable index 0..5 for gradient presets. */
function speciesGradientIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 6;
}

const GRADIENT_PRESETS = [
  "from-violet-600/40 to-indigo-900/40",
  "from-emerald-600/40 to-teal-900/40",
  "from-amber-600/40 to-orange-900/40",
  "from-rose-600/40 to-pink-900/40",
  "from-cyan-600/40 to-blue-900/40",
  "from-fuchsia-600/40 to-purple-900/40",
];

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
  onGenerate,
}: {
  group: SpeciesGroup;
  selected: boolean;
  onSelectSpecies: () => void;
  onSelectGeneration: (version: string) => void;
  onGenerate: () => void;
}) {
  const gradientClass = GRADIENT_PRESETS[speciesGradientIndex(group.species)];

  return (
    // cid prototype: project-editor-species-card-<species>-site-section
    <SiteSection
      cid={`project-editor-species-card-${group.species}-site-section` as const}
      sectionShell={false}
      className={cn(
        "rounded-xl transition-all cursor-pointer overflow-hidden",
        "border-2 shadow-md hover:shadow-lg",
        selected
          ? "border-accent/70 bg-accent/5 ring-1 ring-accent/30"
          : "border-border/40 bg-card/20 hover:bg-card/40 hover:border-border/60",
      )}
    >
      <div onClick={onSelectSpecies}>
        {/* Gradient placeholder image area */}
        <div
          data-cid={`project-editor-species-art-${group.species}`}
          className={cn(
            "h-20 bg-gradient-to-br flex items-end justify-between px-3 pb-2",
            gradientClass,
          )}
        >
          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
            {group.species.slice(0, 3)}
          </span>
          <div className="flex items-center gap-1">
            {/* Generation count badge */}
            <span className="inline-flex items-center rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-mono text-white/80 backdrop-blur-sm">
              {group.runs.length} gen{group.runs.length !== 1 ? "s" : ""}
            </span>
            {/* Latest version badge */}
            {group.latest && (
              <span className="inline-flex items-center rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-mono text-accent backdrop-blur-sm">
                {group.latest.version}
              </span>
            )}
          </div>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold tracking-tight">{group.species}</h3>
              {process.env.NODE_ENV === "development" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerate();
                  }}
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium",
                    "border border-accent/30 text-accent/80 hover:bg-accent/10 hover:text-accent transition-colors",
                  )}
                  title={`Generate next version for ${group.species}`}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="shrink-0">
                    <polygon points="1,0 7,4 1,8" />
                  </svg>
                  Gen
                </button>
              )}
            </div>
            {/* Workflow badge */}
            <span className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
              group.contextFramework === "gad"
                ? "bg-emerald-500/15 text-emerald-400"
                : group.contextFramework === "bare"
                  ? "bg-amber-500/15 text-amber-400"
                  : group.contextFramework === "emergent"
                    ? "bg-violet-500/15 text-violet-400"
                    : "bg-muted/30 text-muted-foreground/60",
            )}>
              {group.contextFramework ?? "none"}
            </span>
          </div>

          {/* Generation timeline dots */}
          {group.runs.length > 0 && (
            <div
              data-cid={`project-editor-species-timeline-${group.species}`}
              className="mt-2 flex gap-0.5"
            >
              {group.runs.slice(0, 16).map((run) => (
                <div
                  key={run.version}
                  className={cn(
                    "h-1.5 w-2.5 rounded-sm transition-colors",
                    run.traceSchemaVersion >= 4
                      ? "bg-accent/50"
                      : "bg-muted-foreground/20",
                  )}
                  title={`${run.version}${run.traceSchemaVersion >= 4 ? " (trace v4+)" : ""}`}
                />
              ))}
              {group.runs.length > 16 && (
                <span className="text-[8px] text-muted-foreground/40 ml-0.5 self-center">
                  +{group.runs.length - 16}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Generation chips (brood) */}
        {group.runs.length > 0 && (
          <div
            className="border-t border-border/20 px-3 py-2 flex flex-wrap gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {group.runs.map((run) => (
              // cid prototype: project-editor-generation-chip-<species>-<version>-site-section
              <button
                key={run.version}
                type="button"
                onClick={() => onSelectGeneration(run.version)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono transition-colors",
                  "border border-border/30 hover:border-accent/60 hover:bg-accent/10",
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
          <div className="border-t border-border/20 px-3 py-2">
            <p className="text-[10px] text-muted-foreground/50">
              No generations yet
            </p>
          </div>
        )}
      </div>
    </SiteSection>
  );
}

export function ProjectCanvas({
  project,
  projectDisplayName,
  allProjects,
  allRuns,
  selection,
  onSelect,
}: {
  project: EvalProjectMeta;
  projectDisplayName: string;
  allProjects: EvalProjectMeta[];
  allRuns: EvalRunRecord[];
  selection: EditorSelection;
  onSelect: (s: EditorSelection) => void;
}) {
  const projectId = project.project ?? project.id.split("/")[0];

  const species = useMemo(
    () => groupBySpecies(project, allProjects, allRuns),
    [project, allProjects, allRuns],
  );

  const [runnerTarget, setRunnerTarget] = useState<{
    speciesName: string;
    nextVersion: string;
  } | null>(null);

  const handleGenerate = useCallback(
    (group: SpeciesGroup) => {
      const maxVersion = group.runs.reduce((max, r) => {
        const n = parseInt(r.version.replace("v", ""), 10);
        return n > max ? n : max;
      }, 0);
      setRunnerTarget({
        speciesName: group.species,
        nextVersion: `v${maxVersion + 1}`,
      });
    },
    [],
  );

  const handleRunnerComplete = useCallback(() => {
    // Runner stays open so user can see final output; they close manually.
  }, []);

  const handleRunnerClose = useCallback(() => {
    setRunnerTarget(null);
  }, []);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold tracking-tight">
          Species Deck
        </h2>
        <p className="text-xs text-muted-foreground">
          {projectDisplayName} &mdash; {species.length} species &middot;{" "}
          {species.reduce((n, s) => n + s.runs.length, 0)} total generations
        </p>
      </div>

      {/* Species grid */}
      <SiteSection
        cid="project-editor-species-grid-site-section"
        sectionShell={false}
        className="border-b-0"
      >
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
              onGenerate={() => handleGenerate(g)}
            />
          ))}
          {species.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              No species defined for this project yet.
            </p>
          )}
        </div>
      </SiteSection>

      {/* Generation runner overlay */}
      {runnerTarget && (
        <GenerationRunner
          projectId={projectId}
          speciesName={runnerTarget.speciesName}
          nextVersion={runnerTarget.nextVersion}
          onComplete={handleRunnerComplete}
          onClose={handleRunnerClose}
        />
      )}
    </div>
  );
}
