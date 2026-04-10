import Link from "next/link";
import { notFound } from "next/navigation";
import DetailShell from "@/components/detail/DetailShell";
import { SkillCopyActions } from "@/components/skills/SkillCopyActions";
import { SKILLS, SKILL_INHERITANCE, COMMANDS } from "@/lib/catalog.generated";
import { PRODUCED_ARTIFACTS, EVAL_RUNS } from "@/lib/eval-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return SKILLS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = SKILLS.find((s) => s.id === id);
  if (!skill) return { title: "Skill not found" };
  return {
    title: `${skill.name} — GAD skill`,
    description: skill.description,
  };
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = SKILLS.find((s) => s.id === id);
  if (!skill) notFound();

  const inheritedBy = SKILL_INHERITANCE[skill.id] ?? [];
  const relatedCommands = COMMANDS.filter((c) => c.id === skill.id || c.id.includes(skill.id));

  // Provenance: which eval runs authored a file matching this skill?
  const authoredByRuns: Array<{ project: string; version: string; humanScore: number | null }> = [];
  for (const [runKey, artifacts] of Object.entries(PRODUCED_ARTIFACTS)) {
    if (
      artifacts.skillFiles?.some(
        (f) =>
          f.name === `${skill.id}.md` ||
          f.name === `${skill.id}/SKILL.md` ||
          f.name.startsWith(`${skill.id}-`)
      )
    ) {
      const [project, version] = runKey.split("/");
      const run = EVAL_RUNS.find((r) => r.project === project && r.version === version);
      authoredByRuns.push({
        project,
        version,
        humanScore: run?.humanReviewNormalized?.aggregate_score ?? run?.humanReview?.score ?? null,
      });
    }
  }

  const sidebar = (
    <>
      <div className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
        <p className="text-xs uppercase tracking-wider text-accent">Copy</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Grab the full SKILL.md or just the YAML frontmatter.
        </p>
        <div className="mt-3">
          <SkillCopyActions raw={skill.bodyRaw} />
        </div>
      </div>

      {authoredByRuns.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
          <p className="text-xs uppercase tracking-wider text-amber-300">Authored by run</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Eval runs whose preserved skill artifacts include a file matching this id.
            Provenance per <Link href="/decisions#gad-76" className="text-accent underline decoration-dotted">gad-76</Link>.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {authoredByRuns.map((r) => (
              <li key={`${r.project}-${r.version}`}>
                <Link
                  href={`/runs/${r.project}/${r.version}`}
                  className="flex items-center justify-between gap-2 rounded border border-border/40 bg-background/40 px-2 py-1.5 font-mono text-[11px] text-foreground hover:border-accent hover:text-accent"
                >
                  <span>{r.project.replace("escape-the-dungeon", "etd")}/{r.version}</span>
                  {r.humanScore != null && (
                    <span className="text-amber-300 tabular-nums">
                      {r.humanScore.toFixed(2)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inheritedBy.length > 0 ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <p className="text-xs uppercase tracking-wider text-emerald-400">Inherited by</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Eval projects that copy this skill into their template/skills/ bootstrap set.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {inheritedBy.map((project) => (
              <li key={project}>
                <code className="text-foreground">{project}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card/30 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Framework-only
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This skill is available to the main GAD agent but is not yet copied into any eval
            project&apos;s bootstrap skill set.
          </p>
        </div>
      )}

      {relatedCommands.length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
          <p className="text-xs uppercase tracking-wider text-accent">Related commands</p>
          <ul className="mt-3 space-y-2 text-sm">
            {relatedCommands.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/commands/${c.id}`}
                  className="font-mono text-xs text-accent hover:underline"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/skills"
        className="block rounded-2xl border border-border/70 bg-card/30 p-5 text-center text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent"
      >
        ← Back to skills
      </Link>
    </>
  );

  return (
    <DetailShell
      kind="skill"
      backHref="/skills"
      backLabel="Back to skills"
      name={skill.name}
      subtitle={skill.id}
      description={skill.description}
      sourcePath={skill.file}
      bodyHtml={skill.bodyHtml}
      sidebar={sidebar}
    />
  );
}
