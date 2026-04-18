"use client";

/**
 * Depth pager — shows the current nesting depth and lets the user step
 * shallower / deeper through `Identified` blocks in the active panel slice.
 *
 * Reads chord state via `usePanelChord()` (one subscription per panel, see
 * `PanelChordContext`). Holding Ctrl on a blocked chevron flips it into a
 * dismiss (X) affordance when `onDismissPanel` is provided.
 *
 * Extracted from `DevPanel.tsx` so the panel's main render function stays
 * focused on state wiring + layout. The pager is fully self-contained apart
 * from the hover-hint dock corner it consumes from the caller.
 */

import { Button } from "@/components/ui/button";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePanelChord } from "./vc-chord";

export function DevPanelDepthPager(props: {
  dockCorner: "left" | "right";
  currentDepth: number;
  visibleCount: number;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  /** Section scan cap from registry; omit in band mode. */
  maxScanDepth?: number;
  /** While Control is held, disabled chevrons become dismiss (X) if this is set. */
  onDismissPanel?: () => void;
}) {
  const {
    dockCorner,
    currentDepth,
    visibleCount,
    onPrev,
    onNext,
    prevDisabled,
    nextDisabled,
    maxScanDepth,
    onDismissPanel,
  } = props;

  const ctrlHeld = usePanelChord().ctrl;

  const prevClose = Boolean(ctrlHeld && prevDisabled && onDismissPanel);
  const nextClose = Boolean(ctrlHeld && nextDisabled && onDismissPanel);

  return (
    <DevChromeHoverHint
      dockCorner={dockCorner}
      openDelay={100}
      closeDelay={80}
      contentClassName="p-3 [&_p+p]:mt-1.5"
      body={
        <>
          <p className="font-medium text-foreground">Depth {currentDepth}</p>
          <p className="text-muted-foreground">
            {visibleCount} landmark{visibleCount === 1 ? "" : "s"} in this slice. Chevrons step toward the section
            shell (back) or into nested{" "}
            <code className="rounded bg-muted/80 px-0.5 font-mono text-[9px]">Identified</code> blocks (forward).
          </p>
          {onDismissPanel ? (
            <p className="border-t border-border/50 pt-2 text-muted-foreground">
              Hold <kbd className="rounded bg-muted/80 px-1 font-mono text-[9px]">Ctrl</kbd> to turn a blocked chevron
              into <span className="text-foreground">close</span> (<span className="font-mono">X</span>).
            </p>
          ) : null}
          {maxScanDepth != null ? (
            <p className="border-t border-border/50 pt-2 text-muted-foreground">Section scan window: depth ≤ {maxScanDepth}.</p>
          ) : null}
        </>
      }
    >
      <div
        className="ml-2 flex cursor-help items-center gap-1 rounded-sm px-0.5 py-0.5 ring-offset-background hover:bg-muted/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        tabIndex={0}
        aria-label={`Landmarks at nesting depth ${currentDepth}, ${visibleCount} in this slice`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={[
            "size-5",
            prevClose ? "text-destructive hover:bg-destructive/15 hover:text-destructive" : "",
          ].join(" ")}
          disabled={!prevClose && prevDisabled}
          onClick={prevClose ? () => onDismissPanel?.() : onPrev}
          aria-label={prevClose ? "Close context panel" : "Shallower nesting depth"}
        >
          {prevClose ? <X size={10} strokeWidth={2.5} /> : <ChevronLeft size={10} />}
        </Button>
        <span className="w-16 text-center tabular-nums">
          d{currentDepth} - {visibleCount}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={[
            "size-5",
            nextClose ? "text-destructive hover:bg-destructive/15 hover:text-destructive" : "",
          ].join(" ")}
          disabled={!nextClose && nextDisabled}
          onClick={nextClose ? () => onDismissPanel?.() : onNext}
          aria-label={nextClose ? "Close context panel" : "Deeper nesting depth"}
        >
          {nextClose ? <X size={10} strokeWidth={2.5} /> : <ChevronRight size={10} />}
        </Button>
      </div>
    </DevChromeHoverHint>
  );
}
