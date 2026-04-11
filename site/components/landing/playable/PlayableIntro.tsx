"use client";

export function PlayableIntro() {
  return (
    <>
      <p className="section-kicker">Playable archive</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Every build we scored. <span className="gradient-text">Playable in your browser.</span>
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        These are the exact production builds the human reviewers scored — no rebuilds, no
        tweaks. Click a round on the{" "}
        <a href="#tracks" className="text-accent underline decoration-dotted">hypothesis chart above</a>{" "}
        to filter, or use the controls below to search and filter. Hover any build badge for details.
      </p>
    </>
  );
}
