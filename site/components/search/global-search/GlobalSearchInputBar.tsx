"use client";

import type { RefObject } from "react";
import { Search, X } from "lucide-react";

type Props = {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
};

export function GlobalSearchInputBar({ inputRef, query, onQueryChange, onClose }: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
      <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search decisions, tasks, glossary, bugs, skills..."
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={onClose}
        className="rounded-full border border-border/60 p-1 text-muted-foreground hover:border-accent hover:text-accent"
        aria-label="Close search"
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}
