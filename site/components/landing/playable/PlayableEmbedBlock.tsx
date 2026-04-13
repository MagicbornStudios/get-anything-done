import { Identified } from "@/components/devid/Identified";
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
    <Identified as="PlayableEmbedBlockGrid" className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
      <Identified as="PlayableEmbedBlockFrame">
        <PlayableEmbed
          project={selected.project}
          version={selected.version}
          iframeSrc={iframeSrc}
        />
      </Identified>
      <Identified as="PlayableEmbedBlockPanel">
        <PlayableSelectedPanel
          selected={selected}
          onOpenRequirements={onOpenRequirements}
          onOpenSkill={onOpenSkill}
        />
      </Identified>
    </Identified>
  );
}
