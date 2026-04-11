"use client";

import { Card, CardContent } from "@/components/ui/card";

type Props = {
  query: string;
};

export function CatalogEmptyState({ query }: Props) {
  return (
    <Card className="mt-8 border-border/60 bg-card/30 text-center shadow-none">
      <CardContent className="p-8 text-sm text-muted-foreground">
        No matches for &quot;{query}&quot;
      </CardContent>
    </Card>
  );
}
