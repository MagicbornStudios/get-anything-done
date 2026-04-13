"use client";

/**
 * SectionDevPanel — section-local slide-in panel listing all <Identified>
 * components registered in the current SectionRegistry.
 *
 * Key design choices:
 *   - Absolutely positioned INSIDE the SiteSection (position: relative on
 *     parent). Never escapes the section bounding box, unlike shadcn Sheet
 *     which targets the viewport.
 *   - Slides in from the section's right edge via CSS transform transition.
 *   - Gear trigger only visible on section hover OR when devIds mode is on.
 *   - Click a row: copy cid, scroll target into view, brief flash ring (not sticky).
 *   - Eye toggles persistent outline on the target (Escape clears).
 *   - The panel shell is <Identified as="SectionDevPanel"> so it appears in the list.
 */

import { useState } from "react";
import { Settings2, Copy, Eye, X } from "lucide-react";
import { useDevId } from "./DevIdProvider";
import { useSectionRegistry } from "./SectionRegistry";
import { Identified } from "./Identified";

function scrollTargetIntoView(cid: string) {
  if (typeof document === "undefined") return;
  const el = document.querySelector(`[data-cid="${CSS.escape(cid)}"]`);
  el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}

export function SectionDevPanel() {
  const { enabled, highlightCid, setHighlightCid, flashComponent } = useDevId();
  const registry = useSectionRegistry();
  const [open, setOpen] = useState(false);
  const [justCopied, setJustCopied] = useState<string | null>(null);

  if (!enabled || !registry) return null;

  const copy = (cid: string) => {
    navigator.clipboard?.writeText(cid).catch(() => {});
    setJustCopied(cid);
    setTimeout(() => setJustCopied(null), 900);
  };

  const activateRow = (cid: string) => {
    copy(cid);
    scrollTargetIntoView(cid);
    flashComponent(cid);
  };

  return (
    <>
      {/* Gear trigger — top-right of the section */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute right-3 top-3 z-30 inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-background/80 text-accent opacity-40 backdrop-blur transition-opacity hover:opacity-100"
        aria-label="Toggle component IDs panel"
      >
        <Settings2 size={14} />
      </button>

      {/* Slide-in panel, anchored to section right edge, contained within section */}
      <div
        className={[
          "pointer-events-none absolute right-0 top-0 z-40 h-full w-80 max-w-[85%]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
      >
        <Identified
          as="SectionDevPanel"
          className="pointer-events-auto flex h-full flex-col overflow-hidden border-l border-accent/40 bg-background/95 shadow-2xl backdrop-blur"
          depth={1}
        >
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Section dev panel
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/90">
                as=&quot;SectionDevPanel&quot;
              </p>
              <p className="text-xs text-foreground">
                {registry.entries.length} registered · depth ≤ {registry.maxDepth}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          </div>

          {registry.entries.length === 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs text-muted-foreground">
              No &lt;Identified&gt; components registered in this section.
            </div>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              {registry.entries.map((entry) => {
                const isHl = highlightCid === entry.cid;
                return (
                  <li
                    key={entry.cid}
                    onClick={() => activateRow(entry.cid)}
                    className={[
                      "group/cid flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                      isHl ? "bg-accent/15" : "hover:bg-card/60",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHighlightCid(isHl ? null : entry.cid);
                      }}
                      className="text-muted-foreground hover:text-accent"
                      aria-label="Toggle persistent highlight"
                      title="Toggle persistent highlight"
                    >
                      <Eye size={12} />
                    </button>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-muted-foreground/70">{entry.label}</span>
                      <span className="ml-1.5 font-mono text-accent">{entry.cid}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copy(entry.cid);
                      }}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover/cid:opacity-100 hover:text-accent"
                      aria-label="Copy ID"
                      title="Copy ID"
                    >
                      <Copy size={12} />
                    </button>
                    {justCopied === entry.cid && (
                      <span className="text-[9px] uppercase tracking-wider text-emerald-400">
                        copied
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="shrink-0 border-t border-border/60 p-3 text-[10px] leading-4 text-muted-foreground">
            Press <kbd className="rounded bg-card px-1 font-mono">Alt+I</kbd> to toggle dev IDs. Click a row to copy and jump to the component. Alt-click a component to copy and pin highlight.
          </div>
        </Identified>
      </div>
    </>
  );
}
