"use client";

import { type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  X,
} from "lucide-react";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import { Identified } from "@/components/devid/Identified";
import { usePanelChord } from "@/components/devid/vc-chord";
import { Button } from "@/components/ui/button";

/**
 * Stable identity literals for the Visual Context Panel footer region.
 * Keep these in source so VCS prompts can target the directional footer
 * by name (route: <cid> / stableCid) without running a useId suffix.
 */
export const VC_PANEL_FOOTER_STABLE_CID = "visual-context-panel-footer";
export const VC_PANEL_FOOTER_LABEL = "Visual Context Panel Footer";

export function DevPanelPositionControls({
  edge,
  corner,
  onEdgeChange,
  onCornerChange,
  trailing,
  onDismissPanel,
}: {
  edge: "top" | "bottom";
  corner: "left" | "right";
  onEdgeChange: (edge: "top" | "bottom") => void;
  onCornerChange: (corner: "left" | "right") => void;
  /** e.g. Hints / Plain toggle — docked in the panel footer beside dock controls. */
  trailing?: ReactNode;
  /** When set, holding Ctrl shows a dismiss (X) button in the footer. */
  onDismissPanel?: () => void;
}) {
  const ctrlHeld = usePanelChord().ctrl;

  /** When Ctrl is held and onDismissPanel is provided, arrows whose direction is
   *  already active (no-op) transform into dismiss (X) buttons. */
  const topIsActive = edge === "top";
  const bottomIsActive = edge === "bottom";
  const leftIsActive = corner === "left";
  const rightIsActive = corner === "right";

  const dismiss = ctrlHeld && onDismissPanel;

  const dismissClass = "text-destructive hover:bg-destructive/15 hover:text-destructive";

  return (
    <Identified
      as="VisualContextPanelFooter"
      stableCid={VC_PANEL_FOOTER_STABLE_CID}
      register={false}
      className="relative z-10 mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border/60 pt-1"
    >
      <div className="flex items-center gap-1">
        <DevChromeHoverHint
          dockCorner={corner}
          body={<p>{dismiss && topIsActive ? "Close this context panel." : "Pin the Visual Context Panel strip to the top edge of this section."}</p>}
        >
          <Button
            type="button"
            variant={topIsActive ? (dismiss ? "ghost" : "secondary") : "ghost"}
            size="icon"
            className={["size-5", dismiss && topIsActive ? dismissClass : ""].join(" ")}
            onClick={dismiss && topIsActive ? onDismissPanel : () => onEdgeChange("top")}
            aria-label={dismiss && topIsActive ? "Close context panel" : undefined}
          >
            {dismiss && topIsActive ? <X size={10} strokeWidth={2.5} /> : <ArrowUp size={10} />}
          </Button>
        </DevChromeHoverHint>
        <DevChromeHoverHint
          dockCorner={corner}
          body={<p>{dismiss && bottomIsActive ? "Close this context panel." : "Pin the strip to the bottom edge of this section."}</p>}
        >
          <Button
            type="button"
            variant={bottomIsActive ? (dismiss ? "ghost" : "secondary") : "ghost"}
            size="icon"
            className={["size-5", dismiss && bottomIsActive ? dismissClass : ""].join(" ")}
            onClick={dismiss && bottomIsActive ? onDismissPanel : () => onEdgeChange("bottom")}
            aria-label={dismiss && bottomIsActive ? "Close context panel" : undefined}
          >
            {dismiss && bottomIsActive ? <X size={10} strokeWidth={2.5} /> : <ArrowDown size={10} />}
          </Button>
        </DevChromeHoverHint>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-1">
          <DevChromeHoverHint
            dockCorner={corner}
            body={<p>{dismiss && leftIsActive ? "Close this context panel." : "Dock the panel toward the left."}</p>}
          >
            <Button
              type="button"
              variant={leftIsActive ? (dismiss ? "ghost" : "secondary") : "ghost"}
              size="icon"
              className={["size-5", dismiss && leftIsActive ? dismissClass : ""].join(" ")}
              onClick={dismiss && leftIsActive ? onDismissPanel : () => onCornerChange("left")}
              aria-label={dismiss && leftIsActive ? "Close context panel" : undefined}
            >
              {dismiss && leftIsActive ? <X size={10} strokeWidth={2.5} /> : <ArrowLeft size={10} />}
            </Button>
          </DevChromeHoverHint>
          <DevChromeHoverHint
            dockCorner={corner}
            body={<p>{dismiss && rightIsActive ? "Close this context panel." : "Dock the panel toward the right."}</p>}
          >
            <Button
              type="button"
              variant={rightIsActive ? (dismiss ? "ghost" : "secondary") : "ghost"}
              size="icon"
              className={["size-5", dismiss && rightIsActive ? dismissClass : ""].join(" ")}
              onClick={dismiss && rightIsActive ? onDismissPanel : () => onCornerChange("right")}
              aria-label={dismiss && rightIsActive ? "Close context panel" : undefined}
            >
              {dismiss && rightIsActive ? <X size={10} strokeWidth={2.5} /> : <ArrowRight size={10} />}
            </Button>
          </DevChromeHoverHint>
        </div>
        {trailing}
      </div>
    </Identified>
  );
}

