import Link from "next/link";

export function HypothesisTracksIntro() {
  return (
    <>
      <p className="section-kicker">Hypothesis tracks</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Every hypothesis,{" "}
        <span className="gradient-text">one line per round.</span>
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        Each line is a research track we are testing. Freedom = bare
        workflow. CSH = emergent workflow. GAD framework = full framework.
        Planned tracks (content-driven, codex runtime) show as dashed ghost
        lines so you can see the research plan even where no data exists
        yet. <strong className="text-foreground">Click a round</strong> to
        filter the Playable Archive below. Read{" "}
        <Link href="/skeptic" className="text-accent underline decoration-dotted">
          /skeptic
        </Link>{" "}
        before trusting any individual point — sample sizes are small.
      </p>
    </>
  );
}
