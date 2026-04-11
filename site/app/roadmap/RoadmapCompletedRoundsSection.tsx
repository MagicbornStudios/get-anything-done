import { Rocket } from "lucide-react";
import { ROUND_SUMMARIES } from "@/lib/eval-data";
import RoundCard from "./RoundCard";
import { pressureForRound } from "./roadmap-shared";

export default function RoadmapCompletedRoundsSection() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <div className="mb-8 flex items-center gap-3">
          <Rocket size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">Completed rounds</p>
        </div>
        <div className="space-y-6">
          {ROUND_SUMMARIES.map((r) => {
            const p = pressureForRound(r.round);
            return (
              <RoundCard
                key={r.round}
                round={r.round}
                title={r.title}
                body={r.body}
                pressure={p}
                status="completed"
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
