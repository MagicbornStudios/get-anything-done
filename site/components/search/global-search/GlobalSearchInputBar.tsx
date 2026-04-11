"use client";

import type { RefObject } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search decisions, tasks, glossary, bugs, skills..."
        className="h-auto flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onClose}
        className="h-7 w-7 shrink-0 rounded-full border-border/60"
        aria-label="Close search"
      >
        <X className="size-3" aria-hidden />
      </Button>
    </div>
  );
}
