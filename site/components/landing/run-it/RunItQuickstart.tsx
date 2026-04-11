import { Terminal } from "lucide-react";
import { RUN_IT_QUICKSTART_SNIPPET } from "@/components/landing/run-it/run-it-shared";

export function RunItQuickstart() {
  return (
    <div className="mt-10 overflow-hidden rounded-2xl border border-border/70 bg-background/60">
      <div className="flex items-center gap-2 border-b border-border/60 bg-card/40 px-5 py-3">
        <Terminal size={14} className="text-accent" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          terminal
        </span>
      </div>
      <pre className="overflow-x-auto px-6 py-5 font-mono text-sm leading-7 text-muted-foreground">
        {RUN_IT_QUICKSTART_SNIPPET}
      </pre>
    </div>
  );
}
