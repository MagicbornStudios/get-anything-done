import type { ResolvedRef } from "./ref-types";
import { REF_SEGMENT_COLORS } from "./ref-segment-styles";

export function RefColorCodedId({ segments }: { segments: ResolvedRef["segments"] }) {
  return (
    <span className="font-mono text-[10px]">
      {segments.namespace && (
        <>
          <span className={REF_SEGMENT_COLORS.namespace}>{segments.namespace}</span>
          <span className="text-muted-foreground/50">-</span>
        </>
      )}
      {segments.type && (
        <>
          <span className={REF_SEGMENT_COLORS[segments.type] || "text-foreground"}>
            {segments.type}
          </span>
          <span className="text-muted-foreground/50">-</span>
        </>
      )}
      <span className={REF_SEGMENT_COLORS.number}>{segments.number}</span>
    </span>
  );
}
