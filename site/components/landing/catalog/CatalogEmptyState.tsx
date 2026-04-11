"use client";

type Props = {
  query: string;
};

export function CatalogEmptyState({ query }: Props) {
  return (
    <p className="mt-8 rounded-2xl border border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
      No matches for &quot;{query}&quot;
    </p>
  );
}
