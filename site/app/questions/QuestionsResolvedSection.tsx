import { Badge } from "@/components/ui/badge";
import type { OpenQuestion } from "@/lib/eval-data";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function QuestionsResolvedSection({ resolved }: { resolved: OpenQuestion[] }) {
  if (resolved.length === 0) return null;
  return (
    <SiteSection className="border-b-0 border-t border-border/60">
      <SiteSectionHeading
        kicker="Resolved"
        title="What used to be open"
        preset="section"
        titleClassName="text-2xl font-semibold tracking-tight md:text-3xl"
      />
      <div className="mt-6 space-y-3">
        {resolved.map((q) => (
          <div key={q.id} className="rounded-xl border border-border/60 bg-card/20 p-4">
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
    </SiteSection>
  );
}
