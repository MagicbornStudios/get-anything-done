import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SkillDetailSidebarBackLink() {
  return (
    <Button
      variant="outline"
      className="h-auto w-full rounded-2xl border-border/70 bg-card/30 py-5 text-center text-xs font-semibold text-muted-foreground hover:border-accent hover:text-accent"
      asChild
    >
      <Link href="/skills">← Back to skills</Link>
    </Button>
  );
}
