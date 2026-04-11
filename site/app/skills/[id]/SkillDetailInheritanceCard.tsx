import { Card, CardContent } from "@/components/ui/card";

export default function SkillDetailInheritanceCard({
  inheritedBy,
}: {
  inheritedBy: string[];
}) {
  if (inheritedBy.length > 0) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5 shadow-none">
        <CardContent className="space-y-3 p-5">
          <p className="text-xs uppercase tracking-wider text-emerald-400">Inherited by</p>
          <p className="text-xs text-muted-foreground">
            Eval projects that copy this skill into their template/skills/ bootstrap set.
          </p>
          <ul className="space-y-1 text-sm">
            {inheritedBy.map((project) => (
              <li key={project}>
                <code className="text-foreground">{project}</code>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/30 shadow-none">
      <CardContent className="space-y-3 p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Framework-only</p>
        <p className="text-xs text-muted-foreground">
          This skill is available to the main GAD agent but is not yet copied into any eval
          project&apos;s bootstrap skill set.
        </p>
      </CardContent>
    </Card>
  );
}
