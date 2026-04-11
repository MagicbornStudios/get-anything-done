import type { PlanningState } from "@/lib/catalog.generated";
import { STATUS_TINT } from "@/app/planning/planning-shared";

export function PlanningRoadmapSection({ state }: { state: PlanningState }) {
  if (state.phases.length === 0) return null;
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Roadmap</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          All phases, status-coded
        </h2>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {state.phases.map((phase) => (
            <div
              key={phase.id}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <span className="mt-0.5 inline-flex min-w-10 shrink-0 items-center justify-center rounded-full bg-background/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {phase.id}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{phase.title}</p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  STATUS_TINT[phase.status] ?? STATUS_TINT.planned
                }`}
              >
                {phase.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
