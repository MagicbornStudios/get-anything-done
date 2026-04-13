import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { FINDINGS, type Finding } from "@/lib/catalog.generated";
import { SiteSection } from "@/components/site";

export function ProjectFindingsSection({ projectId }: { projectId: string }) {
  const findings: Finding[] = FINDINGS.filter((f) =>
    Array.isArray(f.projects) && f.projects.includes(projectId),
  ).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  if (findings.length === 0) return null;

  return (
    <SiteSection id="findings" className="border-t border-border/60">
      <Identified as="ProjectFindings">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Findings</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          Per-round writeups that reference this project. Each finding is stamped with the GAD
          version it was observed under, so comparisons across versions stay honest.
        </p>

        <div className="mt-8 space-y-6">
          {findings.map((f) => (
            <article
              key={f.slug}
              className="rounded-2xl border border-border/70 bg-card/40 p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                {f.round && <Badge variant="outline">Round {f.round}</Badge>}
                {f.gadVersion && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    GAD v{f.gadVersion}
                  </Badge>
                )}
                {f.date && (
                  <span className="text-[11px] text-muted-foreground">{f.date}</span>
                )}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{f.title}</h3>
              {f.summary && (
                <p className="mt-2 text-sm text-muted-foreground">{f.summary}</p>
              )}
              <div
                className="prose prose-invert prose-sm mt-4 max-w-none prose-headings:text-foreground prose-a:text-accent"
                dangerouslySetInnerHTML={{ __html: f.bodyHtml }}
              />
            </article>
          ))}
        </div>
      </Identified>
    </SiteSection>
  );
}
