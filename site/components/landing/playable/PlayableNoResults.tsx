"use client";

import { Identified } from "@/components/devid/Identified";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  roundFilter: string | null;
  onClearAllFilters: () => void;
};

export function PlayableNoResults({ roundFilter, onClearAllFilters }: Props) {
  return (
    <Card className="mt-8 border-border/70 bg-card/30 shadow-none">
      <CardContent className="p-8 text-center">
        <Identified as="PlayableNoResultsCopy">
          <p className="text-lg font-semibold text-muted-foreground">No playable builds match your filters</p>
          <p className="mt-2 text-sm text-muted-foreground/70">
            {roundFilter && `${roundFilter} may not have scored builds yet, or all runs were rate-limited. `}
            Try adjusting your filters or search query.
          </p>
        </Identified>
        <Identified as="PlayableNoResultsClear">
        <Button
          type="button"
          variant="outline"
          className="mt-4 rounded-full border-accent/60 text-sm font-semibold text-accent hover:bg-accent/10"
          onClick={onClearAllFilters}
        >
          Clear all filters
        </Button>
        </Identified>
      </CardContent>
    </Card>
  );
}
