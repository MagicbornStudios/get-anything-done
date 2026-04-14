"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  ClipboardList,
  Crosshair,
  ExternalLink,
  Hash,
  Maximize2,
  XCircle,
} from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProjectSkillScopeRow } from "./project-skill-scope-model";
import { SKILL_PACKAGE_REFERENCE_BLURB } from "./skill-package-reference";
import { SkillCatalogFilesOnly, SkillPackageFileTreeView } from "./SkillPackageFileTree";
import { ReadonlyCodeMirror } from "./ReadonlyCodeMirror";

/** 0–100 for telemetry; null = catalog preview (no fill). */
function derivedUsagePercent(row: ProjectSkillScopeRow): number | null {
  if (row.usagePercent !== null) return row.usagePercent;
  if (row.triggered === true) return 100;
  if (row.triggered === false) return 0;
  return null;
}

function usagePercentLabel(row: ProjectSkillScopeRow): { text: string; title: string } {
  const d = derivedUsagePercent(row);
  if (d !== null) {
    return {
      text: `${d}%`,
      title:
        row.usagePercent !== null
          ? "Expected trigger outcome (latest run + playable build)"
          : "Expected trigger from trace (add playable build to match bar to telemetry)",
    };
  }
  return { text: "—%", title: "Catalog preview — sprite + usage ship with eval telemetry" };
}

/**
 * Game-style “health” bar: framed track, glossy fill, crit / hurt / OK coloring.
 * `fillPercent` null → preview row (empty striped track).
 */
function SkillUsageHealthBar({ fillPercent }: { fillPercent: number | null }) {
  const pct = fillPercent ?? 0;
  const isPreview = fillPercent === null;
  return (
    <div
      className={cn(
        "relative h-3 w-full min-w-[4.5rem] overflow-hidden rounded-sm border-2 border-zinc-600/95 bg-zinc-950/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.55)]",
        isPreview && "border-dashed border-zinc-500/80 bg-zinc-950/50",
      )}
      title={isPreview ? "No usage yet — preview slot" : `Usage ${pct}%`}
    >
      {isPreview ? (
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(148,163,184,0.12) 4px, rgba(148,163,184,0.12) 8px)",
          }}
        />
      ) : (
        <>
          <div
            className="h-full bg-gradient-to-b from-zinc-800/90 to-zinc-950"
            aria-hidden
          />
          <div
            className={cn(
              "absolute bottom-0 left-0 top-0 rounded-sm bg-gradient-to-b shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-[width] duration-300",
              pct >= 85
                ? "from-emerald-400 to-emerald-700"
                : pct > 0
                  ? "from-amber-300 to-amber-700"
                  : "from-slate-500 to-slate-800",
            )}
            style={{ width: `${pct}%` }}
          />
        </>
      )}
    </div>
  );
}

/** Pixel-style slot for a future skill sprite sheet / texture. */
function SkillSprite({ row }: { row: ProjectSkillScopeRow | null | undefined }) {
  if (!row) return null;
  return (
    <div className="shrink-0" title="Skill sprite">
      <Identified
        as="ProjectSkillsScopeSkillSpriteSlot"
        cid="project-skills-scope-skill-sprite-slot"
        className="relative size-9 overflow-hidden rounded border-2 border-zinc-500/90 bg-zinc-900/95 shadow-[inset_0_0_10px_rgba(0,0,0,0.65)]"
      >
        {row.imagePath ? (
          <Image
            src={row.imagePath}
            alt={`${row.label} skill icon`}
            fill
            sizes="36px"
            className="object-cover"
          />
        ) : (
          <>
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(148,163,184,0.15) 3px, rgba(148,163,184,0.15) 4px), repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(148,163,184,0.15) 3px, rgba(148,163,184,0.15) 4px)",
              }}
              aria-hidden
            />
            <div className="flex h-full w-full items-center justify-center">
              <Crosshair className="size-3.5 text-zinc-500/90" aria-hidden />
            </div>
          </>
        )}
      </Identified>
    </div>
  );
}

function SkillUsageHud({ row }: { row: ProjectSkillScopeRow | null | undefined }) {
  if (!row) return null;
  const fill = derivedUsagePercent(row);
  const { text, title } = usagePercentLabel(row);
  const d = fill;
  return (
    <Identified
      as="ProjectSkillsScopeSkillUsageHealth"
      cid="project-skills-scope-skill-usage-health"
      className="flex min-w-0 shrink-0 items-center gap-2"
    >
      <SkillSprite row={row} />
      <div className="flex min-w-0 w-[6.75rem] flex-col gap-0.5" title={title}>
        <SkillUsageHealthBar fillPercent={fill} />
        <span
          className={cn(
            "text-right font-mono text-[10px] font-bold tabular-nums leading-none tracking-tight",
            d !== null && d >= 85
              ? "text-emerald-400"
              : d !== null && d > 0
                ? "text-amber-400"
                : d === 0
                  ? "text-amber-600/90"
                  : "text-muted-foreground",
          )}
        >
          {text}
        </span>
      </div>
    </Identified>
  );
}

export function ProjectSkillsScopeExplorer({
  rows,
  latestVersion,
  hasPlayableBuild,
  hasTriggerTelemetry,
  catalogTotal,
  scopeKind,
}: {
  rows: ProjectSkillScopeRow[];
  latestVersion: string | null;
  hasPlayableBuild: boolean;
  hasTriggerTelemetry: boolean;
  catalogTotal: number;
  scopeKind: "framework" | "bootstrap-only" | "none";
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() => rows[0]?.skillId ?? null);
  const [skillFilesModalOpen, setSkillFilesModalOpen] = useState(false);
  const selected = useMemo(() => rows.find((r) => r.skillId === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!rows.some((r) => r.skillId === selectedId)) {
      setSelectedId(rows[0]!.skillId);
    }
  }, [rows, selectedId]);

  return (
    <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <Identified
        as="ProjectSkillsScopeSkillList"
        cid="project-skills-scope-skill-list"
        className="lg:w-[min(100%,380px)] lg:shrink-0"
      >
        <div className="rounded-xl border border-border/70 bg-background/40 p-2 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 px-2 pb-2 pt-1">
            <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <ClipboardList className="size-3 shrink-0 text-muted-foreground/90" aria-hidden />
              <span className="truncate">
                List
                {latestVersion ? (
                  <span className="ml-1 font-mono font-normal normal-case text-foreground/70">· {latestVersion}</span>
                ) : null}
              </span>
            </div>
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground tabular-nums">
              <Hash className="size-2.5 opacity-60" aria-hidden />
              {rows.length}
              {scopeKind === "framework" && catalogTotal > rows.length ? ` / ${catalogTotal}` : ""}
            </span>
          </div>
          <ul className="max-h-[min(60vh,420px)] space-y-1 overflow-y-auto overscroll-contain p-1">
            {rows.length === 0 ? (
              <li className="rounded-md border border-dashed border-border/60 px-3 py-8 text-center text-[11px] text-muted-foreground">
                No skills in scope for this project.
              </li>
            ) : (
              rows.map((row) => {
                const active = selected?.skillId === row.skillId;
                return (
                  <li key={row.skillId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.skillId)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                        active
                          ? "border-accent/60 bg-accent/10 text-accent"
                          : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground",
                      )}
                    >
                      <SkillUsageHud row={row} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium leading-tight">{row.label}</span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">{row.skillId}</span>
                      </div>
                      {row.triggered === true ? (
                        <span className="flex shrink-0 items-center gap-0.5 text-[9px] font-semibold uppercase text-emerald-400/90">
                          <CheckCircle2 className="size-3" aria-hidden />
                          hit
                        </span>
                      ) : row.triggered === false ? (
                        <span className="flex shrink-0 items-center gap-0.5 text-[9px] font-semibold uppercase text-amber-500/90">
                          <XCircle className="size-3" aria-hidden />
                          miss
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">
          {hasTriggerTelemetry
            ? hasPlayableBuild
              ? "Health bar + % from latest run (playable). Sprite slot is a placeholder for sheet art."
              : "Trace sets % from expected triggers; add a playable build to lock bar + telemetry. Sprite slot reserved."
            : "Preview — % shows —%. Swap sprites when assets ship."}
        </p>
        {scopeKind === "framework" && catalogTotal > rows.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
            <span className="text-[10px] text-muted-foreground">Full framework catalog · {catalogTotal} skills</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px]" asChild>
              <Link href="/gad">
                Catalog <ExternalLink className="size-3 opacity-70" aria-hidden />
              </Link>
            </Button>
          </div>
        ) : null}
      </Identified>

      <Identified
        as="ProjectSkillsScopeSourcePanel"
        cid="project-skills-scope-source-panel"
        className="min-h-0 min-w-0 flex-1 rounded-xl border border-border/70 bg-card/25 p-3"
      >
        {selected ? (
          <>
            <Identified
              as="ProjectSkillsScopeSourceHeader"
              cid="project-skills-scope-source-header"
              className="mb-3 flex flex-col gap-3 border-b border-border/40 pb-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{selected.label}</h3>
                  <p className="font-mono text-[11px] text-muted-foreground">{selected.sourcePath}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button variant="default" size="sm" className="h-8 rounded-full text-xs" asChild>
                    <Link href={`/skills/${selected.skillId}`}>See skill detail</Link>
                  </Button>
                  <Dialog open={skillFilesModalOpen} onOpenChange={setSkillFilesModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-full text-xs"
                        aria-label="Open skill package file tree"
                      >
                        <Maximize2 className="size-3.5" aria-hidden />
                        <span className="hidden sm:inline">Explore files</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,56rem)] flex-col gap-0 p-0 sm:max-w-[56rem]">
                      <Identified
                        as="ProjectSkillsScopeSourceFilesModal"
                        cid="project-skills-scope-source-files-modal"
                        className="flex min-h-0 flex-1 flex-col"
                      >
                        <DialogHeader className="shrink-0 px-5 pb-2 pt-1">
                          <DialogTitle className="text-base">Skill package & files</DialogTitle>
                          <DialogDescription className="text-xs leading-relaxed">
                            {SKILL_PACKAGE_REFERENCE_BLURB}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
                          <div className="grid gap-6 md:grid-cols-2">
                            <section className="space-y-2 rounded-lg border border-border/50 bg-muted/10 p-3">
                              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                In this site build
                              </h4>
                              <p className="text-[11px] text-muted-foreground">
                                Files embedded in the marketing catalog for this skill (often just SKILL.md).
                              </p>
                              <SkillCatalogFilesOnly
                                skillId={selected.skillId}
                                sourcePath={selected.sourcePath}
                              />
                            </section>
                            <section className="space-y-2 rounded-lg border border-border/50 bg-muted/10 p-3 md:col-span-1">
                              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                GAD skill folder (reference)
                              </h4>
                              <p className="text-[11px] text-muted-foreground">
                                Typical layout under <code className="rounded bg-background/60 px-1">skills/&lt;id&gt;/</code>{" "}
                                in the framework repo — your skill may only ship a subset.
                              </p>
                              <SkillPackageFileTreeView skillId={selected.skillId} sourcePath={selected.sourcePath} />
                            </section>
                          </div>
                        </div>
                      </Identified>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </Identified>
            {selected.subtitle ? <p className="mb-2 text-xs text-muted-foreground">{selected.subtitle}</p> : null}
            <Identified as="ProjectSkillsScopeCodemirror" cid="project-skills-scope-codemirror" className="block min-h-0">
              <ReadonlyCodeMirror key={selected.skillId} value={selected.bodyRaw} />
            </Identified>
          </>
        ) : (
          <Identified
            as="ProjectSkillsScopeSourceEmpty"
            cid="project-skills-scope-source-empty"
            className="flex min-h-[min(50vh,360px)] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 bg-muted/5 px-4 text-center"
          >
            <p className="text-xs font-medium text-muted-foreground">Nothing selected</p>
            <p className="max-w-xs text-[11px] text-muted-foreground/90">
              {rows.length === 0 ? "This project has no catalog rows yet." : "Pick a row in the list."}
            </p>
          </Identified>
        )}
      </Identified>
    </div>
  );
}
