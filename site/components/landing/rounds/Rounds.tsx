"use client";

import { useState } from "react";
import { RoundsArticle } from "@/components/landing/rounds/RoundsArticle";
import { RoundsIntro } from "@/components/landing/rounds/RoundsIntro";
import { RoundsPagination } from "@/components/landing/rounds/RoundsPagination";
import { ROUND_SUMMARIES } from "@/lib/eval-data";
import { SiteSection } from "@/components/site";

export default function Rounds() {
  const total = ROUND_SUMMARIES.length;
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, total - 1));

  if (total === 0) return null;

  const r = ROUND_SUMMARIES[currentIndex];

  return (
    <SiteSection id="rounds" cid="rounds-site-section" tone="muted" className="border-t border-border/60">
      <RoundsIntro />

      <RoundsPagination
        total={total}
        currentIndex={currentIndex}
        onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
        onSelectIndex={setCurrentIndex}
      />

      <RoundsArticle summary={r} />
    </SiteSection>
  );
}

