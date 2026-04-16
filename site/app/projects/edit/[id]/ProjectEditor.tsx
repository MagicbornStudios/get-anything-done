"use client";

import { useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";
import { DnaEditor } from "./DnaEditor";
import { ProjectCanvas } from "./ProjectCanvas";
import { InspectorPane } from "./InspectorPane";

type Tab = "dna" | "bestiary" | "recipes";

export type EditorSelection =
  | { kind: "project" }
  | { kind: "species"; species: string }
  | { kind: "generation"; species: string; version: string };

export function ProjectEditor({
  project,
  allProjects,
  allRuns,
}: {
  project: EvalProjectMeta;
  allProjects: EvalProjectMeta[];
  allRuns: EvalRunRecord[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("dna");
  const [selection, setSelection] = useState<EditorSelection>({ kind: "project" });

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
            {project.name}
          </h1>
          <span className="text-xs text-muted-foreground">
            {project.species ?? project.workflow ?? "—"}
          </span>
          {/* Breadcrumb for selection */}
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
          <div className="ml-auto flex items-center gap-2">
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
          {/* ── Left pane ──────────────────────────────────── */}
          <SiteSection
            cid="project-editor-left-pane-site-section"
            sectionShell={false}
            className="w-72 shrink-0 border-r border-border/60 overflow-y-auto border-b-0"
          >
            <div className="flex flex-col">
              {/* Tab bar */}
              <div className="flex border-b border-border/40">
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
              </div>

              {/* Tab content */}
              <div className="p-3">
                {activeTab === "dna" && <DnaEditor />}
                {activeTab === "bestiary" && (
                  <p className="text-xs text-muted-foreground">
                    Bestiary — brood cards will populate here (44.5-07)
                  </p>
                )}
                {activeTab === "recipes" && (
                  <p className="text-xs text-muted-foreground">
                    Recipes — species templates will populate here (44.5-06)
                  </p>
                )}
              </div>
            </div>
          </SiteSection>

          {/* ── Canvas (center) ────────────────────────────── */}
          <SiteSection
            cid="project-editor-canvas-site-section"
            sectionShell={false}
            className="flex-1 overflow-y-auto border-b-0"
          >
            {selection.kind === "generation" ? (
              // iframe preview for selected generation
              <SiteSection
                cid="project-editor-preview-pane-site-section"
                sectionShell={false}
                className="h-full border-b-0"
              >
                <iframe
                  src={`/playable/escape-the-dungeon/${selection.species}/${selection.version}/index.html`}
                  title={`${selection.species} ${selection.version} preview`}
                  className="h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                />
              </SiteSection>
            ) : (
              <ProjectCanvas
                project={project}
                allProjects={allProjects}
                allRuns={allRuns}
                selection={selection}
                onSelect={setSelection}
              />
            )}
          </SiteSection>

          {/* ── Right pane (inspector) ─────────────────────── */}
          <SiteSection
            cid="project-editor-right-pane-site-section"
            sectionShell={false}
            className="w-80 shrink-0 border-l border-border/60 overflow-y-auto border-b-0"
          >
            <InspectorPane
              project={project}
              allProjects={allProjects}
              allRuns={allRuns}
              selection={selection}
            />
          </SiteSection>
        </div>
      </SiteSection>
    </div>
  );
}
