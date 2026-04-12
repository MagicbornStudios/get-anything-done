"use client";

import { SiteSectionIntro } from "@/components/site";

export function CatalogIntro() {
  return (
    <SiteSectionIntro
      kicker="The catalog"
      preset="hero-compact"
      title={
        <>
          Every skill, subagent, and template <span className="gradient-text">in the box.</span>
        </>
      }
    >
      Skills are methodology docs the main agent follows. Subagents are specialised workers the
      framework spawns for planning, research, verification, UI audits, and more. Templates are
      the planning and workflow scaffolds the CLI uses to bootstrap new work. This catalog is
      scanned directly out of <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">sdk/skills/</code>,{" "}
      <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">sdk/agents/</code>, and{" "}
      <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">sdk/templates/</code> at build
      time, with root <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">skills/</code> surfaced separately as internal methodology.
    </SiteSectionIntro>
  );
}
