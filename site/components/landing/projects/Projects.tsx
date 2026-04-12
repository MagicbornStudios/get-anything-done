import { Sprout, TreePine } from "lucide-react";
import { ProjectsIntro } from "@/components/landing/projects/ProjectsIntro";
import { ProjectsTier } from "@/components/landing/projects/ProjectsTier";
import { PROJECTS } from "@/components/landing/projects/projects-shared";
import { SiteSection } from "@/components/site";

export default function Projects() {
  const greenfield = PROJECTS.filter((p) => p.mode === "greenfield");
  const brownfield = PROJECTS.filter((p) => p.mode === "brownfield");

  return (
    <SiteSection id="projects" className="border-t border-border/60">
      <ProjectsIntro />

      <ProjectsTier
        icon={Sprout}
        iconClassName="text-emerald-400"
        title="Greenfield — rounds 1 through 3 shipped"
        projects={greenfield}
      />

      <ProjectsTier
        icon={TreePine}
        iconClassName="text-amber-400"
        title="Brownfield — round 1 planned on v4"
        projects={brownfield}
      />
    </SiteSection>
  );
}
