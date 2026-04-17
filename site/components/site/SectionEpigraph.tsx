import { Quote } from "lucide-react";
import {
  type EpigraphSection,
  pickEpigraph,
  getEpigraph,
} from "@/lib/epigraphs";
import { cn } from "@/lib/utils";

/**
 * Task 45-16: drop-in epigraph divider between site sections.
 *
 * Renders the Sun Tzu `original` as small muted text and the codebase-
 * adapted line as the emphasised takeaway. Pass an optional `seed` to
 * pick a specific epigraph from the section's bucket deterministically
 * (same seed → same epigraph across renders).
 *
 * Data source: `site/lib/epigraphs.ts` (task 45-05). If the section has
 * no registered epigraphs the component renders nothing — safe to drop
 * between any two sections without a guard at the call site.
 */
export function SectionEpigraph({
  section,
  seed,
  className,
  align = "left",
}: {
  section: EpigraphSection;
  /** Optional seed for deterministic pick when a section has multiple entries. */
  seed?: number | string;
  /** Extra classes on the wrapper. */
  className?: string;
  /** Horizontal alignment within the wrapper. */
  align?: "left" | "center";
}) {
  const entry = seed !== undefined
    ? pickEpigraph(section, seed)
    : getEpigraph(section);
  if (!entry) return null;

  return (
    <div
      data-cid={`section-epigraph-${section}`}
      className={cn(
        "border-y border-border/30 bg-muted/10 py-8",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-3xl px-4",
          align === "center" && "text-center",
        )}
      >
        <Quote
          size={18}
          className={cn(
            "mb-3 text-accent/60",
            align === "center" && "mx-auto",
          )}
          aria-hidden
        />
        <p className="text-base italic leading-relaxed text-foreground md:text-lg">
          “{entry.adapted}”
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          After {entry.attribution}:{" "}
          <span className="italic">“{entry.original}”</span>
        </p>
      </div>
    </div>
  );
}
