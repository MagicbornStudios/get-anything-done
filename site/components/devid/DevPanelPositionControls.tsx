"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import { Button } from "@/components/ui/button";

export function DevPanelPositionControls({
  edge,
  corner,
  onEdgeChange,
  onCornerChange,
  trailing,
}: {
  edge: "top" | "bottom";
  corner: "left" | "right";
  onEdgeChange: (edge: "top" | "bottom") => void;
  onCornerChange: (corner: "left" | "right") => void;
  /** e.g. Hints / Plain toggle — docked in the panel footer beside dock controls. */
  trailing?: ReactNode;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border/60 pt-1">
      <div className="flex items-center gap-1">
        <DevChromeHoverHint dockCorner={corner} body={<p>Pin the Visual Context Panel strip to the top edge of this section.</p>}>
          <Button
            type="button"
            variant={edge === "top" ? "secondary" : "ghost"}
            size="icon"
            className="size-5"
            onClick={() => onEdgeChange("top")}
          >
            <ArrowUp size={10} />
          </Button>
        </DevChromeHoverHint>
        <DevChromeHoverHint dockCorner={corner} body={<p>Pin the strip to the bottom edge of this section.</p>}>
          <Button
            type="button"
            variant={edge === "bottom" ? "secondary" : "ghost"}
            size="icon"
            className="size-5"
            onClick={() => onEdgeChange("bottom")}
          >
            <ArrowDown size={10} />
          </Button>
        </DevChromeHoverHint>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-1">
          <DevChromeHoverHint dockCorner={corner} body={<p>Dock the panel toward the left.</p>}>
            <Button
              type="button"
              variant={corner === "left" ? "secondary" : "ghost"}
              size="icon"
              className="size-5"
              onClick={() => onCornerChange("left")}
            >
              <ArrowLeft size={10} />
            </Button>
          </DevChromeHoverHint>
          <DevChromeHoverHint dockCorner={corner} body={<p>Dock the panel toward the right.</p>}>
            <Button
              type="button"
              variant={corner === "right" ? "secondary" : "ghost"}
              size="icon"
              className="size-5"
              onClick={() => onCornerChange("right")}
            >
              <ArrowRight size={10} />
            </Button>
          </DevChromeHoverHint>
        </div>
        {trailing}
      </div>
    </div>
  );
}

