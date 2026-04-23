"use client";

import type { RefObject } from "react";
import { Identified } from "@portfolio/visual-context";
import { GlobalSearchFooter } from "@/components/search/global-search/GlobalSearchFooter";
import { GlobalSearchInputBar } from "@/components/search/global-search/GlobalSearchInputBar";
import { GlobalSearchScrollBody } from "@/components/search/global-search/GlobalSearchScrollBody";
import type { SearchResultsByKind } from "@/components/search/global-search/global-search-shared";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";

type Props = {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResultsByKind | null;
  onClose: () => void;
  onPickResult: () => void;
};

export function GlobalSearchModal({
  inputRef,
  query,
  onQueryChange,
  results,
  onClose,
  onPickResult,
}: Props) {
  return (
    <DialogContent
      hideClose
      overlayClassName="z-[60] bg-background/80 backdrop-blur-sm"
      className="left-[50%] top-[10vh] z-[60] flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border/70 p-0 shadow-2xl shadow-black/60 sm:rounded-2xl"
      aria-describedby={undefined}
    >
      <DialogTitle className="sr-only">Global search</DialogTitle>
      <Identified as="GlobalSearchInputBar">
        <GlobalSearchInputBar
          inputRef={inputRef}
          query={query}
          onQueryChange={onQueryChange}
          onClose={onClose}
        />
      </Identified>

      <Identified as="GlobalSearchResultsScroll" className="max-h-[60vh] overflow-y-auto">
        <GlobalSearchScrollBody query={query} results={results} onPickResult={onPickResult} />
      </Identified>

      <Identified as="GlobalSearchFooter">
        <GlobalSearchFooter />
      </Identified>
    </DialogContent>
  );
}
