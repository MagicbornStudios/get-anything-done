import Link from "next/link";

export default function SkillDetailSidebarBackLink() {
  return (
    <Link
      href="/skills"
      className="block rounded-2xl border border-border/70 bg-card/30 p-5 text-center text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent"
    >
      ← Back to skills
    </Link>
  );
}
