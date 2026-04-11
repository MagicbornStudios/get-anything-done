export function RunItIntro() {
  return (
    <>
      <p className="section-kicker">Run it locally</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        One repo. <span className="gradient-text">One CLI.</span> Five commands to your first eval
        run.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        The CLI lives at{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">bin/gad.cjs</code>. The eval projects
        live under <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">evals/</code>. Everything
        else is committed planning state. No services, no auth, no telemetry.
      </p>
    </>
  );
}
