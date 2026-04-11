"use client";

import { Sparkles, X, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { REPO } from "./skill-lineage-shared";
import type { SkillArtifact } from "./skill-lineage-shared";

export default function SkillLineageSkillModal({
  skill,
  runKey,
  copied,
  onCopy,
  onClose,
}: {
  skill: SkillArtifact | null;
  runKey: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={skill !== null} onOpenChange={(open) => !open && onClose()}>
      {skill !== null && (
        <DialogContent
          hideClose
          overlayClassName="z-[70] bg-background/80 backdrop-blur-sm"
          className="z-[70] flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-2xl border border-amber-500/40 bg-card p-0 shadow-2xl shadow-black/60 sm:rounded-2xl"
          aria-describedby={undefined}
        >
          <DialogHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border/60 bg-amber-500/5 px-6 py-4 text-left">
            <div className="min-w-0">
              <DialogDescription className="text-xs uppercase tracking-wider text-amber-300">
                <Sparkles size={10} className="mr-1 inline" aria-hidden />
                Skill · {runKey}
              </DialogDescription>
              <DialogTitle className="mt-1 truncate font-mono text-lg font-semibold leading-snug text-foreground">
                {skill.name}
              </DialogTitle>
              <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                {(skill.bytes / 1024).toFixed(1)} KB
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCopy}
                className="h-auto gap-1.5 rounded-full border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20"
              >
                {copied ? <Check className="size-2.5" aria-hidden /> : <Copy className="size-2.5" aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
              {skill.file && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-accent"
                  asChild
                >
                  <a href={`${REPO}/blob/main/${skill.file}`} target="_blank" rel="noopener noreferrer">
                    GitHub
                    <ExternalLink className="size-2.5" aria-hidden />
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 shrink-0 rounded-full"
                aria-label="Close"
              >
                <X className="size-3" aria-hidden />
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-muted-foreground">
                {skill.content ?? "(skill file content unavailable)"}
              </pre>
            </div>
          </ScrollArea>
        </DialogContent>
      )}
    </Dialog>
  );
}
