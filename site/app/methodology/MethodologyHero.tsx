export function MethodologyHero() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Methodology</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          Every formula, <span className="gradient-text">every weight,</span> every cap.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          This page is the appendix. Every number on the site — every bar, every composite, every
          &quot;gate passed&quot; badge — traces back to one of the formulas below. If you want to verify a
          run yourself, pull its{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TRACE.json</code> from
          GitHub and run the math from here.
        </p>
      </div>
    </section>
  );
}
