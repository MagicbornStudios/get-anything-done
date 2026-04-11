import { Circle } from "lucide-react";
import type { ProducedArtifacts } from "@/lib/eval-data";

export function RunProducedArtifactsSection({ produced }: { produced: ProducedArtifacts }) {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">What the agent built for itself</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Emergent workflow artifacts
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          Bare and emergent runs don&apos;t have a framework giving them structure — they author
          their own methodology on the fly. These are the files the agent wrote into its own{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">game/.planning/</code> during
          this run. When a file appears here that isn&apos;t in the inherited bootstrap set, the
          agent invented it.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Skills written", items: produced.skillFiles },
            { label: "Subagents written", items: produced.agentFiles },
            { label: "Planning notes", items: produced.planningFiles },
            { label: "Workflow docs", items: produced.workflowNotes },
          ]
            .filter((col) => col.items.length > 0)
            .map((col) => (
              <div
                key={col.label}
                className="rounded-2xl border border-border/70 bg-card/40 p-5"
              >
                <p className="text-xs uppercase tracking-wider text-accent">
                  {col.label}
                  <span className="ml-2 text-muted-foreground">({col.items.length})</span>
                </p>
                <ul className="mt-3 space-y-2">
                  {col.items.map((item) => (
                    <li key={item.name} className="flex items-center gap-2">
                      <Circle size={6} className="fill-accent text-accent" aria-hidden />
                      <code className="truncate font-mono text-xs text-foreground">{item.name}</code>
                      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                        {item.bytes < 1024
                          ? `${item.bytes} B`
                          : `${(item.bytes / 1024).toFixed(1)} KB`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
