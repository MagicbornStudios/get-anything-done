export function RequirementsIntro() {
  return (
    <>
      <p className="section-kicker">Game requirements</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Four versions. <span className="gradient-text">One dungeon.</span> A lineage of what we
        thought &quot;good&quot; looked like.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        Every round rewrote the requirements after watching real agents attempt them. The
        diffs below are the honest version — here&apos;s what v1 couldn&apos;t catch, here&apos;s
        what v2 got wrong, here&apos;s what v3 was still too soft on. Download the current v4
        XML and try to build the game yourself — it&apos;s the same spec the agents run against.
      </p>
    </>
  );
}
