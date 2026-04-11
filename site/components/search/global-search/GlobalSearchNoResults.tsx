"use client";

type Props = {
  query: string;
};

export function GlobalSearchNoResults({ query }: Props) {
  return (
    <div className="p-6 text-center text-sm text-muted-foreground">
      No results for &quot;{query}&quot;.
    </div>
  );
}
