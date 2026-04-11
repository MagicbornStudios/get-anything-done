"use client";

import { GlobalSearchEmptyHint } from "@/components/search/global-search/GlobalSearchEmptyHint";
import { GlobalSearchNoResults } from "@/components/search/global-search/GlobalSearchNoResults";
import { GlobalSearchResults } from "@/components/search/global-search/GlobalSearchResults";
import type { SearchResultsByKind } from "@/components/search/global-search/global-search-shared";

type Props = {
  query: string;
  results: SearchResultsByKind | null;
  onPickResult: () => void;
};

export function GlobalSearchScrollBody({ query, results, onPickResult }: Props) {
  if (!query.trim()) {
    return <GlobalSearchEmptyHint />;
  }
  if (results && Object.keys(results).length === 0) {
    return <GlobalSearchNoResults query={query} />;
  }
  if (results && Object.keys(results).length > 0) {
    return <GlobalSearchResults results={results} onPickResult={onPickResult} />;
  }
  return null;
}
