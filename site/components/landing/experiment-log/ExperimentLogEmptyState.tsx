"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  onClearLocalFilters: () => void;
};

export function ExperimentLogEmptyState({ onClearLocalFilters }: Props) {
  return (
    <Card className="mt-8 border-border/70 bg-card/30 text-center shadow-none">
      <CardContent className="space-y-2 p-8">
        <p className="text-lg font-semibold text-muted-foreground">No rounds match your filters</p>
        <p className="text-sm text-muted-foreground/70">
          Try a different project, hypothesis, or search.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearLocalFilters}
          className="mt-4 rounded-full border-accent/60 font-semibold text-accent hover:bg-accent/10"
        >
          Clear all filters
        </Button>
      </CardContent>
    </Card>
  );
}
