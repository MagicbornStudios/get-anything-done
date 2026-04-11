import { RunItCtas } from "@/components/landing/run-it/RunItCtas";
import { RunItIntro } from "@/components/landing/run-it/RunItIntro";
import { RunItQuickstart } from "@/components/landing/run-it/RunItQuickstart";

export default function RunIt() {
  return (
    <section id="run" className="border-t border-border/60">
      <div className="section-shell">
        <RunItIntro />
        <RunItQuickstart />
        <RunItCtas />
      </div>
    </section>
  );
}
