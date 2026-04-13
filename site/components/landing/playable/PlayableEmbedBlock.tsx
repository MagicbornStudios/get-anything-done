import type { EvalRunRecord } from "@/lib/eval-data";
import { PlayableEmbed } from "@/components/landing/playable/PlayableEmbed";
import { PlayableSelectedPanel } from "@/components/landing/playable/PlayableSelectedPanel";
import { PlayableStageGrid } from "@/components/landing/playable/PlayableStageGrid";

type PlayableEmbedBlockProps = {
  selected: EvalRunRecord;
  iframeSrc: string;
  onOpenRequirements: () => void;
  onOpenSkill: () => void;
};

export function PlayableEmbedBlock({
  selected,
  iframeSrc,
  onOpenRequirements,
  onOpenSkill,
}: PlayableEmbedBlockProps) {
  return (
    <PlayableStageGrid className="mt-8">
      <PlayableEmbed
        project={selected.project}
        version={selected.version}
        iframeSrc={iframeSrc}
      />
      <PlayableSelectedPanel
        selected={selected}
        onOpenRequirements={onOpenRequirements}
        onOpenSkill={onOpenSkill}
      />
    </PlayableStageGrid>
  );
}
