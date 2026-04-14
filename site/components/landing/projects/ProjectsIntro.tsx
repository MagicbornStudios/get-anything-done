import { SiteSectionIntro } from "@/components/site";

export function ProjectsIntro() {
  return (
    <SiteSectionIntro
      kicker="Eval projects"
      preset="hero-compact"
      title={
        <>
          Two projects. <span className="gradient-text">Three species each.</span>{" "}
          Same spec, different DNA.
        </>
      }
    >
      Each project (escape-the-dungeon, gad-explainer-video) hosts three species — gad, bare,
      and emergent — that share the same requirements but differ in which context framework
      they were given. Generations within a species accumulate as the requirements evolve.
      Comparing species across the same evolution is how we test which scaffolding (full GAD,
      bare baseline, or emergent skill inheritance) actually delivers under pressure.
    </SiteSectionIntro>
  );
}

