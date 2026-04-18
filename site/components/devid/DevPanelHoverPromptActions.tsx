"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Copy, MessageSquare, Mic, MicOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import { cn } from "@/lib/utils";
import {
  buildDeletePrompt,
  buildOuterDeletePrompt,
  buildOuterUpdateLockedPrefix,
  buildUpdateLockedPrefix,
  type PromptVerbosity,
} from "./DevIdPromptTemplates";
import { absolutePageUrl } from "./absolutePageUrl";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import type { RegistryEntry } from "./SectionRegistry";
import type { VcPanelCorner } from "@/components/devid/DevChromeHoverHint";
import { usePanelChord } from "./vc-chord";

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
  toggle: (mods?: { outer?: boolean }) => void;
};

/**
 * Hover-only Mic / Copy / Delete / optional Message for dev chrome (panel title, modal VC strip).
 * Pass `externalDictation` to lift speech + interim to the parent (e.g. shared Live footer on DevPanel).
 *
 * Modifier lanes:
 * - **Ctrl/Cmd+Upd** → outer-update prompt (anchor is this chrome target; agent refactors surrounding
 *   unidentified components first, then applies the user's notes).
 * - **Alt+Del** → outer-delete prompt (anchor preserved; surrounding unidentified sections removed).
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
  const [updateLane, setUpdateLane] = useState<"inner" | "outer">("inner");
  const outerUpdateRef = useRef(false);
  const { outerUpdateHeld, outerDeleteHeld } = usePanelChord();
  const is = icon[size];
  const b = btn[size];

  const finalizeUpdate = useCallback(
    (transcript: string) => {
      const outer = outerUpdateRef.current;
      outerUpdateRef.current = false;
      const prefix = outer
        ? buildOuterUpdateLockedPrefix(
            absolutePageUrl(pathname),
            selfEntry.label,
            selfEntry.cid,
            selfEntry.componentTag ?? "Identified",
            selfEntry.searchHint,
            promptVerbosity,
          )
        : buildUpdateLockedPrefix(
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
      const label = outer ? "Outer-update prompt copied" : "Update prompt copied";
      const templateLabel = outer ? "Outer-update template copied" : "Update template copied";
      toast.success(transcript.trim() ? label : templateLabel);
    },
    [pathname, selfEntry, promptVerbosity],
  );

  const internal = useDictatedPromptCopy({
    onFinalize: finalizeUpdate,
    listeningMessage: "Listening for chrome handoff…",
  });

  const listening = externalDictation?.listening ?? internal.listening;
  const interim = externalDictation?.interim ?? internal.interim;

  const handleUpdClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const outer = e.ctrlKey || e.metaKey;
      if (externalDictation) {
        if (!externalDictation.listening) setUpdateLane(outer ? "outer" : "inner");
        externalDictation.toggle({ outer });
        return;
      }
      if (!internal.listening) {
        outerUpdateRef.current = outer;
        setUpdateLane(outer ? "outer" : "inner");
      }
      internal.toggle();
    },
    [externalDictation, internal],
  );

  const showInlineInterim = !externalDictation;

  const copyDelete = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const outer = e.altKey;
      const resolved = outer
        ? buildOuterDeletePrompt(
            absolutePageUrl(pathname),
            selfEntry.label,
            selfEntry.cid,
            selfEntry.componentTag ?? "Identified",
            selfEntry.searchHint,
            promptVerbosity,
          )
        : buildDeletePrompt(
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
      toast.success(outer ? "Outer-delete prompt copied" : "Delete prompt copied");
    },
    [pathname, selfEntry, promptVerbosity],
  );

  const copyCid = useCallback(() => {
    navigator.clipboard?.writeText(selfEntry.searchHint ?? selfEntry.cid).catch(() => {});
    setCopied("cid");
    window.setTimeout(() => setCopied(null), 900);
  }, [selfEntry.cid, selfEntry.searchHint]);

  const listeningOuter = listening && updateLane === "outer";

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      <DevChromeHoverHint
        dockCorner={dockCorner}
        body={
          <p>
            Dictate additions to the update handoff for this chrome.
            <br />
            <strong>Ctrl/Cmd+click</strong> to start recording in the <em>outer</em> lane — prompt uses this chrome
            as an anchor and asks the agent to identify + refactor surrounding unidentified components first.
          </p>
        }
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn(
            b,
            "shrink-0 transition-colors",
            (listeningOuter || (!listening && outerUpdateHeld)) &&
              "bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/50",
          )}
          aria-label={
            listening
              ? updateLane === "outer"
                ? "Stop outer-update recording and copy"
                : "Stop update recording and copy"
              : outerUpdateHeld
                ? "Start outer-update recording (Ctrl held)"
                : "Start update recording (hold Ctrl for outer lane)"
          }
          onClick={handleUpdClick}
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
        body={
          <p>
            Copy a delete handoff prompt for this chrome.
            <br />
            <strong>Alt+click</strong> for the outer-delete variant — remove surrounding unidentified sections while
            keeping this chrome as the anchor.
          </p>
        }
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn(
            b,
            "shrink-0 transition-colors",
            outerDeleteHeld && "bg-destructive/15 text-destructive ring-1 ring-destructive/50",
          )}
          aria-label={
            outerDeleteHeld
              ? "Copy outer-delete prompt (Alt held)"
              : "Copy delete prompt (hold Alt for outer-delete)"
          }
          onClick={copyDelete}
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
          <span
            className={cn(
              "inline-block max-w-[10rem] cursor-help truncate font-mono text-[9px]",
              listeningOuter ? "text-amber-300/95" : "text-emerald-400/95",
            )}
          >
            {listeningOuter ? `outer · ${interim}` : interim}
          </span>
        </DevChromeHoverHint>
      ) : null}
    </div>
  );
}
