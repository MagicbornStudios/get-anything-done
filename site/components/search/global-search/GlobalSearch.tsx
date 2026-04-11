"use client";

import {
  Dialog,
} from "@/components/ui/dialog";
import { GlobalSearchModal } from "@/components/search/global-search/GlobalSearchModal";
import { GlobalSearchTrigger } from "@/components/search/global-search/GlobalSearchTrigger";
import { useGlobalSearch } from "@/components/search/global-search/use-global-search";

export function GlobalSearch() {
  const { open, setOpen, query, setQuery, inputRef, results } = useGlobalSearch();

  return (
    <>
      <GlobalSearchTrigger onOpen={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <GlobalSearchModal
          inputRef={inputRef}
          query={query}
          onQueryChange={setQuery}
          results={results}
          onClose={() => setOpen(false)}
          onPickResult={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
