import { SiteSectionIntro } from "@/components/site";

export function RequirementsIntro() {
  return (
    <SiteSectionIntro
      kicker="Game requirements"
      preset="hero-compact"
      title={
        <>
          Four versions. <span className="gradient-text">One dungeon.</span> A lineage of what we
          thought &quot;good&quot; looked like.
        </>
      }
    >
      Every round rewrote the requirements after watching real agents attempt them. The diffs
      below are the honest version — here&apos;s what v1 couldn&apos;t catch, here&apos;s what v2
      got wrong, here&apos;s what v3 was still too soft on. Download the current v4 XML and try to
      build the game yourself — it&apos;s the same spec the agents run against.
    </SiteSectionIntro>
  );
}
