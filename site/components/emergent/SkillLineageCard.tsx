"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, X, Copy, Check, ExternalLink } from "lucide-react";

export interface SkillArtifact {
  name: string;
  bytes: number;
  /** Optional raw content — if provided, clicking opens a modal with this text */
  content?: string | null;
  /** Source path in the repo */
  file?: string | null;
  /** Matching skill id in the catalog, if resolvable */
  skillId?: string | null;
}

interface Props {
  runKey: string;
  version: string;
  date: string | null;
  playable: boolean;
  projectHref: string;
  runHref: string;
  skills: SkillArtifact[];
}

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

/**
 * Client component replacing the static skill chip list on /emergent so
 * clicking a skill pops up its SKILL.md content with a copy button and a
 * source-on-github link. Per user directive 2026-04-09: "this is an
 * incredible page. I wish i could click and download or get that pop up
 * of those skills on the page."
 */
export function SkillLineageCard({
  runKey,
  version,
  date,
  playable,
  projectHref,
  runHref,
  skills,
}: Props) {
  const [openSkill, setOpenSkill] = useState<SkillArtifact | null>(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!openSkill?.content) return;
    navigator.clipboard.writeText(openSkill.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const hasContent = skills.length > 0;

  return (
    <>
      <div
        id={version}
        className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/40 p-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[11px]">
            {version}
          </span>
          <span className="text-sm text-muted-foreground">{date}</span>
          {playable && (
            <Link
              href={projectHref}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              Playable
              <ArrowRight size={9} aria-hidden />
            </Link>
          )}
          <Link
            href={runHref}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Full breakdown
            <ArrowRight size={11} aria-hidden />
          </Link>
        </div>

        {hasContent ? (
          <div className="mt-5">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Skills authored or carried forward this run — click to read
            </p>
            <ul className="space-y-1">
              {skills.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => setOpenSkill(s)}
                    disabled={!s.content}
                    className="flex w-full items-center justify-between gap-3 rounded border border-border/40 bg-background/40 px-3 py-2 text-left font-mono text-xs text-muted-foreground transition-colors hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-200 disabled:opacity-60 disabled:hover:border-border/40 disabled:hover:bg-background/40 disabled:hover:text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles size={10} className="text-amber-400" aria-hidden />
                      {s.name}
                    </span>
                    <span className="flex items-center gap-2 text-[10px] opacity-60 tabular-nums">
                      {(s.bytes / 1024).toFixed(1)} KB
                      {s.content && (
                        <ExternalLink size={9} className="opacity-80" aria-hidden />
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-5 text-xs text-muted-foreground opacity-70">
            No preserved skill artifacts for this run.
          </p>
        )}
      </div>

      {/* Modal */}
      {openSkill && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setOpenSkill(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-card shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-amber-500/5 px-6 py-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-amber-300">
                  <Sparkles size={10} className="mr-1 inline" aria-hidden />
                  Skill · {runKey}
                </p>
                <h3 className="mt-1 truncate font-mono text-lg font-semibold text-foreground">
                  {openSkill.name}
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                  {(openSkill.bytes / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
                >
                  {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </button>
                {openSkill.file && (
                  <a
                    href={`${REPO}/blob/main/${openSkill.file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    GitHub
                    <ExternalLink size={10} aria-hidden />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setOpenSkill(null)}
                  className="rounded-full border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                  aria-label="Close"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-background/60 p-6">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-muted-foreground">
                {openSkill.content ?? "(skill file content unavailable)"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
