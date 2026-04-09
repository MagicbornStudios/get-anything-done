import { notFound } from "next/navigation";
import DetailShell from "@/components/detail/DetailShell";
import { FINDINGS } from "@/lib/catalog.generated";

export const dynamicParams = false;

export function generateStaticParams() {
  return FINDINGS.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const finding = FINDINGS.find((f) => f.slug === slug);
  if (!finding) return { title: "Finding not found" };
  return {
    title: `${finding.title} — GAD finding`,
    description: finding.summary,
  };
}

export default async function FindingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const finding = FINDINGS.find((f) => f.slug === slug);
  if (!finding) notFound();

  return (
    <DetailShell
      kind="finding"
      backHref="/findings"
      backLabel="Back to findings"
      name={finding.title}
      subtitle={finding.date ?? undefined}
      badges={finding.date ? [{ label: finding.date }] : []}
      sourcePath={finding.file}
      bodyHtml={finding.bodyHtml}
    />
  );
}
