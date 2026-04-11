"use client";

export function CatalogIntro() {
  return (
    <>
      <p className="section-kicker">The catalog</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Every skill, subagent, and command <span className="gradient-text">in the box.</span>
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        Skills are methodology docs the main agent follows. Subagents are specialised workers
        the framework spawns for planning, research, verification, UI audits, and more. Commands
        are the slash-command entry points. All of this is scanned directly out of{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">skills/</code>,{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">agents/</code>, and{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">commands/gad/</code> at build
        time — this list stays in sync with the repo.
      </p>
    </>
  );
}
