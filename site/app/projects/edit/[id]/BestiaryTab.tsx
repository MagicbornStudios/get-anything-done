"use client";

import { useCallback, useMemo, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";
import { playableUrl } from "@/lib/eval-data";
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

type GenerationRow = {
  version: string;
  date: string | null;
  composite: number | null;
  hasPlayable: boolean;
  isPublished: boolean;
};

function buildGenerationRows(
  species: string,
  allRuns: EvalRunRecord[],
): GenerationRow[] {
  return allRuns
    .filter((r) => r.species === species)
    .sort((a, b) => {
      const va = parseInt(a.version.replace("v", ""), 10);
      const vb = parseInt(b.version.replace("v", ""), 10);
      return vb - va;
    })
    .map((r) => ({
      version: r.version,
      date: r.date,
      composite: r.scores.composite ?? null,
      hasPlayable: playableUrl(r) !== null,
      isPublished: playableUrl(r) !== null,
    }));
}

function PublishDot({
  projectId,
  species,
  version,
  initialPublished,
}: {
  projectId: string;
  species: string;
  version: string;
  initialPublished: boolean;
}) {
  const [published, setPublished] = useState(initialPublished);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      setBusy(true);
      const prev = published;
      setPublished(!prev); // optimistic
      try {
        const res = await fetch(
          `/api/dev/evals/projects/${projectId}/species/${species}/generations/${version}/publish`,
          { method: prev ? "DELETE" : "POST" },
        );
        if (!res.ok) {
          setPublished(prev); // revert
          const data = await res.json();
          console.error("publish toggle failed:", data.error);
        }
      } catch {
        setPublished(prev);
      } finally {
        setBusy(false);
      }
    },
    [projectId, species, version, published, busy],
  );

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={published ? "Published (click to unpublish)" : "Draft (click to publish)"}
      className={cn(
        "shrink-0 ml-auto w-2.5 h-2.5 rounded-full border transition-colors cursor-pointer",
        published
          ? "bg-emerald-400/80 border-emerald-500/60"
          : "bg-muted-foreground/20 border-muted-foreground/30 hover:border-muted-foreground/50",
        busy && "opacity-50",
      )}
    />
  );
}

function BestiaryCard({
  summary,
  selected,
  expanded,
  onToggle,
  onSelectGeneration,
  allRuns,
  projectId,
}: {
  summary: SpeciesSummary;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelectGeneration: (version: string) => void;
  allRuns: EvalRunRecord[];
  projectId: string;
}) {
  const generations = useMemo(
    () => (expanded ? buildGenerationRows(summary.species, allRuns) : []),
    [expanded, summary.species, allRuns],
  );

  return (
    // cid prototype: bestiary-species-card-<species>-site-section
    <SiteSection
      cid={`bestiary-species-card-${summary.species}-site-section` as const}
      sectionShell={false}
      className={cn(
        "rounded-lg border transition-colors",
        selected
          ? "border-accent/60 bg-accent/5"
          : "border-border/40 hover:border-border/60 hover:bg-card/30",
      )}
      allowContextPanel={false}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left cursor-pointer"
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
          {expanded && (
            <span className="text-muted-foreground/40 ml-auto">collapse</span>
          )}
        </div>

        {/* Mini version timeline (hidden when expanded) */}
        {!expanded && summary.versions.length > 0 && (
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

        {!expanded && summary.latestDate && (
          <p className="mt-1 text-[9px] text-muted-foreground/40">
            {summary.latestDate}
          </p>
        )}
      </button>

      {/* Generation list (expanded) */}
      {expanded && generations.length > 0 && (
        <div className="border-t border-border/30 px-2 py-1.5 space-y-0.5">
          {generations.map((g) => (
            <button
              key={g.version}
              type="button"
              onClick={() => onSelectGeneration(g.version)}
              className="w-full flex items-center gap-2 rounded px-1.5 py-1 text-left text-[10px] hover:bg-accent/10 transition-colors cursor-pointer"
            >
              <span className="shrink-0 rounded bg-accent/15 px-1 py-0.5 font-mono text-accent text-[9px]">
                {g.version}
              </span>
              {g.date && (
                <span className="text-muted-foreground/50 shrink-0">{g.date}</span>
              )}
              {g.composite !== null && (
                <span
                  className={cn(
                    "shrink-0 font-mono text-[9px]",
                    g.composite > 0.6
                      ? "text-emerald-400"
                      : g.composite >= 0.3
                        ? "text-amber-400"
                        : "text-red-400",
                  )}
                >
                  {(g.composite * 100).toFixed(0)}%
                </span>
              )}
              <PublishDot
                projectId={projectId}
                species={summary.species}
                version={g.version}
                initialPublished={g.isPublished}
              />
            </button>
          ))}
        </div>
      )}
      {expanded && generations.length === 0 && (
        <div className="border-t border-border/30 px-2 py-2">
          <p className="text-[9px] text-muted-foreground/40">No generations</p>
        </div>
      )}
    </SiteSection>
  );
}

const WORKFLOW_FILTERS = ["all", "gad", "bare", "emergent"] as const;
type WorkflowFilter = (typeof WORKFLOW_FILTERS)[number];

export function BestiaryTab({
  allProjects,
  allRuns,
  selection,
  onSelect,
  projectId,
}: {
  allProjects: EvalProjectMeta[];
  allRuns: EvalRunRecord[];
  selection: EditorSelection;
  onSelect: (s: EditorSelection) => void;
  projectId: string;
}) {
  const species = useMemo(
    () => summarizeSpecies(allProjects, allRuns),
    [allProjects, allRuns],
  );

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWorkflow, setNewWorkflow] = useState("gad");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>("all");
  const [expandedSpecies, setExpandedSpecies] = useState<string | null>(null);

  const filteredSpecies = useMemo(() => {
    let result = species;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((s) => s.species.toLowerCase().includes(q));
    }
    if (workflowFilter !== "all") {
      result = result.filter(
        (s) => (s.framework ?? "").toLowerCase() === workflowFilter,
      );
    }
    return result;
  }, [species, searchQuery, workflowFilter]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dev/evals/projects/${projectId}/species`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), workflow: newWorkflow }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to create species");
        return;
      }
      setNewName("");
      setCreating(false);
      // Select the new species
      onSelect({ kind: "species", species: newName.trim() });
      // Reload page to pick up new data
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }, [projectId, newName, newWorkflow, onSelect]);

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
              ({filteredSpecies.length}{filteredSpecies.length !== species.length ? `/${species.length}` : ""})
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="text-[10px] text-accent/60 hover:text-accent"
          >
            {creating ? "cancel" : "+ species"}
          </button>
        </div>

        {/* Search + workflow filter */}
        <div data-cid="bestiary-search-filter" className="flex flex-col gap-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search species..."
            className="w-full rounded border border-border/30 bg-background/50 px-2 py-1 text-[11px] placeholder:text-muted-foreground/40 focus:border-accent/50 focus:outline-none"
          />
          <div className="flex gap-0.5">
            {WORKFLOW_FILTERS.map((wf) => (
              <button
                key={wf}
                type="button"
                onClick={() => setWorkflowFilter(wf)}
                className={cn(
                  "flex-1 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider transition-colors",
                  workflowFilter === wf
                    ? "bg-accent/15 text-accent"
                    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20",
                )}
              >
                {wf}
              </button>
            ))}
          </div>
        </div>

        {creating && (
          <div className="rounded border border-accent/30 bg-accent/5 p-2 space-y-1.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="species-name (kebab-case)"
              className="w-full rounded border border-border/40 bg-background px-2 py-1 text-xs font-mono focus:border-accent focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <select
              value={newWorkflow}
              onChange={(e) => setNewWorkflow(e.target.value)}
              className="w-full rounded border border-border/40 bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
            >
              <option value="gad">gad</option>
              <option value="bare">bare</option>
              <option value="emergent">emergent</option>
            </select>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        )}

        {filteredSpecies.map((s) => (
          <BestiaryCard
            key={s.species}
            summary={s}
            selected={
              selection.kind === "species" && selection.species === s.species
            }
            expanded={expandedSpecies === s.species}
            onToggle={() => {
              const willExpand = expandedSpecies !== s.species;
              setExpandedSpecies(willExpand ? s.species : null);
              onSelect({ kind: "species", species: s.species });
            }}
            onSelectGeneration={(version) =>
              onSelect({ kind: "generation", species: s.species, version })
            }
            allRuns={allRuns}
            projectId={projectId}
          />
        ))}

        {filteredSpecies.length === 0 && !creating && (
          <p className="text-[10px] text-muted-foreground/40 py-2">
            {species.length === 0 ? "No species defined" : "No matches"}
          </p>
        )}
      </div>
    </SiteSection>
  );
}
