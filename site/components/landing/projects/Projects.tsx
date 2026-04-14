import { Sprout } from "lucide-react";
import { ProjectsIntro } from "@/components/landing/projects/ProjectsIntro";
import { ProjectsTier } from "@/components/landing/projects/ProjectsTier";
import { PROJECTS } from "@/components/landing/projects/projects-shared";
import { SiteSection } from "@/components/site";

export default function Projects() {
  return (
    <SiteSection id="projects" className="border-t border-border/60">
      <ProjectsIntro />

      <ProjectsTier
        icon={Sprout}
        iconClassName="text-emerald-400"
        title="Species across our projects"
        projects={PROJECTS}
      />
    </SiteSection>
  );
}
