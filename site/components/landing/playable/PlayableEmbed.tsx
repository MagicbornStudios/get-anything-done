"use client";

import { ExternalLink, Gamepad2 } from "lucide-react";

type Props = {
  project: string;
  version: string;
  iframeSrc: string;
};

export function PlayableEmbed({ project, version, iframeSrc }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Gamepad2 size={14} className="text-accent" aria-hidden />
          playable: {project}/{version}
        </div>
        <a
          href={iframeSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
        >
          Open full screen
          <ExternalLink size={11} aria-hidden />
        </a>
      </div>
      <div className="aspect-[16/10] w-full">
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          title={`${project} ${version}`}
          className="h-full w-full bg-[#1a1a2e]"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        />
      </div>
    </div>
  );
}
