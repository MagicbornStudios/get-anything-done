import { Badge } from "@/components/ui/badge";
import type { OpenQuestion } from "@/lib/eval-data";

export function QuestionsResolvedSection({ resolved }: { resolved: OpenQuestion[] }) {
  if (resolved.length === 0) return null;
  return (
    <section className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Resolved</p>
        <h2 className="text-2xl font-semibold tracking-tight">What used to be open</h2>
        <div className="mt-6 space-y-3">
          {resolved.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-border/60 bg-card/20 p-4"
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="success">resolved</Badge>
                <span>{q.resolved_on}</span>
              </div>
              <p className="font-medium text-foreground">{q.title}</p>
              {q.resolution && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{q.resolution}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
