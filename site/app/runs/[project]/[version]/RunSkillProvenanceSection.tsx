import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { type EvalRunRecord } from "@/lib/eval-data";

export function RunSkillProvenanceSection({ run }: { run: EvalRunRecord }) {
  const prov = run.skillsProvenance;
  if (!prov) return null;

  const hasInstalled = prov.installed.length > 0;
  const hasInherited = prov.inherited.length > 0;
  const hasAuthored = prov.skillsAuthored.length > 0;
  if (!hasInstalled && !hasInherited && !hasAuthored) return null;

  return (
    <SiteSection cid="run-skill-provenance-section-site-section">
      <Identified as="RunSkillProvenance">
      <SiteSectionHeading kicker="Skill provenance" />
      <Identified as="RunSkillProvenanceIntro">
        <SiteProse size="sm" className="mb-6">
          Skills present at the start and end of this eval run. Per{" "}
          <span className="font-semibold text-foreground">decision gad-120</span>, every skill is tagged
          with its origin: installed from the framework, inherited from a prior run, or authored by the
          agent during this run.
        </SiteProse>
      </Identified>

      <Identified as="RunSkillProvenanceColumns" className="grid gap-6 md:grid-cols-3">
          {hasInstalled && (
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline" className="border-sky-500/50 text-sky-300">
                  Installed
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {prov.installed.length} skill{prov.installed.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-foreground">
                {prov.installed.map((s) => (
                  <li key={s.name} className="font-mono text-xs">
                    {s.name}
                    {s.source && s.source !== "local" && (
                      <span className="ml-2 text-muted-foreground">({s.source})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasInherited && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-300">
                  Inherited
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {prov.inherited.length} skill{prov.inherited.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-foreground">
                {prov.inherited.map((s) => (
                  <li key={s.name} className="font-mono text-xs">
                    {s.name}
                    {s.source && s.source !== "unknown" && (
                      <span className="ml-2 text-muted-foreground">from {s.source}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasAuthored && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline" className="border-amber-500/50 text-amber-300">
                  Authored
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {prov.skillsAuthored.length} skill{prov.skillsAuthored.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-foreground">
                {prov.skillsAuthored.map((name) => (
                  <li key={name} className="font-mono text-xs">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
      </Identified>

        {prov.startSnapshot.length > 0 && (
          <Identified as="RunSkillProvenanceSnapshots" tag="details" className="mt-6">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Full snapshot: {prov.startSnapshot.length} at start, {prov.endSnapshot.length} at end
            </summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Start ({prov.startSnapshot.length})
                </p>
                <ul className="space-y-0.5">
                  {prov.startSnapshot.map((s) => (
                    <li key={s} className="font-mono text-xs text-muted-foreground">{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  End ({prov.endSnapshot.length})
                </p>
                <ul className="space-y-0.5">
                  {prov.endSnapshot.map((s) => (
                    <li key={s} className="font-mono text-xs text-muted-foreground">{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Identified>
        )}
      </Identified>
    </SiteSection>
  );
}
