import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FilePenLine,
  FileX2,
  MessageSquare,
  Mic,
  Search,
  Trash2,
} from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import {
  DEV_PANEL_BRAND_MARK,
  DEV_PANEL_LABEL,
} from "@/components/devid/dev-panel-constants";
import { cn } from "@/lib/utils";

const DEMO_HANDOFF_PAGE = "http://localhost:3000/";

/** Static chrome matching `DevIdModalContextFooter` compact row (decorative only). */
function StaticModalVcFooterStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none overflow-hidden border-t border-border/60 bg-muted/25",
        className,
      )}
    >
      <div className="flex min-h-7 flex-nowrap items-center gap-x-1.5 gap-y-0 px-2 py-1 text-[9px] leading-none">
        <div className="relative z-10 h-6 min-w-[6.5rem] shrink-0">
          <span className="flex h-full items-center font-semibold uppercase tracking-wide text-accent">
            VC · modal
          </span>
        </div>
        <span className="shrink-0 tabular-nums text-muted-foreground">1/3</span>
        <div className="flex shrink-0 items-center text-muted-foreground">
          <span className="inline-flex size-6 items-center justify-center rounded-md">
            <ChevronLeft size={11} aria-hidden />
          </span>
          <span className="inline-flex size-6 items-center justify-center rounded-md">
            <ChevronRight size={11} aria-hidden />
          </span>
        </div>
        <span className="inline-flex h-6 shrink-0 items-center rounded-md border border-border/50 bg-secondary/40 px-1.5 text-[9px] text-secondary-foreground">
          Locate
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden border-l border-border/50 pl-1.5">
          <span className="min-w-0 truncate font-medium text-foreground">visual-context-site-section</span>
          <span className="min-w-0 shrink truncate font-mono text-[8px] text-muted-foreground">
            cid=&quot;visual-context-site-section&quot;
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="inline-flex h-6 items-center gap-0.5 rounded-md border border-border/50 bg-secondary/40 px-1.5 text-[9px]">
            <Mic size={10} aria-hidden />
            Upd
          </span>
          <span className="inline-flex h-6 items-center gap-0.5 rounded-md border border-border/50 bg-secondary/40 px-1.5 text-[9px]">
            <Trash2 size={10} aria-hidden />
            Del
          </span>
          <span className="inline-flex size-6 items-center justify-center rounded-md border border-border/50 bg-secondary/40">
            <Copy size={10} aria-hidden />
          </span>
          <span className="inline-flex h-6 items-center px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Short
          </span>
        </div>
      </div>
      <p className="border-t border-border/40 px-2 py-1 text-[9px] text-muted-foreground">
        <span className="font-semibold text-emerald-400/95">Live — </span>
        (dictation line when the real strip is listening)
      </p>
    </div>
  );
}

/**
 * Decorative-only preview of the band Visual Context Panel, ID search, agent handoff, and a
 * standalone VC modal footer strip (static chrome only). Does not mount `DevPanel`,
 * `DevIdSearchDialog`, `DevIdAgentPromptDialog`, or `DevIdModalContextFooter`.
 */
export function LandingVisualContextPanelShowcase() {
  return (
    <div className="mt-8 space-y-8" data-showcase="visual-context-static">
      <p className="sr-only">
        Decorative preview: band panel, agent handoff mock, ID search mock with modal footer inside
        the search shell, standalone VC modal footer strip. Not connected to dev tools.
      </p>
      <div className="space-y-2">
        <Identified as="LandingVisualContextShowcaseIntroTitle">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Static preview
          </p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-foreground">Decorative dev chrome</p>
        </Identified>
        <Identified as="LandingVisualContextShowcaseIntroSummary">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Not wired to dev tools. Blocks below: band hover panel; agent handoff dialog + footer; ID
            search dialog + footer; VC modal footer on its own.
          </p>
        </Identified>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-start">
        <Identified
          as="LandingVisualContextShowcaseBand"
          className="relative rounded-lg border border-dashed border-border/60 bg-muted/10 p-4"
        >
          <Identified as="LandingVisualContextShowcaseBandCaption" className="mb-3 block">
            <p className="text-[10px] text-muted-foreground">Band hover panel (shape only)</p>
          </Identified>
          <Identified as="LandingVisualContextShowcaseBandChrome">
            <div className="pointer-events-none w-72 rounded-md border border-accent/40 bg-background/95 px-2 py-1 shadow-lg backdrop-blur">
              <div className="flex items-start justify-between gap-2 text-[10px]">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold uppercase tracking-wide text-accent">{DEV_PANEL_LABEL}</p>
                  <p className="truncate text-muted-foreground">Visual context · 3 items</p>
                </div>
                <p className="shrink-0 max-w-[5.5rem] text-right text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground/85">
                  {DEV_PANEL_BRAND_MARK}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <span className="inline-flex h-6 items-center gap-1 rounded-md border border-border/60 bg-background px-1.5 text-[10px] text-muted-foreground">
                  <Mic size={11} aria-hidden />
                  Update
                </span>
                <span className="inline-flex h-6 items-center gap-1 rounded-md border border-border/60 bg-background px-1.5 text-[10px] text-muted-foreground">
                  <Trash2 size={11} aria-hidden />
                  Delete
                </span>
                <span className="inline-flex h-6 items-center rounded-md px-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Short
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <p className="min-w-0 truncate">
                  <span className="text-muted-foreground">Target - </span>
                  <span className="font-medium text-foreground">visual-context-site-section</span>
                </p>
                <div className="ml-2 flex shrink-0 items-center gap-1 text-muted-foreground">
                  <span className="inline-flex size-5 items-center justify-center rounded-md border border-border/50">
                    <ChevronLeft size={10} aria-hidden />
                  </span>
                  <span className="w-16 text-center tabular-nums">d1 - 2</span>
                  <span className="inline-flex size-5 items-center justify-center rounded-md border border-border/50">
                    <ChevronRight size={10} aria-hidden />
                  </span>
                </div>
              </div>
              <div className="mt-1 max-h-24 space-y-1 overflow-hidden pr-1">
                <div className="flex items-center gap-1 rounded border border-accent/60 bg-accent/10 p-0.5 text-accent">
                  <div className="min-w-0 flex-1 px-1 py-0.5 text-left">
                    <span className="block truncate text-[10px]">LandingVisualContextShowcase</span>
                    <span className="block truncate font-mono text-[10px] text-accent/90">
                      LandingVisualContextShowcase
                    </span>
                  </div>
                  <span className="inline-flex size-5 items-center justify-center opacity-70">
                    <Copy size={10} aria-hidden />
                  </span>
                  <span className="inline-flex size-5 items-center justify-center opacity-70">
                    <MessageSquare size={10} aria-hidden />
                  </span>
                </div>
                <div className="flex items-center gap-1 rounded border border-border/50 p-0.5 text-muted-foreground">
                  <div className="min-w-0 flex-1 px-1 py-0.5 text-left">
                    <span className="block truncate text-[10px]">LandingVisualContextPatternList</span>
                    <span className="block truncate font-mono text-[10px]">LandingVisualContextPatternList</span>
                  </div>
                  <span className="inline-flex size-5 items-center justify-center opacity-70">
                    <Copy size={10} aria-hidden />
                  </span>
                  <span className="inline-flex size-5 items-center justify-center opacity-70">
                    <MessageSquare size={10} aria-hidden />
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 border-t border-border/40 pt-1 text-[9px] text-muted-foreground">
                <span className="rounded border border-border/50 px-1 py-0.5">Top</span>
                <span className="rounded border border-border/50 px-1 py-0.5">Right</span>
              </div>
            </div>
          </Identified>
        </Identified>

        <Identified
          as="LandingVisualContextShowcaseAgentHandoff"
          className="min-w-0 rounded-lg border border-dashed border-border/60 bg-muted/10 p-4"
        >
          <Identified as="LandingVisualContextShowcaseAgentHandoffCaption" className="mb-3 block">
            <p className="text-[10px] text-muted-foreground">
              Agent handoff dialog (shape only — matches{" "}
              <code className="rounded bg-muted px-0.5 font-mono text-[9px]">DevIdAgentPromptDialog</code>)
            </p>
          </Identified>
          <Identified as="LandingVisualContextShowcaseAgentHandoffShell">
            <div className="pointer-events-none flex max-h-[min(32rem,70vh)] flex-col overflow-hidden rounded-lg border border-border/60 bg-background shadow-lg sm:max-w-[min(98vw,36rem)]">
              <Identified as="LandingVisualContextShowcaseAgentHandoffHeader">
                <div className="shrink-0 border-b border-border/60 px-4 py-3 text-left">
                  <p className="text-base font-semibold tracking-tight text-foreground">Agent handoff</p>
                </div>
              </Identified>
              <Identified as="LandingVisualContextShowcaseAgentHandoffContextStrip">
                <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-border/50 bg-muted/20 px-3 py-2">
                  <div className="min-w-0 rounded-md border border-border/60 bg-muted/35 px-2 py-1.5">
                    <span className="block truncate font-mono text-[11px] text-foreground">{DEMO_HANDOFF_PAGE}</span>
                  </div>
                  <div className="min-w-0 rounded-md border border-border/60 bg-muted/35 px-2 py-1.5">
                    <span className="block truncate font-mono text-[11px] text-foreground">
                      visual-context-site-section
                    </span>
                  </div>
                  <div className="min-w-0 rounded-md border border-border/60 bg-muted/35 px-2 py-1.5">
                    <span className="block truncate font-mono text-[11px] text-foreground">
                      visual-context-site-section
                    </span>
                  </div>
                </div>
              </Identified>
              <Identified as="LandingVisualContextShowcaseAgentHandoffTabs">
                <div className="shrink-0 px-3 pt-1 sm:px-4">
                  <div className="inline-flex h-6 w-fit gap-px rounded border border-border/40 bg-muted/30 p-px">
                    <span className="flex h-[1.375rem] items-center gap-0.5 rounded-sm bg-background px-1.5 py-0 text-[9px] font-semibold leading-none text-foreground shadow-sm">
                      <FilePenLine className="size-2.5 shrink-0" strokeWidth={2} aria-hidden />
                      Upd
                    </span>
                    <span className="flex h-[1.375rem] items-center gap-0.5 rounded-sm px-1.5 py-0 text-[9px] font-semibold leading-none text-muted-foreground">
                      <FileX2 className="size-2.5 shrink-0" strokeWidth={2} aria-hidden />
                      Del
                    </span>
                  </div>
                </div>
              </Identified>
              <Identified as="LandingVisualContextShowcaseAgentHandoffBody">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-1 sm:px-4 sm:pb-3">
                  <pre className="max-h-[min(28vh,9rem)] shrink-0 select-none overflow-hidden border-b border-border/60 bg-muted/40 px-3 py-2 font-mono text-[10px] leading-relaxed text-foreground sm:text-[11px]">
                    {`Route: ${DEMO_HANDOFF_PAGE}
Label: visual-context-site-section
Component: SiteSection
search: cid="visual-context-site-section"`}
                  </pre>
                  <div className="mt-1 flex min-h-[5.5rem] flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/15 p-2 text-[11px] text-muted-foreground shadow-inner">
                    <span className="text-foreground/70">Describe the change for the agent…</span>
                    <span className="mt-2 block text-[10px] italic opacity-80">
                      Hover shows dictation + Copy in the real dialog.
                    </span>
                  </div>
                </div>
              </Identified>
              <Identified as="LandingVisualContextShowcaseAgentHandoffModalFooter">
                <div
                  className="relative border-t border-accent/15 bg-muted/10"
                  data-showcase="vc-modal-footer-embedded-in-handoff"
                >
                  <StaticModalVcFooterStrip />
                </div>
              </Identified>
            </div>
          </Identified>
        </Identified>

        <Identified
          as="LandingVisualContextShowcaseIdSearch"
          className="relative rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 lg:col-span-2"
        >
          <Identified as="LandingVisualContextShowcaseIdSearchCaption" className="mb-3 block">
            <p className="text-[10px] text-muted-foreground">
              Component ID search dialog (shape only — matches{" "}
              <code className="rounded bg-muted px-0.5 font-mono text-[9px]">DevIdSearchDialog</code>)
            </p>
          </Identified>
          <div className="pointer-events-none mx-auto max-w-[56rem]">
            <Identified as="LandingVisualContextShowcaseIdSearchDialog">
              <div className="overflow-hidden rounded-lg border border-border/60 bg-background shadow-lg">
                <Identified as="LandingVisualContextShowcaseIdSearchHeader">
                  <div className="space-y-1.5 border-b border-border/60 px-4 py-3">
                    <Identified as="LandingVisualContextShowcaseIdSearchDialogTitle">
                      <p className="text-sm font-semibold leading-none text-foreground">
                        Component ID search (dev)
                      </p>
                    </Identified>
                    <Identified as="LandingVisualContextShowcaseIdSearchDialogDescription">
                      <p className="text-xs text-muted-foreground">
                        Search <code className="rounded bg-muted/60 px-1 font-mono text-[11px]">cid</code> /{" "}
                        <code className="rounded bg-muted/60 px-1 font-mono text-[11px]">as</code> /{" "}
                        <code className="rounded bg-muted/60 px-1 font-mono text-[11px]">id</code>. Jump to route
                        and auto-highlight target.
                      </p>
                    </Identified>
                  </div>
                </Identified>
                <Identified as="LandingVisualContextShowcaseIdSearchQuery">
                  <div className="border-b border-border/50 px-4 py-3">
                    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5">
                      <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        visual-context-site-section
                      </span>
                    </div>
                  </div>
                </Identified>
                <Identified as="LandingVisualContextShowcaseIdSearchHitList">
                  <div className="max-h-[min(12rem,40vh)] space-y-1 overflow-hidden px-2 py-2">
                    <ul className="space-y-1">
                      <li className="rounded-md border border-border/50 bg-card/40 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[11px] text-foreground">
                              visual-context-site-section
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              cid · components/landing/home/LandingVisualContextAndPromptBand.tsx:9
                            </p>
                          </div>
                          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border/50 bg-primary/10 px-2 text-[10px] text-muted-foreground">
                            <ExternalLink className="size-3" aria-hidden />
                            Go to component
                          </span>
                        </div>
                      </li>
                      <li className="rounded-md border border-border/50 bg-card/40 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[11px] text-foreground">
                              LandingVisualContextPanelShowcase
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              as · components/landing/home/LandingVisualContextAndPromptBand.tsx:49
                            </p>
                          </div>
                          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border/50 bg-primary/10 px-2 text-[10px] text-muted-foreground">
                            <ExternalLink className="size-3" aria-hidden />
                            Go to component
                          </span>
                        </div>
                      </li>
                      <li className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[11px] text-foreground">devid-search-dialog-input</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              cid · components/devid/DevIdSearchDialog.tsx:88
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold text-emerald-400">Copied</span>
                        </div>
                      </li>
                    </ul>
                  </div>
                </Identified>
                <Identified as="LandingVisualContextShowcaseIdSearchModalFooter">
                  <div
                    className="relative border-t border-accent/15 bg-muted/10"
                    data-showcase="vc-modal-footer-embedded-in-search"
                  >
                    <StaticModalVcFooterStrip />
                  </div>
                </Identified>
              </div>
            </Identified>
          </div>
        </Identified>

        <Identified
          as="LandingVisualContextShowcaseVcModalFooterStandalone"
          className="relative rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 lg:col-span-2"
        >
          <Identified as="LandingVisualContextShowcaseVcModalFooterStandaloneCaption" className="mb-3 block">
            <p className="text-[10px] text-muted-foreground">
              VC modal footer (shape only — matches{" "}
              <code className="rounded bg-muted px-0.5 font-mono text-[9px]">DevIdModalContextFooter</code>)
            </p>
          </Identified>
          <Identified as="LandingVisualContextShowcaseVcModalFooterStandaloneChrome">
            <div className="pointer-events-none mx-auto max-w-xl overflow-hidden rounded-lg border border-border/60 bg-background shadow-lg">
              <div data-showcase="vc-modal-footer-standalone">
                <StaticModalVcFooterStrip />
              </div>
            </div>
          </Identified>
        </Identified>
      </div>
    </div>
  );
}
