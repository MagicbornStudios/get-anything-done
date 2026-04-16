"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";
import { DnaEditor } from "./DnaEditor";
import { ProjectCanvas } from "./ProjectCanvas";
import { InspectorPane } from "./InspectorPane";
import { LiveDataPanel } from "./LiveDataPanel";
import { CommandPalette } from "./CommandPalette";
import { BestiaryTab } from "./BestiaryTab";
import { RecipesTab } from "./RecipesTab";
import { DiffTree } from "./DiffTree";
import { PreviewFrame } from "./PreviewFrame";

type LeftTab = "dna" | "bestiary" | "recipes";

/** Compact battery bar showing species/generation/file counts with color thresholds. */
function ContextBatteryBar({
  speciesCount,
  generationCount,
}: {
  speciesCount: number;
  generationCount: number;
}) {
  const level =
    generationCount > 30 ? "red" : generationCount >= 10 ? "amber" : "green";
  const colorMap = {
    green: { bg: "bg-emerald-500/30", fill: "bg-emerald-500", text: "text-emerald-400" },
    amber: { bg: "bg-amber-500/30", fill: "bg-amber-500", text: "text-amber-400" },
    red: { bg: "bg-red-500/30", fill: "bg-red-500", text: "text-red-400" },
  } as const;
  const c = colorMap[level];
  // Normalize to 0..1 with max at 50 gens
  const pct = Math.min(generationCount / 50, 1);

  return (
    <div
      data-cid="project-editor-context-battery"
      className="flex items-center gap-1.5 rounded-full border border-border/30 bg-card/30 px-2 py-0.5"
      title={`${speciesCount} species, ${generationCount} generations`}
    >
      <span className={cn("text-[9px] font-mono", c.text)}>
        {speciesCount}sp {generationCount}gen
      </span>
      <div className={cn("h-2 w-10 rounded-full overflow-hidden", c.bg)}>
        <div
          className={cn("h-full rounded-full transition-all", c.fill)}
          style={{ width: `${Math.max(pct * 100, 4)}%` }}
        />
      </div>
    </div>
  );
}

type CanvasMode =
  | { kind: "species" }
  | { kind: "graph" }
  | { kind: "preview"; url: string; title: string }
  | { kind: "diff"; speciesA: string; versionA: string; versionB: string };

export type EditorSelection =
  | { kind: "project" }
  | { kind: "species"; species: string }
  | { kind: "generation"; species: string; version: string };

export function ProjectEditor({
  project,
  projectDisplayName,
  allProjects,
  allRuns,
}: {
  project: EvalProjectMeta;
  projectDisplayName: string;
  allProjects: EvalProjectMeta[];
  allRuns: EvalRunRecord[];
}) {
  const [activeTab, setActiveTab] = useState<LeftTab>("dna");
  const [canvasMode, setCanvasMode] = useState<CanvasMode>({ kind: "species" });
  const [selection, setSelection] = useState<EditorSelection>({ kind: "project" });
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [geneList, setGeneList] = useState<{ slug: string; name: string; status: string }[]>([]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const contextStats = useMemo(() => ({
    speciesCount: allProjects.length,
    generationCount: allRuns.length,
  }), [allProjects.length, allRuns.length]);

  // Auto-collapse both panes when iframe preview is showing — give game max space
  useEffect(() => {
    if (selection.kind === "generation" && canvasMode.kind !== "diff") {
      setRightCollapsed(true);
      setLeftCollapsed(true);
    }
  }, [selection.kind, canvasMode.kind]);

  // Fetch gene slugs for command palette autocomplete
  useEffect(() => {
    fetch("/api/dev/gene-states")
      .then((r) => r.json())
      .then((data) => {
        const all = [
          ...data.integrated.genes,
          ...data.expressed.genes,
          ...data.mutations.genes,
          ...data.shed.genes,
        ];
        setGeneList(all.map((g: { slug: string; name: string; status: string }) => ({
          slug: g.slug,
          name: g.name,
          status: g.status,
        })));
      })
      .catch(() => {});
  }, []);

  // Cmd+K / Ctrl+K to open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((v) => !v);
      }
      if (e.key === "Escape" && cmdPaletteOpen) {
        setCmdPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdPaletteOpen]);

  const handleModeButton = (kind: "species" | "graph") => {
    setCanvasMode({ kind });
    if (kind === "graph" && selection.kind === "generation") {
      setSelection({ kind: "project" });
    }
  };

  // Called from DNA action rows to preview an artifact in the canvas
  const handlePreview = (url: string, title: string) => {
    setCanvasMode({ kind: "preview", url, title });
  };

  // Compare two generations in diff view
  const handleCompare = useCallback(
    (species: string, versionA: string, versionB: string) => {
      setCanvasMode({ kind: "diff", speciesA: species, versionA, versionB });
    },
    [],
  );

  // Determine which canvas to render
  const renderCanvas = () => {
    if (canvasMode.kind === "graph") {
      return (
        <iframe
          data-cid="project-editor-graph-pane-site-section"
          src="/api/dev/graph"
          title="Planning Graph Visualization"
          className="h-full w-full border-0"
        />
      );
    }

    if (canvasMode.kind === "preview") {
      return (
        <PreviewFrame
          src={canvasMode.url}
          title={canvasMode.title}
          onClose={() => setCanvasMode({ kind: "species" })}
        />
      );
    }

    if (canvasMode.kind === "diff") {
      const runA = allRuns.find(
        (r) =>
          (r.species ?? r.project) === canvasMode.speciesA &&
          r.version === canvasMode.versionA,
      );
      const runB = allRuns.find(
        (r) =>
          (r.species ?? r.project) === canvasMode.speciesA &&
          r.version === canvasMode.versionB,
      );
      const objA = runA
        ? { scores: runA.scores, humanReview: runA.humanReview, derived: runA.derived }
        : {};
      const objB = runB
        ? { scores: runB.scores, humanReview: runB.humanReview, derived: runB.derived }
        : {};
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-1.5">
            <span className="text-[11px] font-medium">
              Diff: {canvasMode.speciesA} {canvasMode.versionA} vs {canvasMode.versionB}
            </span>
            <button
              type="button"
              onClick={() => setCanvasMode({ kind: "species" })}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <DiffTree
              label={`${canvasMode.versionA} vs ${canvasMode.versionB}`}
              before={objA as Record<string, unknown>}
              after={objB as Record<string, unknown>}
            />
          </div>
        </div>
      );
    }

    if (selection.kind === "generation") {
      return (
        <PreviewFrame
          src={`/playable/${project.project ?? project.id.split("/")[0]}/${selection.species}/${selection.version}/index.html`}
          title={`${selection.species} ${selection.version} preview`}
        />
      );
    }

    return (
      <div className="overflow-y-auto h-full">
        <ProjectCanvas
          project={project}
          projectDisplayName={projectDisplayName}
          allProjects={allProjects}
          allRuns={allRuns}
          selection={selection}
          onSelect={setSelection}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <SiteSection
        cid="project-editor-toolbar-site-section"
        sectionShell={false}
        className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
            dev mode
          </span>
          <h1 className="text-sm font-semibold tracking-tight">
            {projectDisplayName}
          </h1>
          <span className="text-xs text-muted-foreground">
            {project.species ?? project.workflow ?? "—"}
          </span>

          {/* Breadcrumb */}
          {selection.kind !== "project" && (
            <>
              <span className="text-xs text-muted-foreground/40">/</span>
              <button
                type="button"
                onClick={() =>
                  selection.kind === "generation"
                    ? setSelection({ kind: "species", species: selection.species })
                    : setSelection({ kind: "project" })
                }
                className="text-xs text-accent hover:underline"
              >
                {selection.kind === "generation"
                  ? `${selection.species} / ${selection.version}`
                  : selection.species}
              </button>
            </>
          )}

          {/* Canvas mode / preview indicator */}
          {canvasMode.kind === "preview" && (
            <>
              <span className="text-xs text-muted-foreground/40">/</span>
              <span className="text-xs text-amber-400">{canvasMode.title}</span>
            </>
          )}

          {/* Context battery bar */}
          <ContextBatteryBar
            speciesCount={contextStats.speciesCount}
            generationCount={contextStats.generationCount}
          />

          {/* Mode toggle */}
          <div className="ml-auto flex items-center gap-1">
            {(["species", "graph"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => handleModeButton(kind)}
                className={cn(
                  "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                  canvasMode.kind === kind
                    ? "bg-accent/15 text-accent"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {kind === "species" ? "Species" : "Graph"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCmdPaletteOpen(true)}
              className="ml-2 rounded border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              ⌘K
            </button>
            <span className="text-[10px] text-muted-foreground/60">
              /projects/edit/{project.project ?? project.id.split("/")[0]}
            </span>
          </div>
        </div>
      </SiteSection>

      {/* ── Three-pane layout ──────────────────────────────── */}
      <SiteSection
        cid="project-editor-page-site-section"
        sectionShell={false}
        className="border-b-0"
      >
        <div className="flex h-[calc(100vh-41px)]">
          {/* ── Left pane (collapsible) ───────────────────── */}
          {leftCollapsed ? (
            <div className="shrink-0 border-r border-border/60 flex flex-col items-center py-2 w-8">
              <button
                type="button"
                onClick={() => setLeftCollapsed(false)}
                className="text-muted-foreground hover:text-foreground text-[10px] [writing-mode:vertical-lr] rotate-180"
                title="Expand left pane"
              >
                DNA / Bestiary
              </button>
            </div>
          ) : (
            <div
              data-cid="project-editor-left-pane-site-section"
              className="w-72 shrink-0 border-r border-border/60 overflow-y-auto h-full flex flex-col"
            >
              <div className="flex border-b border-border/40 shrink-0">
                {(
                  [
                    { key: "dna", label: "DNA" },
                    { key: "bestiary", label: "Bestiary" },
                    { key: "recipes", label: "Recipes" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium transition-colors",
                      activeTab === tab.key
                        ? "border-b-2 border-accent text-accent"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setLeftCollapsed(true)}
                  className="px-2 py-2 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
                  title="Collapse left pane"
                >
                  &laquo;
                </button>
              </div>
              <div className="p-3 flex-1 overflow-y-auto">
                {activeTab === "dna" && <DnaEditor onPreview={handlePreview} />}
                {activeTab === "bestiary" && (
                  <BestiaryTab
                    allProjects={allProjects}
                    allRuns={allRuns}
                    selection={selection}
                    onSelect={setSelection}
                    projectId={project.project ?? project.id.split("/")[0]}
                  />
                )}
                {activeTab === "recipes" && (
                  <RecipesTab
                    projectId={project.project ?? project.id.split("/")[0]}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Canvas (center) ────────────────────────────── */}
          <div
            data-cid="project-editor-canvas-site-section"
            className="flex-1 min-w-0 overflow-hidden relative"
          >
            {renderCanvas()}
          </div>

          {/* ── Right pane (collapsible inspector) ────────── */}
          {rightCollapsed ? (
            <div className="shrink-0 border-l border-border/60 flex flex-col items-center py-2 w-8">
              <button
                type="button"
                onClick={() => setRightCollapsed(false)}
                className="text-muted-foreground hover:text-foreground text-[10px] [writing-mode:vertical-lr]"
                title="Expand inspector"
              >
                Inspector
              </button>
            </div>
          ) : (
            <div
              data-cid="project-editor-right-pane-site-section"
              className="w-64 shrink-0 border-l border-border/60 h-full flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Inspector
                </span>
                <button
                  type="button"
                  onClick={() => setRightCollapsed(true)}
                  className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
                  title="Collapse inspector"
                >
                  &raquo;
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <InspectorPane
                  project={project}
                  allProjects={allProjects}
                  allRuns={allRuns}
                  selection={selection}
                  onCompare={handleCompare}
                />
                <LiveDataPanel />
              </div>
            </div>
          )}
        </div>
      </SiteSection>

      {/* Command palette overlay */}
      {cmdPaletteOpen && (
        <CommandPalette
          genes={geneList}
          onClose={() => setCmdPaletteOpen(false)}
          onPreview={handlePreview}
        />
      )}
    </div>
  );
}
