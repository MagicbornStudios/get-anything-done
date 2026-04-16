"use client";

import Link from "next/link";
import type { PlayableEntry } from "./scan-published";

/** Hash a string to a stable index for gradient presets. */
function gradientIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % GRADIENT_PRESETS.length;
}

const GRADIENT_PRESETS = [
  "from-violet-600/60 to-indigo-900/60",
  "from-emerald-600/60 to-teal-900/60",
  "from-amber-600/60 to-orange-900/60",
  "from-rose-600/60 to-pink-900/60",
  "from-cyan-600/60 to-blue-900/60",
  "from-fuchsia-600/60 to-purple-900/60",
];

const DOMAIN_COLORS: Record<string, string> = {
  game: "bg-emerald-700/80 text-emerald-100",
  app: "bg-blue-700/80 text-blue-100",
  site: "bg-amber-700/80 text-amber-100",
  cli: "bg-gray-700/80 text-gray-100",
  video: "bg-rose-700/80 text-rose-100",
};

function DomainBadge({ domain }: { domain: string | null }) {
  if (!domain) return null;
  const color = DOMAIN_COLORS[domain] ?? "bg-zinc-700/80 text-zinc-100";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${color}`}
    >
      {domain}
    </span>
  );
}

export function LibraryCard({ entry }: { entry: PlayableEntry }) {
  const gradient = GRADIENT_PRESETS[gradientIndex(entry.species)];
  const playUrl = `/library/play?src=${encodeURIComponent(entry.url)}`;
  const projectSlug = entry.project;

  return (
    <div
      data-cid="library-card"
      className="group flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/80 transition-shadow hover:shadow-lg hover:shadow-black/20"
    >
      {/* Gradient header */}
      <div
        className={`flex h-28 items-end bg-gradient-to-br p-3 ${gradient}`}
      >
        <DomainBadge domain={entry.domain} />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          {entry.project}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{entry.species}</span>
          <span className="text-border">|</span>
          <span className="font-mono">{entry.version}</span>
        </div>
        {entry.techStack && (
          <span className="text-[11px] text-muted-foreground/70">
            {entry.techStack}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border/30 px-4 py-3">
        <Link
          href={playUrl}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Play
        </Link>
        <Link
          href={`/projects/${projectSlug}`}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Details
        </Link>
      </div>
    </div>
  );
}
