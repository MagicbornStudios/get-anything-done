export function ProjectsIntro() {
  return (
    <>
      <p className="section-kicker">Eval projects</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Three greenfield conditions. <span className="gradient-text">Three brownfield.</span>{" "}
        Same spec, different constraints.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        Greenfield runs build the game from nothing. Brownfield runs inherit a codebase —
        specifically the bare v3 build (the highest human-reviewed run to date) — and try to
        extend it under v4 pressure requirements. If the freedom hypothesis survives
        brownfield, it&apos;s real. If GAD finally wins on extension, that tells us the
        framework&apos;s value is in maintenance, not creation.
      </p>
    </>
  );
}
