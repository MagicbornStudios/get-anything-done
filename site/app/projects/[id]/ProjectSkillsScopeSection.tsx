import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EvalProjectMeta } from "@/lib/eval-data";
import { SKILLS } from "@/lib/catalog.generated";
import { scopedSkillsFor } from "@/app/projects/[id]/project-detail-shared";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function ProjectSkillsScopeSection({ project }: { project: EvalProjectMeta }) {
  const scope = scopedSkillsFor({ workflow: project.workflow, id: project.id });

  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        kicker="Catalog scope"
        preset="section"
        title="What skills this project can use"
      />
      <SiteProse size="md" className="mt-3">
        {scope.description}
      </SiteProse>

      {scope.kind === "framework" && (
        <Badge
          variant="outline"
          className="mt-4 gap-2 border-sky-500/40 bg-sky-500/5 px-4 py-2 text-xs font-semibold normal-case tracking-normal text-sky-300"
        >
          <Sparkles size={12} aria-hidden />
          Full framework catalog — {SKILLS.length} skills available
        </Badge>
      )}
      {scope.kind === "bootstrap-only" && (
        <Badge
          variant="outline"
          className="mt-4 gap-2 border-emerald-500/40 bg-emerald-500/5 px-4 py-2 text-xs font-semibold normal-case tracking-normal text-emerald-300"
        >
          <Sparkles size={12} aria-hidden />
          Bootstrap set — {scope.skills.length} skill{scope.skills.length === 1 ? "" : "s"}{" "}
          inherited
        </Badge>
      )}

      {scope.kind !== "framework" && scope.skills.length > 0 && (
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {scope.skills.map((s) => (
            <Link
              key={s.id}
              href={`/skills/${s.id}`}
              className="block rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition-colors hover:border-emerald-500/60"
            >
              <code className="font-mono text-sm text-accent">{s.name}</code>
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{s.description}</p>
            </Link>
          ))}
        </div>
      )}
      {scope.kind === "framework" && (
        <Button
          variant="outline"
          size="sm"
          className="mt-8 gap-2 rounded-full border-border/70 bg-card/40 px-5 py-2.5 text-xs font-semibold hover:border-accent hover:text-accent"
          asChild
        >
          <Link href="/gad">Browse the full GAD catalog →</Link>
        </Button>
      )}
    </SiteSection>
  );
}
