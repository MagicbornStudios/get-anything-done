import Link from "next/link";
import { notFound } from "next/navigation";
import DetailShell from "@/components/detail/DetailShell";
import selfEvalData from "@/data/self-eval.json";
import { Badge } from "@/components/ui/badge";
import { Ref } from "@/components/refs/Ref";

type ReviewState = false | "promoted" | "merged" | "discarded";

interface SkillCandidate {
  name: string;
  source_phase: string;
  source_phase_title: string;
  pressure_score: number;
  tasks_total: number;
  tasks_done: number;
  crosscuts: number;
  file_path: string;
  reviewed: ReviewState;
  reviewed_on: string | null;
  reviewed_notes: string | null;
  body_raw?: string;
  body_html?: string;
  tasks: { id: string; status: string; goal: string }[];
}

const CANDIDATES = (selfEvalData.latest?.skill_candidates ?? []) as SkillCandidate[];

export const dynamicParams = false;

export function generateStaticParams() {
  return CANDIDATES.map((c) => ({ id: c.name }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = CANDIDATES.find((x) => x.name === id);
  if (!c) return { title: "Skill candidate not found" };
  return {
    title: `${c.source_phase_title} — skill candidate`,
    description: `Auto-drafted skill candidate from phase ${c.source_phase}, pressure score ${c.pressure_score}.`,
  };
}

export default async function SkillCandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = CANDIDATES.find((x) => x.name === id);
  if (!c) notFound();

  const isReviewed = c.reviewed !== false;

  const sidebar = (
    <>
      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Source phase</p>
        <div className="mt-2">
          <Ref id={c.source_phase} />
        </div>
        <p className="mt-2 text-sm font-semibold text-foreground">{c.source_phase_title}</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Pressure</p>
        <p className="text-3xl font-semibold tabular-nums text-amber-400">{c.pressure_score}</p>
        <dl className="mt-3 space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tasks</dt>
            <dd className="tabular-nums text-foreground">{c.tasks_done}/{c.tasks_total}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Crosscuts</dt>
            <dd className="tabular-nums text-foreground">{c.crosscuts}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Review state</p>
        {isReviewed ? (
          <>
            <Badge variant="outline" className="text-[10px] uppercase">
              {c.reviewed}
            </Badge>
            {c.reviewed_on && (
              <p className="mt-2 text-[11px] text-muted-foreground">On {c.reviewed_on}</p>
            )}
            {c.reviewed_notes && (
              <p className="mt-2 text-xs leading-5 text-foreground">{c.reviewed_notes}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Unreviewed — awaiting promote/merge/discard decision.</p>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Source phase tasks</p>
        <ul className="space-y-1.5 text-[11px]">
          {c.tasks.slice(0, 20).map((t) => (
            <li key={t.id} className="flex items-start gap-1.5">
              <Ref id={t.id} />
              <span className="text-muted-foreground leading-4 line-clamp-2">{t.goal}</span>
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

  return (
    <DetailShell
      kind="skill"
      backHref="/planning"
      backLabel="Back to planning"
      name={c.source_phase_title}
      subtitle={`skill-candidate/${c.name}`}
      description={`Auto-drafted candidate from phase ${c.source_phase}. Pressure ${c.pressure_score} (threshold 10). Quarantined from GAD catalog until reviewed.`}
      badges={[
        { label: "System", variant: "outline" },
        { label: `pressure ${c.pressure_score}`, variant: "default" },
        ...(isReviewed ? [{ label: String(c.reviewed), variant: "success" as const }] : []),
      ]}
      meta={[
        { label: "Tasks", value: `${c.tasks_done}/${c.tasks_total}` },
        { label: "Crosscuts", value: String(c.crosscuts) },
        { label: "Phase", value: c.source_phase },
      ]}
      sourcePath={c.file_path}
      bodyHtml={c.body_html ?? ""}
      sidebar={sidebar}
    />
  );
}
