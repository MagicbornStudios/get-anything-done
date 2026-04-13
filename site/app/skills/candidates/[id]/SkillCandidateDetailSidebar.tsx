import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Ref } from "@/components/refs/Ref";
import type { SkillCandidateDetail } from "./skill-candidate-detail-types";

export function SkillCandidateDetailSidebar({ c }: { c: SkillCandidateDetail }) {
  const isReviewed = c.reviewed !== false;

  return (
    <>
      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Source phase</p>
        <div className="mt-2">
          <Ref id={c.source_phase} />
        </div>
        <p className="mt-2 text-sm font-semibold text-foreground">{c.source_phase_title}</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Pressure</p>
        <p className="text-3xl font-semibold tabular-nums text-amber-400">{c.pressure_score}</p>
        <dl className="mt-3 space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tasks</dt>
            <dd className="tabular-nums text-foreground">
              {c.tasks_done}/{c.tasks_total}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Crosscuts</dt>
            <dd className="tabular-nums text-foreground">{c.crosscuts}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Review state</p>
        {isReviewed ? (
          <>
            <Badge variant="outline" className="text-[10px] uppercase">
              {c.reviewed}
            </Badge>
            {c.reviewed_on && <p className="mt-2 text-[11px] text-muted-foreground">On {c.reviewed_on}</p>}
            {c.reviewed_notes && <p className="mt-2 text-xs leading-5 text-foreground">{c.reviewed_notes}</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Unreviewed — awaiting promote/merge/discard decision.</p>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Source phase tasks</p>
        <ul className="space-y-1.5 text-[11px]">
          {c.tasks.slice(0, 20).map((t) => (
            <li key={t.id} className="flex items-start gap-1.5">
              <Ref id={t.id} />
              <span className="line-clamp-2 leading-4 text-muted-foreground">{t.goal}</span>
            </li>
          ))}
          {c.tasks.length > 20 && (
            <li className="text-[10px] text-muted-foreground/60">+ {c.tasks.length - 20} more</li>
          )}
        </ul>
      </div>

      <Link
        href="/planning?tab=skill-candidates"
        className="block rounded-xl border border-border/60 bg-card/40 p-4 text-xs text-accent hover:border-accent/60"
      >
        ← Back to candidates
      </Link>
    </>
  );
}
