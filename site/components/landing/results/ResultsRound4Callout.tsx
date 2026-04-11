export function ResultsRound4Callout() {
  return (
    <div className="mt-12 rounded-2xl border border-accent/40 bg-accent/5 p-6 md:p-8">
      <p className="section-kicker">What we changed for round 4</p>
      <h3 className="mt-1 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
        Pressure, not features. Ingenuity, not checklists.
      </h3>
      <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
        v4 of the requirements stops asking the agent to build a list of systems and starts
        asking whether the resulting game <em>requires</em> player ingenuity to progress.
        Authored dungeon, floors with mechanical constraints that punish brute-force play, a
        forge that&apos;s tied to the encounter design instead of being a side ornament. The
        same three workflows will run round 4 against v4 to test whether the freedom hypothesis
        holds when the spec is harder to game.
      </p>
    </div>
  );
}
