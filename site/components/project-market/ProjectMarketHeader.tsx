"use client";

import { Store } from "lucide-react";

export function ProjectMarketHeader() {
  return (
    <div className="border-b border-border/60 bg-card/20">
      <div className="section-shell pb-8 pt-24 md:pb-12 md:pt-32">
        <p className="section-kicker inline-flex items-center gap-2">
          <Store size={14} className="text-accent" aria-hidden />
          Project market
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Every eval project.{" "}
          <span className="gradient-text">Playable in your browser.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          Browse the full catalog of agent evaluation projects across games, video,
          software, and tooling. Each project tests a hypothesis about how coding
          agents build under different conditions.
        </p>
      </div>
    </div>
  );
}
