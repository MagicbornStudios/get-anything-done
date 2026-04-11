import { ArrowRight } from "lucide-react";
import RoundCard from "./RoundCard";
import { FUTURE_ROUNDS, pressureForRound } from "./roadmap-shared";

export default function RoadmapPlannedRoundsSection() {
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="mb-8 flex items-center gap-3">
          <ArrowRight size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">Planned rounds</p>
        </div>
        <div className="space-y-6">
          {FUTURE_ROUNDS.map((r) => {
            const p = pressureForRound(r.round);
            return (
              <RoundCard
                key={r.round}
                round={r.round}
                title={r.title}
                body={r.body}
                pressure={p}
                status="planned"
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
