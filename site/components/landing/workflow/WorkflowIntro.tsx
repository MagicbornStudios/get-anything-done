export function WorkflowIntro() {
  return (
    <>
      <p className="section-kicker">The loop</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Five steps. <span className="gradient-text">Every session.</span> No variation.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        snapshot → pick one task → implement → update planning docs → commit. The CLI gives the
        agent a single command to re-hydrate context; skills tell the agent what methodology
        to apply; subagents do the expensive work off the main thread. That&apos;s the whole
        framework.
      </p>
    </>
  );
}
