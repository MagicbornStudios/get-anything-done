import { Quote } from "lucide-react";
import {
  type EpigraphSection,
  pickEpigraph,
  getEpigraph,
} from "@/lib/epigraphs";
import { cn } from "@/lib/utils";

/**
 * Drop-in epigraph divider between site sections.
 *
 * Renders the verbatim `original` quote as the emphasised hero line (attribution
 * inline) and surfaces the codebase `adapted` gloss as a small muted subtitle —
 * clearly marked as our interpretation, not a fabricated Sun Tzu line. This
 * order change (direct quote first) lands with the landing-page copy cleanup
 * (2026-04-17) after the "no morphed quotes" feedback.
 *
 * Data source: `site/lib/epigraphs.ts` (task 45-05). If the section has no
 * registered epigraphs the component renders nothing — safe to drop between
 * any two sections without a guard at the call site. If an entry omits
 * `adapted`, only the direct quote renders.
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

  const showGloss = entry.adapted && entry.adapted.trim().length > 0;

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
          &ldquo;{entry.original}&rdquo;
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          &mdash; {entry.attribution}
        </p>
        {showGloss ? (
          <p
            className={cn(
              "mt-4 text-xs leading-relaxed text-muted-foreground/90",
              align !== "center" && "border-l-2 border-accent/40 pl-3",
            )}
          >
            <span className="mr-1 uppercase tracking-wide text-accent/70">
              In our model
            </span>
            <span>{entry.adapted}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
