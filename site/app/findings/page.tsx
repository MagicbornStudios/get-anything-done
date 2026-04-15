import { Identified } from "@/components/devid/Identified";
import { MarketingShell, SiteSection } from "@/components/site";
import { FINDINGS } from "@/lib/catalog.generated";
import {
  DEFAULT_PROJECT_ID,
  REGISTERED_PROJECTS,
} from "@/lib/project-config";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Findings — GAD",
  description:
    "Experiment writeups and framework-level lessons from the GAD evolution loop. Each finding documents what we tried, what we learned, and what changed in the architecture as a result.",
};

// Task 44-30: show findings whose `projects` array includes the current
// project, PLUS framework-level findings (empty `projects`) which are
// global. Absent/invalid projectid falls back to DEFAULT_PROJECT_ID.
type PageSearchParams = Promise<{ projectid?: string | string[] }>;

export default async function FindingsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const rawProjectId = resolvedSearchParams?.projectid;
  const paramId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  const currentProject =
    paramId && REGISTERED_PROJECTS.some((p) => p.id === paramId)
      ? paramId
      : DEFAULT_PROJECT_ID;
  const scoped = FINDINGS.filter((f) => {
    if (!f.projects || f.projects.length === 0) return true;
    return f.projects.includes(currentProject);
  });
  const sorted = [...scoped].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <MarketingShell>
      <SiteSection cid="findings-page-site-section">
        <Identified as="FindingsPageIntro">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Findings</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            Experiment writeups and framework-level lessons from the GAD evolution loop. Each
            finding documents what we tried, what we learned, and what changed in the
            architecture as a result. Findings tied to a specific eval project also appear
            on that project&apos;s detail page.
          </p>
        </Identified>

        {sorted.length === 0 ? (
          <Identified as="FindingsEmpty" tag="p" className="mt-8 text-sm text-muted-foreground">
            No findings recorded yet.
          </Identified>
        ) : (
          <div className="mt-10 space-y-6">
            {sorted.map((f) => (
              <article
                key={f.slug}
                id={f.slug}
                className="rounded-2xl border border-border/70 bg-card/40 p-6"
              >
                <Identified as={`FindingsArticle-${f.slug}`} className="contents">
                  <div className="flex flex-wrap items-center gap-2">
                    {f.round && <Badge variant="outline">Evolution {f.round}</Badge>}
                    {f.gadVersion && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        GAD v{f.gadVersion}
                      </Badge>
                    )}
                    {f.date && (
                      <span className="text-[11px] text-muted-foreground">{f.date}</span>
                    )}
                    {f.projects && f.projects.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        · {f.projects.join(", ")}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">{f.title}</h2>
                  {f.summary && (
                    <p className="mt-2 text-sm text-muted-foreground">{f.summary}</p>
                  )}
                  <div
                    className="prose prose-invert prose-sm mt-4 max-w-none prose-headings:text-foreground prose-a:text-accent"
                    dangerouslySetInnerHTML={{ __html: f.bodyHtml }}
                  />
                </Identified>
              </article>
            ))}
          </div>
        )}
      </SiteSection>
    </MarketingShell>
  );
}

