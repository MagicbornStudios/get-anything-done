import Link from "next/link";

export function RubricHero() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Human review rubric</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          How we score a playthrough.{" "}
          <span className="gradient-text">Per-dimension, not a single number.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          Every eval run gets human playtested. A single summary score is lossy, so we decompose
          review into per-project rubrics: a handful of named dimensions, each scored 0.0 – 1.0,
          each with a fixed weight. The weighted sum becomes the{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-sm">human_review.score</code> the
          composite formula consumes. The emergent workflow gets a sixth dimension that
          specifically tests the{" "}
          <Link href="/findings" className="text-accent underline decoration-dotted">
            compound-skills hypothesis
          </Link>
          .
        </p>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          Source of truth: the{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-xs">human_review_rubric</code> block
          on each project&apos;s{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-xs">gad.json</code>. Rubric version
          is stamped on every submitted review so historical scores remain comparable when dimensions
          change.
        </p>
      </div>
    </section>
  );
}
