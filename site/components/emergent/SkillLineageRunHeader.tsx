import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function SkillLineageRunHeader({
  version,
  date,
  playable,
  projectHref,
  runHref,
}: {
  version: string;
  date: string | null;
  playable: boolean;
  projectHref: string;
  runHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="font-mono text-[11px] font-normal normal-case">
        {version}
      </Badge>
      <span className="text-sm text-muted-foreground">{date}</span>
      {playable && (
        <Button
          variant="outline"
          size="sm"
          className="h-auto gap-1 rounded-full border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
          asChild
        >
          <Link href={projectHref}>
            Playable
            <ArrowRight size={9} aria-hidden />
          </Link>
        </Button>
      )}
      <Button
        variant="link"
        className="ml-auto h-auto gap-1 p-0 text-xs font-semibold text-accent"
        asChild
      >
        <Link href={runHref}>
          Full breakdown
          <ArrowRight size={11} aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
