"use client";

import { useCallback, useEffect, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import { DnaActionRow } from "./DnaActionRow";

type GeneEntry = {
  slug: string;
  name: string;
  description: string;
  status: string;
  path: string;
  hasWorkflow: boolean;
};

type GeneStateData = {
  count: number;
  genes: GeneEntry[];
};

type GeneStates = {
  integrated: GeneStateData;
  expressed: GeneStateData;
  mutations: GeneStateData;
  shed: GeneStateData;
};

type GeneState = "integrated" | "expressed" | "mutations" | "shed";

const GENE_SECTIONS: {
  key: GeneState;
  label: string;
  cid: string;
  description: string;
}[] = [
  {
    key: "integrated",
    label: "DNA (Integrated)",
    cid: "project-editor-dna-integrated-list-site-section",
    description: "skills/ — stable, promoted genes",
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

function GeneCard({ gene, geneState }: { gene: GeneEntry; geneState: GeneState }) {
  return (
    // cid prototype: dna-gene-card-<skill-slug>-site-section
    <div
      className={cn(
        "rounded border border-border/40 px-2 py-1.5 text-[11px] transition-colors",
        "hover:border-accent/40 hover:bg-accent/5",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium truncate">{gene.name}</span>
        {gene.hasWorkflow && (
          <span className="shrink-0 text-[9px] text-emerald-400" title="has workflow">
            wf
          </span>
        )}
      </div>
      {gene.description && (
        <p className="mt-0.5 text-[10px] text-muted-foreground/70 line-clamp-2">
          {gene.description}
        </p>
      )}
      <DnaActionRow slug={gene.slug} geneState={geneState} />
    </div>
  );
}

export function DnaEditor({ onPreview }: { onPreview?: (url: string, title: string) => void }) {
  const [data, setData] = useState<GeneStates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<GeneState>>(
    new Set(["integrated"]),
  );

  const fetchGenes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/gene-states");
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenes();
  }, [fetchGenes]);

  const toggleSection = (key: GeneState) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <SiteSection
      cid="project-editor-dna-editor-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <div className="flex flex-col gap-1">
        {loading && !data && (
          <p className="px-3 py-2 text-[10px] text-muted-foreground animate-pulse">
            Loading gene states...
          </p>
        )}
        {error && (
          <p className="px-3 py-2 text-[10px] text-red-400">Error: {error}</p>
        )}

        {GENE_SECTIONS.map((section) => {
          const stateData = data?.[section.key];
          const expanded = expandedSections.has(section.key);
          const count = stateData?.count ?? 0;

          return (
            <SiteSection
              key={section.key}
              cid={section.cid}
              sectionShell={false}
              className="border-b-0"
            >
              <div className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/60">
                      ({count})
                    </span>
                  </h3>
                  <span className="text-[10px] text-muted-foreground/40">
                    {expanded ? "▾" : "▸"}
                  </span>
                </button>
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                  {section.description}
                </p>

                {expanded && stateData && stateData.genes.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1 max-h-60 overflow-y-auto">
                    {stateData.genes.map((gene) => (
                      <GeneCard key={gene.slug} gene={gene} geneState={section.key} />
                    ))}
                  </div>
                )}

                {expanded && stateData && stateData.genes.length === 0 && (
                  <div className="mt-2 rounded border border-dashed border-border/40 p-2 text-[10px] text-muted-foreground/40">
                    Empty
                  </div>
                )}
              </div>
            </SiteSection>
          );
        })}
      </div>
    </SiteSection>
  );
}
