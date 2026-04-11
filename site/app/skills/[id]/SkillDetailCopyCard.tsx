import { SkillCopyActions } from "@/components/skills/SkillCopyActions";
import { Card, CardContent } from "@/components/ui/card";

export default function SkillDetailCopyCard({ bodyRaw }: { bodyRaw: string }) {
  return (
    <Card className="border-accent/40 bg-accent/5 shadow-none">
      <CardContent className="space-y-3 p-5">
        <p className="text-xs uppercase tracking-wider text-accent">Copy</p>
        <p className="text-xs text-muted-foreground">
          Grab the full SKILL.md or just the YAML frontmatter.
        </p>
        <SkillCopyActions raw={bodyRaw} />
      </CardContent>
    </Card>
  );
}
