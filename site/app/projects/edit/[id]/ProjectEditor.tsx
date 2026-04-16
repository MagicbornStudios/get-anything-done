"use client";

import { useState } from "react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { cn } from "@/lib/utils";
import type { EvalProjectMeta } from "@/lib/eval-data";

type Tab = "dna" | "bestiary" | "recipes";

export function ProjectEditor({ project }: { project: EvalProjectMeta }) {
  const [activeTab, setActiveTab] = useState<Tab>("dna");

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
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/60">
              /projects/edit/{project.id}
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

              {/* Tab content placeholder */}
              <div className="p-3">
                {activeTab === "dna" && (
                  <p className="text-xs text-muted-foreground">
                    DNA Editor — gene states will populate here (44.5-12)
                  </p>
                )}
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
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <SiteSectionHeading preset="section" title={project.name} />
                <p className="mt-2 text-sm text-muted-foreground">
                  Canvas — preview and detail panes render here
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {project.description}
                </p>
              </div>
            </div>
          </SiteSection>

          {/* ── Right pane (inspector) ─────────────────────── */}
          <SiteSection
            cid="project-editor-right-pane-site-section"
            sectionShell={false}
            className="w-80 shrink-0 border-l border-border/60 overflow-y-auto border-b-0"
          >
            <div className="p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Inspector
              </h2>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Project</dt>
                  <dd className="font-mono">{project.project ?? project.id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Species</dt>
                  <dd className="font-mono">{project.species ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Framework</dt>
                  <dd className="font-mono">{project.contextFramework ?? project.workflow ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Domain</dt>
                  <dd className="font-mono">{project.domain ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tech Stack</dt>
                  <dd className="font-mono">{project.techStack ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </SiteSection>
        </div>
      </SiteSection>
    </div>
  );
}
