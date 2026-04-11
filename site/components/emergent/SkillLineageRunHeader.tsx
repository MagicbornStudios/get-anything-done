import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
      <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[11px]">
        {version}
      </span>
      <span className="text-sm text-muted-foreground">{date}</span>
      {playable && (
        <Link
          href={projectHref}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
        >
          Playable
          <ArrowRight size={9} aria-hidden />
        </Link>
      )}
      <Link
        href={runHref}
        className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
      >
        Full breakdown
        <ArrowRight size={11} aria-hidden />
      </Link>
    </div>
  );
}
