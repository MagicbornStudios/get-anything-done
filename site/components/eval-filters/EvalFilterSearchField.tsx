"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type EvalFilterSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tailwind classes for the text input (height, padding, border, etc.) */
  inputClassName?: string;
  clearAriaLabel?: string;
  /** Optional wrapper when embedding in a flex row (default: relative min-w flex-1) */
  wrapperClassName?: string;
};

/**
 * Shared search row: icon + input + clear, used by home playable and project market filters.
 */
export function EvalFilterSearchField({
  value,
  onChange,
  placeholder = "Search…",
  inputClassName = "h-9 rounded-lg border-border/70 bg-background/60 py-2 pl-8 pr-8 text-xs shadow-none focus-visible:ring-accent/40",
  clearAriaLabel = "Clear search",
  wrapperClassName = "relative min-w-[180px] flex-1",
}: EvalFilterSearchFieldProps) {
  return (
    <div className={cn(wrapperClassName)}>
      <Search
        size={13}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClassName}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={clearAriaLabel}
        >
          <X className="size-3" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
