"use client";

import { GlobalSearchModal } from "@/components/search/global-search/GlobalSearchModal";
import { GlobalSearchTrigger } from "@/components/search/global-search/GlobalSearchTrigger";
import { useGlobalSearch } from "@/components/search/global-search/use-global-search";

export function GlobalSearch() {
  const { open, setOpen, query, setQuery, inputRef, results } = useGlobalSearch();

  return (
    <>
      <GlobalSearchTrigger onOpen={() => setOpen(true)} />
      {open && (
        <GlobalSearchModal
          inputRef={inputRef}
          query={query}
          onQueryChange={setQuery}
          results={results}
          onClose={() => setOpen(false)}
          onPickResult={() => setOpen(false)}
        />
      )}
    </>
  );
}
