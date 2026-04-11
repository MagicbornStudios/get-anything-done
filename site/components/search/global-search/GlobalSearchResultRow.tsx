"use client";

import Link from "next/link";
import { KIND_TINT } from "@/components/search/global-search/global-search-shared";
import type { SearchEntry } from "@/lib/eval-data";

type Props = {
  entry: SearchEntry;
  onNavigate: () => void;
};

export function GlobalSearchResultRow({ entry, onNavigate }: Props) {
  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      className="flex items-start gap-3 border-t border-border/30 px-4 py-3 transition-colors first:border-t-0 hover:bg-card/40"
    >
      <span
        className={`mt-0.5 inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-mono text-[10px] ${KIND_TINT[entry.kind]}`}
      >
        {entry.id}
      </span>
      <span className="text-sm text-foreground">{entry.title}</span>
    </Link>
  );
}
