import type { EvalRunRecord } from "@/lib/eval-data";
import { ProjectRunCard } from "@/app/projects/[id]/ProjectRunCard";

export function ProjectRunsSection({ runs }: { runs: EvalRunRecord[] }) {
  if (runs.length === 0) return null;
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Runs</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {runs.length} recorded run{runs.length === 1 ? "" : "s"}
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {runs.map((run) => (
            <ProjectRunCard key={run.version} run={run} />
          ))}
        </div>
      </div>
    </section>
  );
}
