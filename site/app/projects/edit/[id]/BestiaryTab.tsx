"use client";

import { useMemo } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";
import type { EditorSelection } from "./ProjectEditor";

/**
 * Bestiary tab — read-only grid of brood cards, one per species.
 * Each card shows generation count, latest version, context framework,
 * and a mini timeline of versions. Clicking selects in the canvas.
 *
 * VCS cids:
 *   project-editor-bestiary-tab-site-section
 *   // cid prototype: bestiary-species-card-<species>-site-section
 */

type SpeciesSummary = {
  species: string;
  framework: string | null;
  versions: string[];
  latest: string | null;
  latestDate: string | null;
  totalRuns: number;
  hasPlayable: boolean;
};

function summarizeSpecies(
  allProjects: EvalProjectMeta[],
  allRuns: EvalRunRecord[],
): SpeciesSummary[] {
  return allProjects.map((sp) => {
    const runs = allRuns
      .filter((r) => r.species === sp.species)
      .sort((a, b) => {
        const va = parseInt(a.version.replace("v", ""), 10);
        const vb = parseInt(b.version.replace("v", ""), 10);
        return vb - va;
      });

    return {
      species: sp.species ?? sp.workflow ?? "default",
      framework: sp.contextFramework ?? sp.workflow,
      versions: runs.map((r) => r.version),
      latest: runs[0]?.version ?? null,
      latestDate: runs[0]?.date ?? null,
      totalRuns: runs.length,
      hasPlayable: runs.length > 0,
    };
  });
}

function BestiaryCard({
  summary,
  selected,
  onSelect,
}: {
  summary: SpeciesSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    // cid prototype: bestiary-species-card-<species>-site-section
    <SiteSection
      cid={`bestiary-species-card-${summary.species}-site-section` as const}
      sectionShell={false}
      className={cn(
        "rounded-lg border transition-colors cursor-pointer",
        selected
          ? "border-accent/60 bg-accent/5"
          : "border-border/40 hover:border-border/60 hover:bg-card/30",
      )}
      allowContextPanel={false}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full p-3 text-left"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold">{summary.species}</h3>
          <span className="text-[10px] font-mono text-muted-foreground/60">
            {summary.framework ?? "none"}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-2 text-[10px]">
          <span className="text-muted-foreground">
            {summary.totalRuns} gen{summary.totalRuns !== 1 ? "s" : ""}
          </span>
          {summary.latest && (
            <span className="font-mono text-accent">{summary.latest}</span>
          )}
        </div>

        {/* Mini version timeline */}
        {summary.versions.length > 0 && (
          <div className="mt-2 flex gap-0.5">
            {summary.versions.slice(0, 12).map((v) => (
              <div
                key={v}
                className="h-1.5 w-2 rounded-sm bg-accent/30"
                title={v}
              />
            ))}
            {summary.versions.length > 12 && (
              <span className="text-[8px] text-muted-foreground/40 ml-0.5">
                +{summary.versions.length - 12}
              </span>
            )}
          </div>
        )}

        {summary.latestDate && (
          <p className="mt-1 text-[9px] text-muted-foreground/40">
            {summary.latestDate}
          </p>
        )}
      </button>
    </SiteSection>
  );
}

export function BestiaryTab({
  allProjects,
  allRuns,
  selection,
  onSelect,
}: {
  allProjects: EvalProjectMeta[];
  allRuns: EvalRunRecord[];
  selection: EditorSelection;
  onSelect: (s: EditorSelection) => void;
}) {
  const species = useMemo(
    () => summarizeSpecies(allProjects, allRuns),
    [allProjects, allRuns],
  );

  return (
    <SiteSection
      cid="project-editor-bestiary-tab-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bestiary
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/60">
              ({species.length})
            </span>
          </h2>
        </div>

        {species.map((s) => (
          <BestiaryCard
            key={s.species}
            summary={s}
            selected={
              selection.kind === "species" && selection.species === s.species
            }
            onSelect={() => onSelect({ kind: "species", species: s.species })}
          />
        ))}

        {species.length === 0 && (
          <p className="text-[10px] text-muted-foreground/40 py-2">
            No species defined
          </p>
        )}
      </div>
    </SiteSection>
  );
}
