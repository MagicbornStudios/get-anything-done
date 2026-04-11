"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { groupSearchResults, type SearchResultsByKind } from "@/components/search/global-search/global-search-shared";

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const results: SearchResultsByKind | null = useMemo(
    () => groupSearchResults(query),
    [query]
  );

  return { open, setOpen, query, setQuery, inputRef, results };
}
