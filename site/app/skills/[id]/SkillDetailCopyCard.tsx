import { SkillCopyActions } from "@/components/skills/SkillCopyActions";

export default function SkillDetailCopyCard({ bodyRaw }: { bodyRaw: string }) {
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
      <p className="text-xs uppercase tracking-wider text-accent">Copy</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Grab the full SKILL.md or just the YAML frontmatter.
      </p>
      <div className="mt-3">
        <SkillCopyActions raw={bodyRaw} />
      </div>
    </div>
  );
}
