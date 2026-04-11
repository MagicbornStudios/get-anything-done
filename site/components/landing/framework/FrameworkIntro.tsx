export function FrameworkIntro() {
  return (
    <>
      <p className="section-kicker">The eval framework</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Three workflows. <span className="gradient-text">One scoring formula.</span> No hiding behind process metrics.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        Each eval project ships a <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">REQUIREMENTS.xml</code>{" "}
        with versioned gate criteria. Every run produces a <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TRACE.json</code>{" "}
        with a composite score. Process metrics matter, but they cannot rescue a run that ships
        a broken game — human review weighs 30% precisely so &quot;the process was followed&quot;
        isn&apos;t a free pass.
      </p>
    </>
  );
}
