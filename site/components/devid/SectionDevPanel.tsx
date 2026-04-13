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
 *   - Eye toggles sticky highlight; Copy copies the cid (see footer for Alt-click).
 */

import { useState } from "react";
import { Settings2, Copy, Eye, X } from "lucide-react";
import { useDevId } from "./DevIdProvider";
import { useSectionRegistry } from "./SectionRegistry";

export function SectionDevPanel() {
  const { enabled, highlightCid, setHighlightCid } = useDevId();
  const registry = useSectionRegistry();
  const [open, setOpen] = useState(false);
  const [justCopied, setJustCopied] = useState<string | null>(null);

  if (!enabled || !registry) return null;

  const copy = (cid: string) => {
    navigator.clipboard?.writeText(cid).catch(() => {});
    setJustCopied(cid);
    setTimeout(() => setJustCopied(null), 900);
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
        <div className="pointer-events-auto h-full overflow-y-auto border-l border-accent/40 bg-background/95 shadow-2xl backdrop-blur">
          <div className="sticky top-0 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Component IDs
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
            <div className="p-4 text-xs text-muted-foreground">
              No &lt;Identified&gt; components registered in this section.
            </div>
          ) : (
            <ul className="p-2">
              {registry.entries.map((entry) => {
                const isHl = highlightCid === entry.cid;
                return (
                  <li
                    key={entry.cid}
                    className={[
                      "group/cid flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                      isHl ? "bg-accent/15" : "hover:bg-card/60",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => setHighlightCid(isHl ? null : entry.cid)}
                      className="text-muted-foreground hover:text-accent"
                      aria-label="Highlight component"
                      title="Highlight component"
                    >
                      <Eye size={12} />
                    </button>
                    <span className="flex-1 truncate">
                      <span className="text-muted-foreground/70">{entry.label}</span>
                      <span className="ml-1.5 font-mono text-accent">{entry.cid}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(entry.cid)}
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

          <div className="border-t border-border/60 p-3 text-[10px] leading-4 text-muted-foreground">
            Press <kbd className="rounded bg-card px-1 font-mono">Alt+I</kbd> to toggle dev IDs. Alt-click any component to copy its ID.
          </div>
        </div>
      </div>
    </>
  );
}
