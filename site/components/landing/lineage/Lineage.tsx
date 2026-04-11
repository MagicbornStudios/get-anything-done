import { LineageCopy } from "@/components/landing/lineage/LineageCopy";
import { LineageMedia } from "@/components/landing/lineage/LineageMedia";

export default function Lineage() {
  return (
    <section id="lineage" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] lg:items-start lg:gap-16">
          <LineageCopy />
          <LineageMedia />
        </div>
      </div>
    </section>
  );
}
