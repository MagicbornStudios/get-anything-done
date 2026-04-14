"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DevPanelPositionControls({
  edge,
  corner,
  onEdgeChange,
  onCornerChange,
}: {
  edge: "top" | "bottom";
  corner: "left" | "right";
  onEdgeChange: (edge: "top" | "bottom") => void;
  onCornerChange: (corner: "left" | "right") => void;
}) {
  return (
    <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-1">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={edge === "top" ? "secondary" : "ghost"}
          size="icon"
          className="size-5"
          title="Place panel at top"
          onClick={() => onEdgeChange("top")}
        >
          <ArrowUp size={10} />
        </Button>
        <Button
          type="button"
          variant={edge === "bottom" ? "secondary" : "ghost"}
          size="icon"
          className="size-5"
          title="Place panel at bottom"
          onClick={() => onEdgeChange("bottom")}
        >
          <ArrowDown size={10} />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={corner === "left" ? "secondary" : "ghost"}
          size="icon"
          className="size-5"
          title="Place panel at left"
          onClick={() => onCornerChange("left")}
        >
          <ArrowLeft size={10} />
        </Button>
        <Button
          type="button"
          variant={corner === "right" ? "secondary" : "ghost"}
          size="icon"
          className="size-5"
          title="Place panel at right"
          onClick={() => onCornerChange("right")}
        >
          <ArrowRight size={10} />
        </Button>
      </div>
    </div>
  );
}

