"use client";

import { useState } from "react";
import type { SkillArtifact, SkillLineageCardProps } from "./skill-lineage-shared";
import SkillLineageRunHeader from "./SkillLineageRunHeader";
import SkillLineageSkillBody from "./SkillLineageSkillBody";
import SkillLineageSkillModal from "./SkillLineageSkillModal";

export type { SkillArtifact } from "./skill-lineage-shared";

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
}: SkillLineageCardProps) {
  const [openSkill, setOpenSkill] = useState<SkillArtifact | null>(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!openSkill?.content) return;
    navigator.clipboard.writeText(openSkill.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      <div
        id={version}
        className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/40 p-6"
      >
        <SkillLineageRunHeader
          version={version}
          date={date}
          playable={playable}
          projectHref={projectHref}
          runHref={runHref}
        />
        <SkillLineageSkillBody skills={skills} onSelectSkill={setOpenSkill} />
      </div>

      <SkillLineageSkillModal
        skill={openSkill}
        runKey={runKey}
        copied={copied}
        onCopy={copy}
        onClose={() => setOpenSkill(null)}
      />
    </>
  );
}
