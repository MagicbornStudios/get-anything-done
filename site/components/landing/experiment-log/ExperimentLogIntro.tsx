"use client";

export function ExperimentLogIntro() {
  return (
    <>
      <p className="section-kicker">Experiment log</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Round by round. <span className="gradient-text">What we asked.</span> What the agents
        actually shipped.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        The experiment log is append-only. Each entry captures the requirements version, the
        workflow conditions that ran, the scores, and the key finding that drove the next
        round&apos;s changes.
      </p>
    </>
  );
}
