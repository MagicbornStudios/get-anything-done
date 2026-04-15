"use client";

import { useCallback, useState } from "react";
import { Check, Copy, MessageSquare, Mic, MicOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import { cn } from "@/lib/utils";
import {
  buildDeletePrompt,
  buildUpdateLockedPrefix,
  type PromptVerbosity,
} from "./DevIdPromptTemplates";
import { absolutePageUrl } from "./absolutePageUrl";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import type { RegistryEntry } from "./SectionRegistry";
import type { VcPanelCorner } from "@/components/devid/DevChromeHoverHint";

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

export type ExternalDictation = {
  listening: boolean;
  interim: string;
  toggle: () => void;
};

/**
 * Hover-only Mic / Copy / Delete / optional Message for dev chrome (panel title, modal VC strip).
 * Pass `externalDictation` to lift speech + interim to the parent (e.g. shared Live footer on DevPanel).
 */
export function DevPanelHoverPromptActions({
  selfEntry,
  pathname,
  promptVerbosity,
  onAgentPrompt,
  size = "section",
  className,
  externalDictation,
  updateJustCopied = false,
  /** When set (section/band VC panel), hover cards open beside the panel toward page center. */
  dockCorner,
}: {
  selfEntry: RegistryEntry;
  pathname: string;
  promptVerbosity: PromptVerbosity;
  onAgentPrompt?: (entry: RegistryEntry) => void;
  size?: Size;
  className?: string;
  /** When set, Mic uses this slot and interim is not rendered here (parent shows it). */
  externalDictation?: ExternalDictation;
  /** Parent-driven check on Mic (e.g. after external dictation finalize). */
  updateJustCopied?: boolean;
  dockCorner?: VcPanelCorner;
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

  const internal = useDictatedPromptCopy({
    onFinalize: finalizeUpdate,
    listeningMessage: "Listening for chrome handoff…",
  });

  const listening = externalDictation?.listening ?? internal.listening;
  const interim = externalDictation?.interim ?? internal.interim;
  const toggleSpeech = externalDictation?.toggle ?? internal.toggle;

  const showInlineInterim = !externalDictation;

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
      <DevChromeHoverHint
        dockCorner={dockCorner}
        body={<p>Dictate additions to the update handoff for this chrome; copies a locked prefix plus your speech.</p>}
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn(b, "shrink-0")}
          onClick={(e) => {
            e.stopPropagation();
            toggleSpeech();
          }}
        >
          {copied === "update" || updateJustCopied ? (
            <Check size={is} />
          ) : listening ? (
            <MicOff size={is} />
          ) : (
            <Mic size={is} />
          )}
        </Button>
      </DevChromeHoverHint>
      <DevChromeHoverHint
        dockCorner={dockCorner}
        body={<p>Copy a delete handoff prompt for this chrome (route, label, source-search hints).</p>}
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn(b, "shrink-0")}
          onClick={(e) => {
            e.stopPropagation();
            copyDelete();
          }}
        >
          {copied === "delete" ? <Check size={is} /> : <Trash2 size={is} />}
        </Button>
      </DevChromeHoverHint>
      <DevChromeHoverHint
        dockCorner={dockCorner}
        body={<p>Copy the greppable search token for this chrome ({selfEntry.searchHint ?? selfEntry.cid}).</p>}
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn(b, "shrink-0")}
          onClick={(e) => {
            e.stopPropagation();
            copyCid();
          }}
        >
          {copied === "cid" ? <Check size={is} /> : <Copy size={is} />}
        </Button>
      </DevChromeHoverHint>
      {onAgentPrompt ? (
        <DevChromeHoverHint dockCorner={dockCorner} body={<p>Open the full agent handoff dialog for this chrome.</p>}>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className={cn(b, "shrink-0")}
            onClick={(e) => {
              e.stopPropagation();
              onAgentPrompt(selfEntry);
            }}
          >
            <MessageSquare size={is} />
          </Button>
        </DevChromeHoverHint>
      ) : null}
      {showInlineInterim && listening && interim ? (
        <DevChromeHoverHint
          dockCorner={dockCorner}
          body={<p className="max-h-40 overflow-y-auto font-mono text-[9px] text-emerald-100">{interim}</p>}
        >
          <span className="inline-block max-w-[10rem] cursor-help truncate font-mono text-[9px] text-emerald-400/95">
            {interim}
          </span>
        </DevChromeHoverHint>
      ) : null}
    </div>
  );
}
