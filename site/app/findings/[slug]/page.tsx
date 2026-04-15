import Link from "next/link";
import { notFound } from "next/navigation";
import { Identified } from "@/components/devid/Identified";
import { MarketingShell, SiteSection } from "@/components/site";
import { FINDINGS } from "@/lib/catalog.generated";
import { Badge } from "@/components/ui/badge";

export function generateStaticParams() {
  return FINDINGS.map((f) => ({ slug: f.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const finding = FINDINGS.find((f) => f.slug === params.slug);
  if (!finding) return { title: "Finding not found — GAD" };
  return {
    title: `${finding.title} — GAD Findings`,
    description: finding.summary || `GAD experiment writeup — ${finding.title}`,
  };
}

export default function FindingDetailPage({ params }: { params: { slug: string } }) {
  const finding = FINDINGS.find((f) => f.slug === params.slug);
  if (!finding) notFound();

  return (
    <MarketingShell>
      <SiteSection cid="findings-detail-page-site-section">
        <Identified as="FindingDetailBreadcrumb" tag="nav" className="text-xs text-muted-foreground">
          <Link href="/findings" className="hover:text-foreground">← All findings</Link>
        </Identified>

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
