import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import type { EvalRunRecord } from "@/lib/eval-data";
import { formatNum } from "@/app/runs/[project]/[version]/run-detail-shared";

export function RunSkillAccuracySection({
  run,
  tracingGap,
  skillAccuracyValue,
}: {
  run: EvalRunRecord;
  tracingGap: boolean;
  skillAccuracyValue: number | null;
}) {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Skill accuracy breakdown"
        title="Did the agent invoke the right skills at the right moments?"
      />

      {run.skillAccuracyBreakdown && run.skillAccuracyBreakdown.expected_triggers.length > 0 ? (
          <>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              For each expected trigger we recorded whether the agent invoked the skill at the right
              point in the loop. Accuracy = fired / expected ={" "}
              <strong className="text-foreground">
                {formatNum(run.skillAccuracyBreakdown.accuracy, 2)}
              </strong>
              .
            </p>
            <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Skill</th>
                    <th className="px-5 py-3 font-medium">Expected when</th>
                    <th className="px-5 py-3 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {run.skillAccuracyBreakdown.expected_triggers.map((t, idx) => (
                    <tr
                      key={`${t.skill}-${idx}`}
                      className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                    >
                      <td className="px-5 py-3 font-mono text-[11px] text-accent">{t.skill}</td>
                      <td className="px-5 py-3 text-muted-foreground">{t.when ?? "—"}</td>
                      <td className="px-5 py-3">
                        {t.triggered ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 size={14} aria-hidden />
                            fired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
                            <XCircle size={14} aria-hidden />
                            missed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : tracingGap ? (
          <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Tracing gap
              </p>
            </div>
            <p className="text-base leading-7 text-foreground">
              This run stored only the aggregate{" "}
              <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">
                skill_accuracy: {skillAccuracyValue?.toFixed(2)}
              </code>{" "}
              — there is no per-skill trigger breakdown in its TRACE.json. We can&apos;t tell you
              which of the expected skills fired vs missed. This is exactly the failure mode gad-50
              calls out: the trace schema is too lossy to explain scores like this after the fact.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Phase 25 of the GAD framework work ships trace schema v4 — every tool use, skill
              invocation with its trigger context, and subagent spawn with inputs + outputs. Older
              runs like this one will keep their aggregate score but new runs will land with the
              full breakdown.
            </p>
            <Link
              href="/methodology"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              How tracing works →
            </Link>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Skill accuracy data isn&apos;t relevant for this run (no expected trigger set).
          </p>
        )}
    </SiteSection>
  );
}
