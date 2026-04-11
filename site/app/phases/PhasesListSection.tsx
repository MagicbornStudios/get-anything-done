import { GitBranch } from "lucide-react";
import type { PhaseRecord } from "@/lib/eval-data";
import { PhaseCard } from "@/app/phases/PhaseCard";

export function PhasesListSection({ phases }: { phases: PhaseRecord[] }) {
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="mb-6 flex items-center gap-3">
          <GitBranch size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">All phases</p>
        </div>
        <div className="space-y-4">
          {phases.map((p) => (
            <PhaseCard key={p.id} phase={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
