"use client";

import { SiteSection } from "@/components/site";

/**
 * DNA Editor pane — shows the four gene states:
 *   DNA (integrated):  .claude/skills/
 *   Expressed:         .gad-try/
 *   Mutations:         .planning/proto-skills/
 *   Shed:              shed metadata
 *
 * VCS cids (all literals for grep):
 *   project-editor-dna-editor-site-section
 *   project-editor-dna-integrated-list-site-section
 *   project-editor-dna-expressed-list-site-section
 *   project-editor-dna-mutations-list-site-section
 *   project-editor-dna-shed-list-site-section
 *
 * // cid prototype: dna-gene-card-<skill-slug>-site-section
 */

type GeneState = "integrated" | "expressed" | "mutations" | "shed";

const GENE_SECTIONS: { key: GeneState; label: string; cid: string; description: string }[] = [
  {
    key: "integrated",
    label: "DNA (Integrated)",
    cid: "project-editor-dna-integrated-list-site-section",
    description: ".claude/skills/ — stable, promoted genes",
  },
  {
    key: "expressed",
    label: "Expressed",
    cid: "project-editor-dna-expressed-list-site-section",
    description: ".gad-try/ — epigenetic trials in progress",
  },
  {
    key: "mutations",
    label: "Mutations",
    cid: "project-editor-dna-mutations-list-site-section",
    description: ".planning/proto-skills/ — candidate mutations",
  },
  {
    key: "shed",
    label: "Shed",
    cid: "project-editor-dna-shed-list-site-section",
    description: "Deprecated/evicted genes",
  },
];

export function DnaEditor() {
  return (
    <SiteSection
      cid="project-editor-dna-editor-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <div className="flex flex-col gap-1">
        {GENE_SECTIONS.map((section) => (
          <SiteSection
            key={section.key}
            cid={section.cid}
            sectionShell={false}
            className="border-b-0"
          >
            <div className="px-3 py-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </h3>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                {section.description}
              </p>
              {/* Gene cards populate here via 44.5-12 */}
              <div className="mt-2 min-h-[32px] rounded border border-dashed border-border/40 p-2 text-[10px] text-muted-foreground/40">
                No genes loaded (44.5-12)
              </div>
            </div>
          </SiteSection>
        ))}
      </div>
    </SiteSection>
  );
}
