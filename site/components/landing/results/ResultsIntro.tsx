export function ResultsIntro() {
  return (
    <>
      <p className="section-kicker">Round 3 results</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        The freedom hypothesis: <span className="gradient-text">bare beat GAD</span> on creative
        implementation.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        We ran the same task — &quot;build a roguelike dungeon crawler called Escape the Dungeon&quot; —
        across all three workflows, three rounds in a row, with the same v3 requirements. Across
        every metric the human reviewers cared about, the bare and emergent workflows shipped
        better games than the full GAD framework. That wasn&apos;t the result we expected, and it
        sent us back to redesign v4 of the requirements around <em>pressure</em>, not features.
      </p>
    </>
  );
}
