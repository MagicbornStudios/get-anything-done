"use client";

import type { RefObject } from "react";
import { GlobalSearchFooter } from "@/components/search/global-search/GlobalSearchFooter";
import { GlobalSearchInputBar } from "@/components/search/global-search/GlobalSearchInputBar";
import { GlobalSearchScrollBody } from "@/components/search/global-search/GlobalSearchScrollBody";
import type { SearchResultsByKind } from "@/components/search/global-search/global-search-shared";

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
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-background/80 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <GlobalSearchInputBar
          inputRef={inputRef}
          query={query}
          onQueryChange={onQueryChange}
          onClose={onClose}
        />

        <div className="max-h-[60vh] overflow-y-auto">
          <GlobalSearchScrollBody query={query} results={results} onPickResult={onPickResult} />
        </div>

        <GlobalSearchFooter />
      </div>
    </div>
  );
}
