import Link from "next/link";

export function GraphsProvenance() {
  return (
    <p className="mt-6 text-[11px] text-muted-foreground">
      <strong className="text-foreground">Data provenance:</strong> scatter
      reads <code className="rounded bg-background/60 px-1 py-0.5">scores.composite</code>{" "}
      and <code className="rounded bg-background/60 px-1 py-0.5">humanReview.score</code>{" "}
      from TRACE.json per run. Bar chart reads{" "}
      <code className="rounded bg-background/60 px-1 py-0.5">humanReviewNormalized.aggregate_score</code>.
      Rate-limited and API-interrupted runs excluded per gad-63 + gad-64.
      See{" "}
      <Link href="/data" className="text-accent underline decoration-dotted">
        /data
      </Link>{" "}
      for the full provenance index.
    </p>
  );
}
