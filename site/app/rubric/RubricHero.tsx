import Link from "next/link";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function RubricHero() {
  return (
    <SiteSection cid="rubric-hero-site-section">
      <SiteSectionHeading
        kicker="Human review rubric"
        as="h1"
        preset="hero"
        title={
          <>
            How we score a playthrough.{" "}
            <span className="gradient-text">Per-dimension, not a single number.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        Every eval run gets human playtested. A single summary score is lossy, so we decompose review
        into per-project rubrics: a handful of named dimensions, each scored 0.0 – 1.0, each with a
        fixed weight. The weighted sum becomes the{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 text-sm">human_review.score</code> the
        composite formula consumes. The emergent workflow gets a sixth dimension that specifically
        tests the{" "}
        <Link href="/findings" className="text-accent underline decoration-dotted">
          compound-skills hypothesis
        </Link>
        .
      </SiteProse>
      <SiteProse size="sm" className="mt-4">
        Source of truth: the{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 text-xs">human_review_rubric</code> block on
        each project&apos;s{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 text-xs">gad.json</code>. Rubric version is
        stamped on every submitted review so historical scores remain comparable when dimensions
        change.
      </SiteProse>
    </SiteSection>
  );
}

