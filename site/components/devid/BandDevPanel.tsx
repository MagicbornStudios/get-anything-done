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
}: {
  cid: string;
  label: string;
  edge?: "top" | "bottom";
  corner?: "left" | "right";
  componentTag?: DevIdComponentTag;
  searchHint?: string;
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
    />
  );
}
