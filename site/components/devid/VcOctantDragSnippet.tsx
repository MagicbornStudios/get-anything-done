"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Move } from "lucide-react";
import { toast } from "sonner";
import { DevChromeHoverHint, type VcPanelCorner } from "@/components/devid/DevChromeHoverHint";
import { cn } from "@/lib/utils";
import type { RegistryEntry } from "./SectionRegistry";
import { buildVcSpatialHandoffSnippet, classifyOctant } from "./vcOctantSnippet";

const MIN_DRAG_PX = 22;

type DragPhase = "idle" | "dragging";

/**
 * Drag from the nub in any of 8 directions; distance sets radius text in the snippet.
 * Commits into the Update handoff editable area (live if dialog open, else queued).
 */
export function VcOctantDragSnippet({
  dockCorner,
  disabled,
  entries,
  onCommitSnippet,
}: {
  dockCorner: VcPanelCorner;
  disabled: boolean;
  entries: RegistryEntry[];
  onCommitSnippet: (snippet: string) => void;
}) {
  const [phase, setPhase] = useState<DragPhase>("idle");
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const finishFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const start = startRef.current;
      startRef.current = null;
      setPhase("idle");
      if (!start || disabled || !entries.length) return;
      const dx = clientX - start.x;
      const dy = clientY - start.y;
      const dist = Math.hypot(dx, dy);
      if (dist < MIN_DRAG_PX) {
        toast.message(`Drag at least ${MIN_DRAG_PX}px to set direction and reach.`);
        return;
      }
      const oct = classifyOctant(dx, dy);
      if (!oct) return;
      const snippet = buildVcSpatialHandoffSnippet(entries, oct, dist);
      onCommitSnippet(snippet);
      toast.success("Layout hint added to Update instructions");
    },
    [disabled, entries, onCommitSnippet],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      startRef.current = { x: e.clientX, y: e.clientY };
      setPhase("dragging");
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [disabled],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!startRef.current) return;
      e.preventDefault();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      finishFromPointer(e.clientX, e.clientY);
    },
    [finishFromPointer],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      startRef.current = null;
      setPhase("idle");
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return (
    <DevChromeHoverHint
      dockCorner={dockCorner}
      body={
        <p>
          Drag from this handle in any direction (8-way). Distance sets how far the hint reads on
          screen; direction tells the agent which side of the anchor region you mean. Inserts into
          the Update handoff note when the dialog is open; otherwise it queues until you open
          Message or finish an Update dictation copy from the panel.
        </p>
      }
    >
      <button
        type="button"
        aria-label="Drag in a direction to append a spatial layout hint to the Update prompt"
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded border text-muted-foreground transition-colors",
          disabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-grab border-border/60 bg-muted/30 hover:border-accent/50 hover:text-accent active:cursor-grabbing",
          phase === "dragging" && "border-accent/70 bg-accent/15 text-accent",
        )}
      >
        <Move className="size-3" strokeWidth={2} aria-hidden />
      </button>
    </DevChromeHoverHint>
  );
}
