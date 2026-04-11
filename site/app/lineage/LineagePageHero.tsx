export function LineagePageHero() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Lineage</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          GAD didn&apos;t invent this. <span className="gradient-text">It builds on two approaches.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          The problem every agent-driven development framework is trying to solve is the same one:{" "}
          <strong className="text-foreground">context rot</strong>. As a coding session runs longer,
          the agent&apos;s working memory drifts. What it decided an hour ago gets contradicted.
          Decisions resurface as new questions. Half-finished work becomes invisible because it&apos;s
          buried under the next concern. Eventually the agent is confidently producing inconsistent
          code against requirements it no longer remembers.
        </p>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
          Two earlier projects tried to fix this before GAD. Both are load-bearing in how GAD thinks
          about the loop, and GAD is &mdash; honestly &mdash; mostly a combination of their ideas
          plus a measurement layer stapled on.
        </p>
      </div>
    </section>
  );
}
