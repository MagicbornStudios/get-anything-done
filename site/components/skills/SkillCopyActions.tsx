"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface SkillCopyActionsProps {
  /** Full SKILL.md content (frontmatter + body) */
  raw: string;
}

/**
 * Two copy buttons: one for the entire SKILL.md, one for just the YAML
 * frontmatter. Lives next to the skill content on the detail page so users
 * can grab it verbatim.
 */
export function SkillCopyActions({ raw }: SkillCopyActionsProps) {
  const [copied, setCopied] = useState<"full" | "frontmatter" | null>(null);

  // Extract frontmatter (between leading --- and the next ---)
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = frontmatterMatch ? frontmatterMatch[0] : null;

  function copy(text: string, kind: "full" | "frontmatter") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => copy(raw, "full")}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
      >
        {copied === "full" ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
        {copied === "full" ? "Copied" : "Copy SKILL.md"}
      </button>
      {frontmatter && (
        <button
          type="button"
          onClick={() => copy(frontmatter, "frontmatter")}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          {copied === "frontmatter" ? (
            <Check size={11} aria-hidden />
          ) : (
            <Copy size={11} aria-hidden />
          )}
          {copied === "frontmatter" ? "Copied" : "Copy frontmatter"}
        </button>
      )}
    </div>
  );
}
