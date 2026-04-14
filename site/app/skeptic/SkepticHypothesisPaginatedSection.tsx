"use client";

import { useState } from "react";
import { Identified } from "@/components/devid/Identified";
import { Button } from "@/components/ui/button";
import SkepticHypothesisCritiqueSection from "./SkepticHypothesisCritiqueSection";
import type { Critique } from "./skeptic-shared";

export default function SkepticHypothesisPaginatedSection({
  critiques,
}: {
  critiques: Critique[];
}) {
  const [index, setIndex] = useState(0);

  if (critiques.length === 0) return null;

  const current = critiques[index];
  const isFirst = index === 0;
  const isLast = index === critiques.length - 1;

  return (
    <>
      <Identified as="SkepticHypothesisPaginationControlsTop">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Hypothesis {index + 1} of {critiques.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFirst}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLast}
              onClick={() => setIndex((i) => Math.min(critiques.length - 1, i + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Identified>

      <Identified as={`SkepticHypothesisCritiqueSection-${current.id}`}>
        <SkepticHypothesisCritiqueSection critique={current} />
      </Identified>
    </>
  );
}
