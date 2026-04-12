"use client";

import { SiteSectionIntro } from "@/components/site";

export function CatalogIntro() {
  return (
    <SiteSectionIntro
      kicker="The catalog"
      preset="hero-compact"
      title={
        <>
          Every skill, subagent, and command <span className="gradient-text">in the box.</span>
        </>
      }
    >
      Skills are methodology docs the main agent follows. Subagents are specialised workers the
      framework spawns for planning, research, verification, UI audits, and more. Commands are the
      slash-command entry points. All of this is scanned directly out of{" "}
      <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">skills/</code>,{" "}
      <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">agents/</code>, and{" "}
      <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">commands/gad/</code> at build
      time — this list stays in sync with the repo.
    </SiteSectionIntro>
  );
}
