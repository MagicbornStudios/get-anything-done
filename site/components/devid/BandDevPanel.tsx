"use client";

import { DevPanel } from "./DevPanel";
import type { DevIdComponentTag } from "./SectionRegistry";

export function BandDevPanel({
  cid,
  label,
  edge = "top",
  corner = "right",
  componentTag,
  searchHint,
  onDismiss,
}: {
  cid: string;
  label: string;
  edge?: "top" | "bottom";
  corner?: "left" | "right";
  componentTag?: DevIdComponentTag;
  searchHint?: string;
  /** Called when the user dismisses this band panel. */
  onDismiss?: () => void;
}) {
  return (
    <DevPanel
      mode="band"
      cid={cid}
      label={label}
      edge={edge}
      corner={corner}
      componentTag={componentTag}
      searchHint={searchHint}
      onDismiss={onDismiss}
    />
  );
}
