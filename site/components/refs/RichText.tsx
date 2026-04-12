"use client";

import Link from "next/link";
import { richTextTokenize } from "./rich-text-tokenize";

/**
 * Parse planning text (task goals, decision summaries) and render
 * CLI commands, URLs, site paths, and flags as interactive elements.
 *
 * Patterns detected:
 * - CLI flags: --flag-name → code badge
 * - CLI commands: `gad xyz` or backtick-wrapped → code span
 * - URLs: https://... → link
 * - Site paths: site/app/X/page.tsx → route link (/X)
 * - File paths: vendor/... or .planning/... → code span
 */

export function RichText({ text, className }: { text: string; className?: string }) {
  const tokens = richTextTokenize(text);

  return (
    <span className={className}>
      {tokens.map((token, i) => {
        switch (token.type) {
          case "url":
            return (
              <a
                key={i}
                href={token.value}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                {token.value.length > 60 ? token.value.slice(0, 57) + "..." : token.value}
              </a>
            );
          case "code":
            return (
              <code
                key={i}
                className="rounded border border-border/50 bg-card/60 px-1 py-0.5 font-mono text-[10px] text-accent"
              >
                {token.value}
              </code>
            );
          case "site-route":
            return (
              <Link
                key={i}
                href={token.route!}
                className="rounded border border-purple-500/30 bg-purple-500/10 px-1 py-0.5 font-mono text-[10px] text-purple-300 hover:bg-purple-500/20"
              >
                {token.route}
              </Link>
            );
          case "flag":
            return (
              <code
                key={i}
                className="rounded border border-sky-500/30 bg-sky-500/10 px-1 py-0.5 font-mono text-[10px] text-sky-300"
              >
                {token.value}
              </code>
            );
          case "file":
            return (
              <code
                key={i}
                className="rounded border border-border/40 bg-card/60 px-1 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {token.value}
              </code>
            );
          default:
            return <span key={i}>{token.value}</span>;
        }
      })}
    </span>
  );
}
