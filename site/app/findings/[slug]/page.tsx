import Link from "next/link";
import { notFound } from "next/navigation";
import { Identified } from "@/components/devid/Identified";
import { MarketingShell, SiteSection } from "@/components/site";
import { FINDINGS } from "@/lib/catalog.generated";
import {
  DEFAULT_PROJECT_ID,
  REGISTERED_PROJECTS,
} from "@/lib/project-config";
import { Badge } from "@/components/ui/badge";

export function generateStaticParams() {
  return FINDINGS.map((f) => ({ slug: f.slug }));
}

type PageParams = Promise<{ slug: string }>;
type PageSearchParams = Promise<{ projectid?: string | string[] }>;

export async function generateMetadata({ params }: { params: PageParams }) {
  const resolvedParams = await params;
  const finding = FINDINGS.find((f) => f.slug === resolvedParams.slug);
  if (!finding) return { title: "Finding not found — GAD" };
  return {
    title: `${finding.title} — GAD Findings`,
    description: finding.summary || `GAD experiment writeup — ${finding.title}`,
  };
}

export default async function FindingDetailPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams?: PageSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const finding = FINDINGS.find((f) => f.slug === resolvedParams.slug);
  if (!finding) notFound();

  // Task 44-30: soft scoping — do NOT 404 on project mismatch; just surface
  // a banner so the user knows the finding is tagged for a different
  // project. Framework-level findings (empty projects) show everywhere.
  const rawProjectId = resolvedSearchParams?.projectid;
  const paramId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  const currentProject =
    paramId && REGISTERED_PROJECTS.some((p) => p.id === paramId)
      ? paramId
      : DEFAULT_PROJECT_ID;
  const tagged = finding.projects ?? [];
  const outOfScope =
    tagged.length > 0 && !tagged.includes(currentProject);

  return (
    <MarketingShell>
      <SiteSection cid="findings-detail-page-site-section">
        <Identified as="FindingDetailBreadcrumb" tag="nav" className="text-xs text-muted-foreground">
          <Link href="/findings" className="hover:text-foreground">← All findings</Link>
        </Identified>

        {outOfScope && (
          <Identified
            as="FindingDetailScopeBanner"
            className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200"
          >
            This finding is tagged for project{" "}
            <span className="font-mono">{tagged.join(", ")}</span>. You are
            viewing the site as project{" "}
            <span className="font-mono">{currentProject}</span>.
          </Identified>
        )}

        <Identified as={`FindingDetail-${finding.slug}`} className="contents">
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {finding.round && <Badge variant="outline">Evolution {finding.round}</Badge>}
            {finding.gadVersion && (
              <Badge variant="outline" className="font-mono text-[10px]">
                GAD v{finding.gadVersion}
              </Badge>
            )}
            {finding.date && (
              <span className="text-[11px] text-muted-foreground">{finding.date}</span>
            )}
            {finding.projects && finding.projects.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                · {finding.projects.join(", ")}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {finding.title}
          </h1>
          {finding.summary && (
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{finding.summary}</p>
          )}
          <article
            className="prose prose-invert prose-sm mt-8 max-w-none prose-headings:text-foreground prose-a:text-accent"
            dangerouslySetInnerHTML={{ __html: finding.bodyHtml }}
          />
        </Identified>
      </SiteSection>
    </MarketingShell>
  );
}
