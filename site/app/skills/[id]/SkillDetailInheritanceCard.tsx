export default function SkillDetailInheritanceCard({
  inheritedBy,
}: {
  inheritedBy: string[];
}) {
  if (inheritedBy.length > 0) {
    return (
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
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/30 p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Framework-only
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        This skill is available to the main GAD agent but is not yet copied into any eval
        project&apos;s bootstrap skill set.
      </p>
    </div>
  );
}
