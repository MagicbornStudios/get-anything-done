import { SiteSectionIntro } from "@/components/site";

export function ResultsIntro() {
  return (
    <SiteSectionIntro
      kicker="Evolution 3 results"
      preset="hero-compact"
      title={
        <>
          The freedom hypothesis: <span className="gradient-text">bare beat GAD</span> on
          creative implementation.
        </>
      }
    >
      We ran the same task — &quot;build a roguelike dungeon crawler called Escape the
      Dungeon&quot; — across all three workflows, three rounds in a row, with the same v3
      requirements. Across every metric the human reviewers cared about, the bare and emergent
      workflows shipped better games than the full GAD framework. That wasn&apos;t the result we
      expected, and it sent us back to redesign v4 of the requirements around <em>pressure</em>,
      not features.
    </SiteSectionIntro>
  );
}
