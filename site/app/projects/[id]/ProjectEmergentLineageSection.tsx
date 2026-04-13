import { Identified } from "@/components/devid/Identified";
import Link from "next/link";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { PRODUCED_ARTIFACTS, type EvalRunRecord } from "@/lib/eval-data";

export function ProjectEmergentLineageSection({ runs }: { runs: EvalRunRecord[] }) {
  if (runs.length === 0) return null;
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Skill inheritance lineage"
        preset="section"
        title="The compound-skills hypothesis in action"
      />
      <Identified as="ProjectEmergentLineage">
        <SiteProse size="md" className="mt-3">
          Decision <strong>gad-65</strong> pins the compound-skills hypothesis: as the emergent
          workflow iterates on the same project domain, the inherited skill library should grow more
          specialized and the resulting game should improve in quality and requirements-alignment per
          round. The craftsman metaphor — a blacksmith who writes one skill per hour becomes a master
          of the specific kind of blade they keep forging. Each row below is one emergent run; the
          columns show what the run inherited from the previous round, what it authored itself, and
          what it marked deprecated.
        </SiteProse>

        <div className="mt-10 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Run</th>
                <th className="px-5 py-3 font-medium">Skills in planning/</th>
                <th className="px-5 py-3 font-medium tabular-nums">Total</th>
                <th className="px-5 py-3 font-medium">Net change</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, idx) => {
                const runProduced = PRODUCED_ARTIFACTS[`${run.project}/${run.version}`];
                const skillsInThisRun = runProduced?.skillFiles ?? [];
                const prevRun = runs[idx - 1];
                const prevProduced = prevRun
                  ? PRODUCED_ARTIFACTS[`${prevRun.project}/${prevRun.version}`]
                  : null;
                const prevSkills = new Set((prevProduced?.skillFiles ?? []).map((s) => s.name));
                const currentSkillNames = skillsInThisRun.map((s) => s.name);
                const newlyAuthored = currentSkillNames.filter((n) => !prevSkills.has(n));
                const dropped = [...prevSkills].filter((n) => !currentSkillNames.includes(n));
                return (
                  <tr
                    key={run.version}
                    className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/runs/${run.project}/${run.version}`}
                        className="font-mono text-xs text-accent hover:underline"
                      >
                        {run.version}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      {skillsInThisRun.length === 0 ? (
                        <span className="text-xs text-muted-foreground">(no skills recorded)</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {skillsInThisRun.map((s) => {
                            const isNew = !prevSkills.has(s.name);
                            return (
                              <span
                                key={s.name}
                                className={
                                  isNew
                                    ? "inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300"
                                    : "inline-flex items-center rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                                }
                              >
                                {isNew && "\u2728 "}
                                {s.name.replace(/\.md$/, "")}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-foreground">
                      {skillsInThisRun.length}
                    </td>
                    <td className="px-5 py-3 text-[11px]">
                      {newlyAuthored.length > 0 && (
                        <span className="text-amber-300">+{newlyAuthored.length} authored</span>
                      )}
                      {newlyAuthored.length > 0 && dropped.length > 0 && (
                        <span className="mx-1 text-muted-foreground">·</span>
                      )}
                      {dropped.length > 0 && (
                        <span className="text-red-400">−{dropped.length} dropped</span>
                      )}
                      {newlyAuthored.length === 0 && dropped.length === 0 && (
                        <span className="text-muted-foreground">no net change</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <SiteProse size="sm" className="mt-6 max-w-3xl text-xs leading-5 text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-amber-400" />
            {"\u2728"} newly authored in this run
          </span>
          <span className="ml-4 inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-border" />
            carried over from previous run
          </span>
        </SiteProse>
      </Identified>
    </SiteSection>
  );
}
