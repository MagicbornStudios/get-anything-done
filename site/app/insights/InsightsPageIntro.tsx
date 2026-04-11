export function InsightsPageIntro() {
  return (
    <header className="max-w-3xl">
      <p className="section-kicker">Insights</p>
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        Structured data from every eval, <span className="gradient-text">every session.</span>
      </h1>
      <p className="mt-5 text-lg leading-8 text-muted-foreground">
        Curated queries against eval traces, planning artifacts, and self-evaluation metrics. Every
        number on this page has a source — computed from TRACE.json, TASK-REGISTRY.xml, DECISIONS.xml,
        and .gad-log/ trace data at build time.
      </p>
    </header>
  );
}
