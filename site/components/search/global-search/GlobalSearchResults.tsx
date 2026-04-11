"use client";

import {
  KIND_LABEL,
  KIND_ORDER,
  type SearchResultsByKind,
} from "@/components/search/global-search/global-search-shared";
import { GlobalSearchResultRow } from "@/components/search/global-search/GlobalSearchResultRow";

type Props = {
  results: SearchResultsByKind;
  onPickResult: () => void;
};

export function GlobalSearchResults({ results, onPickResult }: Props) {
  return (
    <div>
      {KIND_ORDER.filter((k) => results[k]?.length).map((kind) => (
        <div key={kind} className="border-b border-border/40 last:border-b-0">
          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {KIND_LABEL[kind]} ({results[kind]!.length})
          </div>
          {results[kind]!.map((entry) => (
            <GlobalSearchResultRow
              key={`${entry.kind}-${entry.id}`}
              entry={entry}
              onNavigate={onPickResult}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
