"use client";

import { Identified } from "@/components/devid/Identified";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EvalRunRecord } from "@/lib/eval-data";

type Props = {
  modal: "requirements" | "skill" | null;
  selected: EvalRunRecord | null;
  onOpenChange: (open: boolean) => void;
};

export function PlayableDocModal({ modal, selected, onOpenChange }: Props) {
  return (
    <Dialog open={!!modal && !!selected} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
        <Identified as="PlayableDocModalHeader">
        <DialogHeader className="px-6 py-4 border-b border-border/60">
          <DialogDescription className="text-xs uppercase tracking-wider text-muted-foreground">
            {modal === "requirements" ? "Game requirements" : "Top skill"} ·{" "}
            {selected?.project}/{selected?.version}
          </DialogDescription>
          <DialogTitle className="truncate text-lg">
            {modal === "requirements"
              ? selected?.requirementsDoc?.filename
              : selected?.topSkill?.filename}
          </DialogTitle>
        </DialogHeader>
        </Identified>
        <ScrollArea className="flex-1 min-h-0">
          <Identified as="PlayableDocModalBody" className="p-6">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-muted-foreground">
              {modal === "requirements"
                ? selected?.requirementsDoc?.content
                : selected?.topSkill?.content ?? "(skill file content unavailable)"}
            </pre>
          </Identified>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
