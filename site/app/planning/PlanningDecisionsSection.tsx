import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GITHUB_REPO, type PlanningState } from "@/lib/catalog.generated";

export function PlanningDecisionsSection({ state }: { state: PlanningState }) {
  if (state.recentDecisions.length === 0) return null;
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Recent decisions</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          The last {state.recentDecisions.length} architectural calls
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          DECISIONS.xml is where we record the "why" behind load-bearing choices. New decisions
          append to the bottom; this list is newest-first.
        </p>
        <div className="mt-8 space-y-4">
          {state.recentDecisions.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <div className="mb-1 flex items-center gap-2">
                  <code className="rounded-md bg-background/60 px-2 py-1 font-mono text-[11px] text-accent">
                    {d.id}
                  </code>
                </div>
                <CardTitle className="text-lg">{d.title}</CardTitle>
              </CardHeader>
              {d.summary && (
                <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                  {d.summary}
                </CardContent>
              )}
            </Card>
          ))}
          <a
            href={`${GITHUB_REPO}/blob/main/.planning/DECISIONS.xml`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
          >
            Full decision log on GitHub
            <ExternalLink size={12} aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
