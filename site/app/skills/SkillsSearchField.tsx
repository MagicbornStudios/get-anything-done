"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SkillsSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

export function SkillsSearchField({ value, onChange, placeholder, className }: SkillsSearchFieldProps) {
  return (
    <div className={cn("relative flex-1 min-w-[220px] max-w-md", className)}>
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-border/60 bg-card/40 pl-9 focus-visible:border-accent/70"
      />
    </div>
  );
}
