export const dynamic = "force-dynamic";
import { MarketingShell } from "@/components/site";
import { scanPublished } from "./scan-published";
import { LibraryGrid } from "./LibraryGrid";

export const metadata = {
  title: "Library — Get Anything Done",
  description: "Browse and play all published AI-agent generations.",
};

export default function LibraryPage() {
  const entries = scanPublished();

  // Derive unique domains for filter tabs
  const domains = Array.from(
    new Set(entries.map((e) => e.domain).filter(Boolean))
  ).sort() as string[];

  return (
    <MarketingShell>
      <section
        data-cid="library-site-section"
        className="mx-auto w-full max-w-6xl px-6 py-12"
      >
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
          Library
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Browse and play every published generation build.
        </p>
        <LibraryGrid entries={entries} domains={domains} />
      </section>
    </MarketingShell>
  );
}
