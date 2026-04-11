import { History } from "lucide-react";
import { LINEAGE_PREDECESSORS } from "@/app/lineage/lineage-data";
import { LineagePredecessorArticle } from "@/app/lineage/LineagePredecessorArticle";

export function LineagePredecessorsSection() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <div className="mb-2 flex items-center gap-2">
          <History size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">Predecessors</p>
        </div>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
          Two projects GAD is downstream of
        </h2>

        <div className="mt-10 space-y-8">
          {LINEAGE_PREDECESSORS.map((p) => (
            <LineagePredecessorArticle key={p.name} predecessor={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
