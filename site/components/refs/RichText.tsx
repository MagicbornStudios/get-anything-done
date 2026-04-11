"use client";

import Link from "next/link";

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

const URL_RE = /(https?:\/\/[^\s),]+)/g;
const BACKTICK_RE = /`([^`]+)`/g;
const SITE_PATH_RE = /site\/app\/([a-z0-9-[\]]+)\/page\.tsx/g;
const FLAG_RE = /(--[a-z][a-z0-9-]*)/g;
const FILE_PATH_RE = /((?:vendor|\.planning|\.agents|evals|bin|lib|scripts|commands)\/[^\s,)]+)/g;

interface Token {
  type: "text" | "url" | "code" | "site-route" | "flag" | "file";
  value: string;
  route?: string;
}

function tokenize(text: string): Token[] {
  // First pass: split by backtick-wrapped code
  const tokens: Token[] = [];
  let remaining = text;
  let match: RegExpExecArray | null;

  // Extract backtick code first
  const parts = remaining.split(BACKTICK_RE);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      // Inside backticks
      tokens.push({ type: "code", value: parts[i] });
    } else {
      // Outside backticks — parse further
      const segment = parts[i];
      if (!segment) continue;

      // Split by URLs
      const urlParts = segment.split(URL_RE);
      for (let j = 0; j < urlParts.length; j++) {
        const part = urlParts[j];
        if (!part) continue;

        if (URL_RE.test(part)) {
          URL_RE.lastIndex = 0;
          tokens.push({ type: "url", value: part });
          continue;
        }

        // Check for site paths
        SITE_PATH_RE.lastIndex = 0;
        if (SITE_PATH_RE.test(part)) {
          SITE_PATH_RE.lastIndex = 0;
          const siteParts = part.split(SITE_PATH_RE);
          for (let k = 0; k < siteParts.length; k++) {
            if (k % 2 === 1) {
              const routeName = siteParts[k].replace(/\[.*?\]/g, "");
              tokens.push({ type: "site-route", value: `site/app/${siteParts[k]}/page.tsx`, route: `/${routeName}` });
            } else if (siteParts[k]) {
              parseTextSegment(siteParts[k], tokens);
            }
          }
          continue;
        }

        parseTextSegment(part, tokens);
      }
    }
  }

  return tokens;
}

function parseTextSegment(text: string, tokens: Token[]) {
  // Split by flags and file paths
  const combined = new RegExp(`(--[a-z][a-z0-9-]*|(?:vendor|\.planning|\.agents|evals|bin|lib|scripts|commands)\\/[^\\s,)]+)`, "g");
  const parts = text.split(combined);

  for (const part of parts) {
    if (!part) continue;
    if (/^--[a-z]/.test(part)) {
      tokens.push({ type: "flag", value: part });
    } else if (/^(vendor|\.planning|\.agents|evals|bin|lib|scripts|commands)\//.test(part)) {
      tokens.push({ type: "file", value: part });
    } else {
      tokens.push({ type: "text", value: part });
    }
  }
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const tokens = tokenize(text);

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
                className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid break-all"
              >
                {token.value.length > 60 ? token.value.slice(0, 57) + "..." : token.value}
              </a>
            );
          case "code":
            return (
              <code key={i} className="rounded bg-card/60 border border-border/50 px-1 py-0.5 text-[10px] font-mono text-accent">
                {token.value}
              </code>
            );
          case "site-route":
            return (
              <Link
                key={i}
                href={token.route!}
                className="rounded bg-purple-500/10 border border-purple-500/30 px-1 py-0.5 text-[10px] font-mono text-purple-300 hover:bg-purple-500/20"
              >
                {token.route}
              </Link>
            );
          case "flag":
            return (
              <code key={i} className="rounded bg-sky-500/10 border border-sky-500/30 px-1 py-0.5 text-[10px] font-mono text-sky-300">
                {token.value}
              </code>
            );
          case "file":
            return (
              <code key={i} className="rounded bg-card/60 border border-border/40 px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
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
