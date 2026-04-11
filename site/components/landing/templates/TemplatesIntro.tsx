export function TemplatesIntro() {
  return (
    <>
      <p className="section-kicker">Downloads</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Every template we ship. <span className="gradient-text">Zip. Extract. Go.</span>
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        The GAD pack template is the full set of 34+ markdown templates the CLI uses to
        scaffold new projects — requirements, roadmap, state, task registry, phase prompts,
        debug reports, verification artifacts, codebase docs. Every eval project ships its
        own <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">template/</code>{" "}
        directory containing the minimum viable workspace an agent needs to start that eval.
      </p>
    </>
  );
}
