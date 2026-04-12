import { GitBranch } from "lucide-react";
import { SkillLineageCard } from "@/components/emergent/SkillLineageCard";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { PLAYABLE_INDEX, PRODUCED_ARTIFACTS, type EvalRunRecord } from "@/lib/eval-data";
import { emergentRunKey } from "./EmergentScoredRunRow";

type EmergentLineageSectionProps = {
  runs: EvalRunRecord[];
};

export function EmergentLineageSection({ runs }: EmergentLineageSectionProps) {
  return (
    <SiteSection>
      <SiteSectionHeading icon={GitBranch} kicker="Skill lineage per run" kickerRowClassName="mb-6 gap-3" />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Every run&apos;s skill footprint — what it inherited from the previous run, what new skills it
        authored, what it deprecated. A healthy CSH signal looks like: inherited count goes up, authored
        count stays positive, deprecated count is non-zero (the agent is self-correcting), and CHANGELOG
        dispositions are recorded.
      </p>
      <div className="space-y-4">
        {runs.map((r) => {
          const artifacts = PRODUCED_ARTIFACTS[emergentRunKey(r)];
          const skillFiles = artifacts?.skillFiles ?? [];
          return (
            <SkillLineageCard
              key={emergentRunKey(r)}
              runKey={emergentRunKey(r)}
              version={r.version}
              date={r.date}
              playable={!!PLAYABLE_INDEX[emergentRunKey(r)]}
              projectHref={`/project-market`}
              runHref={`/runs/${r.project}/${r.version}`}
              skills={skillFiles.map((s) => ({
                name: s.name,
                bytes: s.bytes,
                content: s.content ?? null,
                file: s.file ?? null,
              }))}
            />
          );
        })}
      </div>
    </SiteSection>
  );
}
