import Link from "next/link";
import { notFound } from "next/navigation";
import DetailShell from "@/components/detail/DetailShell";
import { SKILLS, SKILL_INHERITANCE, COMMANDS } from "@/lib/catalog.generated";

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

  const sidebar = (
    <>
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
        href="/#catalog"
        className="block rounded-2xl border border-border/70 bg-card/30 p-5 text-center text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent"
      >
        ← Back to catalog
      </Link>
    </>
  );

  return (
    <DetailShell
      kind="skill"
      backHref="/#catalog"
      backLabel="Back to catalog"
      name={skill.name}
      subtitle={skill.id}
      description={skill.description}
      sourcePath={skill.file}
      bodyHtml={skill.bodyHtml}
      sidebar={sidebar}
    />
  );
}
