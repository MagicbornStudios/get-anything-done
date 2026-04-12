import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { SKILLS, SKILL_INHERITANCE } from "@/lib/catalog.generated";

export function GadSkillBootstrapSection() {
  const officialSkills = SKILLS.filter((s) => s.source === "sdk");
  const bootstrapSkills = officialSkills.filter((s) => (SKILL_INHERITANCE[s.id] ?? []).length > 0);
  const frameworkOnlySkills = officialSkills.filter((s) => (SKILL_INHERITANCE[s.id] ?? []).length === 0);

  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Skill bootstrap sets"
        title="Framework-level vs eval-inherited"
        preset="section"
      />
      <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
        GAD ships {officialSkills.length} official skills as the canonical consumer/runtime surface. But
        eval projects (bare, emergent) do not get the full framework - they start with a minimal
        bootstrap set copied into their{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">template/skills/</code>{" "}
        directory. The rest of the framework is withheld by design so we can see what they build
        without it.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
              bootstrap
            </Badge>
            <h3 className="text-lg font-semibold text-foreground">
              Inherited by bare + emergent ({bootstrapSkills.length})
            </h3>
          </div>
          <div className="space-y-2">
            {bootstrapSkills.map((s) => (
              <Link
                key={s.id}
                href={`/skills/${s.id}`}
                className="block rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition-colors hover:border-emerald-500/60"
              >
                <code className="text-sm font-mono text-accent">{s.name}</code>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wider text-emerald-400">
                  inherited by: {(SKILL_INHERITANCE[s.id] ?? []).join(", ")}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="outline">framework-only</Badge>
            <h3 className="text-lg font-semibold text-foreground">
              Available to full GAD runs only ({frameworkOnlySkills.length})
            </h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {frameworkOnlySkills.map((s) => (
              <Link
                key={s.id}
                href={`/skills/${s.id}`}
                className="block rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:border-accent/60"
              >
                <code className="text-[11px] font-mono text-accent">{s.name}</code>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </SiteSection>
  );
}
