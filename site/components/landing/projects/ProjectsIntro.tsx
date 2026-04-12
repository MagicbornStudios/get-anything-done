import { SiteProse, SiteSectionHeading } from "@/components/site";

export function ProjectsIntro() {
  return (
    <>
      <SiteSectionHeading
        kicker="Eval projects"
        preset="hero-compact"
        title={
          <>
            Three greenfield conditions. <span className="gradient-text">Three brownfield.</span>{" "}
            Same spec, different constraints.
          </>
        }
      />
      <SiteProse className="mt-5">
        Greenfield runs build the game from nothing. Brownfield runs inherit a codebase —
        specifically the bare v3 build (the highest human-reviewed run to date) — and try to extend
        it under v4 pressure requirements. If the freedom hypothesis survives brownfield, it&apos;s
        real. If GAD finally wins on extension, that tells us the framework&apos;s value is in
        maintenance, not creation.
      </SiteProse>
    </>
  );
}
