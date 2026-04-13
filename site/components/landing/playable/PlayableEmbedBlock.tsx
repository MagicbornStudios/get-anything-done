import type { EvalRunRecord } from "@/lib/eval-data";
import { PlayableEmbed } from "@/components/landing/playable/PlayableEmbed";
import { PlayableSelectedPanel } from "@/components/landing/playable/PlayableSelectedPanel";

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
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
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
    </div>
  );
}
