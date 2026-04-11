import type { LucideIcon } from "lucide-react";
import { ProjectEvalCard } from "@/components/landing/projects/ProjectEvalCard";
import type { ProjectCard } from "@/components/landing/projects/projects-shared";

type Props = {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  projects: ProjectCard[];
};

export function ProjectsTier({ icon: Icon, iconClassName, title, projects }: Props) {
  return (
    <div className="mt-12">
      <div className="mb-4 flex items-center gap-3">
        <Icon size={18} className={iconClassName} aria-hidden />
        <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <ProjectEvalCard key={p.project} project={p} />
        ))}
      </div>
    </div>
  );
}
