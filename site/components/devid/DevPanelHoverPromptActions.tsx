"use client";

import { useCallback, useState } from "react";
import { Check, Copy, MessageSquare, Mic, MicOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildDeletePrompt,
  buildUpdateLockedPrefix,
  type PromptVerbosity,
} from "./DevIdPromptTemplates";
import { absolutePageUrl } from "./absolutePageUrl";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import type { RegistryEntry } from "./SectionRegistry";

type Size = "section" | "band" | "modal";

const icon = {
  section: 12,
  band: 11,
  modal: 10,
} as const;

const btn = {
  section: "size-6 h-6",
  band: "size-6 h-6",
  modal: "size-5 h-5",
} as const;

/**
 * Hover-only Mic / Copy / Delete / optional Message for dev chrome (panel title, modal VC strip).
 */
export function DevPanelHoverPromptActions({
  selfEntry,
  pathname,
  promptVerbosity,
  onAgentPrompt,
  size = "section",
  className,
}: {
  selfEntry: RegistryEntry;
  pathname: string;
  promptVerbosity: PromptVerbosity;
  onAgentPrompt?: (entry: RegistryEntry) => void;
  size?: Size;
  className?: string;
}) {
  const [copied, setCopied] = useState<"update" | "delete" | "cid" | null>(null);
  const is = icon[size];
  const b = btn[size];

  const finalizeUpdate = useCallback(
    (transcript: string) => {
      const prefix = buildUpdateLockedPrefix(
        absolutePageUrl(pathname),
        selfEntry.label,
        selfEntry.cid,
        selfEntry.componentTag ?? "Identified",
        selfEntry.searchHint,
        undefined,
        promptVerbosity,
      );
      const resolved = `${prefix}\n${transcript.trim()}`;
      navigator.clipboard?.writeText(resolved).catch(() => {});
      setCopied("update");
      window.setTimeout(() => setCopied(null), 1200);
      toast.success(transcript.trim() ? "Update prompt copied" : "Update template copied");
    },
    [pathname, selfEntry, promptVerbosity],
  );

  const { listening, interim, toggle: toggleSpeech } = useDictatedPromptCopy({
    onFinalize: finalizeUpdate,
    listeningMessage: "Listening for chrome handoff…",
  });

  const copyDelete = useCallback(() => {
    const resolved = buildDeletePrompt(
      absolutePageUrl(pathname),
      selfEntry.label,
      selfEntry.cid,
      selfEntry.componentTag ?? "Identified",
      selfEntry.searchHint,
      undefined,
      promptVerbosity,
    );
    navigator.clipboard?.writeText(resolved).catch(() => {});
    setCopied("delete");
    window.setTimeout(() => setCopied(null), 1200);
    toast.success("Delete prompt copied");
  }, [pathname, selfEntry, promptVerbosity]);

  const copyCid = useCallback(() => {
    navigator.clipboard?.writeText(selfEntry.searchHint ?? selfEntry.cid).catch(() => {});
    setCopied("cid");
    window.setTimeout(() => setCopied(null), 900);
  }, [selfEntry.cid, selfEntry.searchHint]);

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn(b, "shrink-0")}
        title="Dictate update prompt for this chrome"
        onClick={(e) => {
          e.stopPropagation();
          toggleSpeech();
        }}
      >
        {copied === "update" ? (
          <Check size={is} />
        ) : listening ? (
          <MicOff size={is} />
        ) : (
          <Mic size={is} />
        )}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn(b, "shrink-0")}
        title="Copy delete prompt"
        onClick={(e) => {
          e.stopPropagation();
          copyDelete();
        }}
      >
        {copied === "delete" ? <Check size={is} /> : <Trash2 size={is} />}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn(b, "shrink-0")}
        title="Copy search token"
        onClick={(e) => {
          e.stopPropagation();
          copyCid();
        }}
      >
        {copied === "cid" ? <Check size={is} /> : <Copy size={is} />}
      </Button>
      {onAgentPrompt ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn(b, "shrink-0")}
          title="Open agent handoff dialog"
          onClick={(e) => {
            e.stopPropagation();
            onAgentPrompt(selfEntry);
          }}
        >
          <MessageSquare size={is} />
        </Button>
      ) : null}
      {listening && interim ? (
        <span className="max-w-[10rem] truncate font-mono text-[9px] text-emerald-400/95" title={interim}>
          {interim}
        </span>
      ) : null}
    </div>
  );
}
