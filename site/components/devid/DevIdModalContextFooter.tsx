"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, Mic, MicOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDevId } from "./DevIdProvider";
import {
  buildDeletePrompt,
  buildOuterDeletePrompt,
  buildOuterUpdateLockedPrefix,
  buildUpdateLockedPrefix,
  type PromptVerbosity,
} from "./DevIdPromptTemplates";
import { usePanelChord } from "./vc-chord";
import { absolutePageUrl } from "./absolutePageUrl";
import { collectScopedEntries, escapeCidSelector, sortRegistryEntries } from "./devid-dom-scan";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import type { RegistryEntry } from "./SectionRegistry";
import { Identified } from "./Identified";
import { DevPanelHoverPromptActions } from "./DevPanelHoverPromptActions";
import { DEV_MODAL_FOOTER_SELF_ENTRY } from "./dev-modal-footer-constants";
import { Button } from "@/components/ui/button";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import { cn } from "@/lib/utils";

function locateInTree(cid: string, root: HTMLElement | null, flash: (c: string) => void) {
  if (!root) return;
  const el = root.querySelector(`[data-cid="${escapeCidSelector(cid)}"]`) as HTMLElement | null;
  if (!el) return;
  const hadTab = el.hasAttribute("tabindex");
  if (!hadTab) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  flash(cid);
  window.setTimeout(() => {
    if (!hadTab) el.removeAttribute("tabindex");
  }, 1200);
}

/**
 * Compact visual-context strip for portaled modals: scans `scanRootRef` for `[data-cid]`,
 * paginates, syncs with global `highlightCid` (Alt+click on Identified; Alt+click again clears), copy / speech / agent dialog.
 *
 * Modifier lanes on the action cluster:
 * - **Upd**: default → inner update prompt for the current target. Hold **Ctrl/Cmd** while clicking
 *   to start recording in the *outer* lane — prompt anchors at the current target but instructs
 *   the agent to refactor / identify surrounding (unidentified) components first, then apply notes.
 * - **Del**: default → inner delete prompt for the current target. Hold **Alt** while clicking to
 *   copy a delete prompt that targets the unidentifiable sections *around* the anchor instead.
 */
export function DevIdModalContextFooter({
  open,
  scanRootRef,
  className,
  onActiveEntryChange,
  promptVerbosity,
  onPromptVerbosityChange,
  onChromeAgentPrompt,
}: {
  open: boolean;
  scanRootRef: RefObject<HTMLElement | null>;
  className?: string;
  onActiveEntryChange?: (entry: RegistryEntry | null) => void;
  promptVerbosity?: PromptVerbosity;
  onPromptVerbosityChange?: (verbosity: PromptVerbosity) => void;
  /** Optional: show Message in hover chrome for this strip (omit inside nested agent prompt dialog). */
  onChromeAgentPrompt?: (entry: RegistryEntry) => void;
}) {
  const pathname = usePathname() ?? "";
  const {
    enabled,
    highlightCid,
    setHighlightCid,
    flashComponent,
    promptVerbosity: sharedPromptVerbosity,
    setPromptVerbosity: setSharedPromptVerbosity,
  } = useDevId();
  const { outerUpdateHeld, outerDeleteHeld } = usePanelChord();
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [headerCopied, setHeaderCopied] = useState<"update" | "delete" | "cid" | null>(null);
  const [chromeFooterUpdateCopied, setChromeFooterUpdateCopied] = useState(false);
  /** Recording started in outer (Ctrl) lane? Captured at toggle time so async finalize picks the right builder. */
  const outerUpdateRef = useRef(false);
  const [lastUpdateLane, setLastUpdateLane] = useState<"inner" | "outer">("inner");
  const effectivePromptVerbosity = promptVerbosity ?? sharedPromptVerbosity;

  const recompute = useCallback(() => {
    const root = scanRootRef.current;
    if (!root || !open) {
      setEntries([]);
      return;
    }
    setEntries(sortRegistryEntries(collectScopedEntries(root, { includeScope: false })));
  }, [open, scanRootRef]);

  useEffect(() => {
    recompute();
    if (!open) return;
    const root = scanRootRef.current;
    if (!root) return;
    const obs = new MutationObserver(recompute);
    obs.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-cid", "data-cid-label", "data-cid-search"],
    });
    const raf = requestAnimationFrame(recompute);
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [open, recompute, scanRootRef]);

  useEffect(() => {
    if (!entries.length) {
      setIdx(0);
      return;
    }
    if (highlightCid) {
      const i = entries.findIndex((e) => e.cid === highlightCid);
      if (i >= 0) {
        setIdx(i);
        return;
      }
    }
    setIdx((prev) => Math.min(prev, entries.length - 1));
  }, [entries, highlightCid]);

  const current = entries[idx] ?? null;

  useEffect(() => {
    onActiveEntryChange?.(current);
  }, [current, onActiveEntryChange]);

  const finalizeUpdate = useCallback(
    (transcript: string) => {
      if (!current) return;
      const outer = outerUpdateRef.current;
      outerUpdateRef.current = false;
      const prefix = outer
        ? buildOuterUpdateLockedPrefix(
            absolutePageUrl(pathname),
            current.label,
            current.cid,
            current.componentTag ?? "Identified",
            current.searchHint,
            effectivePromptVerbosity,
          )
        : buildUpdateLockedPrefix(
            absolutePageUrl(pathname),
            current.label,
            current.cid,
            current.componentTag ?? "Identified",
            current.searchHint,
            undefined,
            effectivePromptVerbosity,
          );
      const resolved = `${prefix}\n${transcript.trim()}`;
      navigator.clipboard?.writeText(resolved).catch(() => {});
      setHeaderCopied("update");
      window.setTimeout(() => setHeaderCopied(null), 1200);
      const label = outer ? "Outer-update prompt copied" : "Update prompt copied";
      const templateLabel = outer ? "Outer-update template copied" : "Update template copied";
      toast.success(transcript.trim() ? label : templateLabel);
    },
    [current, pathname, effectivePromptVerbosity],
  );

  const { listening, interim, toggle: toggleSpeech } = useDictatedPromptCopy({
    onFinalize: finalizeUpdate,
  });

  const onUpdateClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!listening) {
        const outer = e.ctrlKey || e.metaKey;
        outerUpdateRef.current = outer;
        setLastUpdateLane(outer ? "outer" : "inner");
      }
      toggleSpeech();
    },
    [listening, toggleSpeech],
  );

  const finalizeModalChromeSelfPrompt = useCallback(
    (transcript: string) => {
      const prefix = buildUpdateLockedPrefix(
        absolutePageUrl(pathname),
        DEV_MODAL_FOOTER_SELF_ENTRY.label,
        DEV_MODAL_FOOTER_SELF_ENTRY.cid,
        DEV_MODAL_FOOTER_SELF_ENTRY.componentTag ?? "Identified",
        DEV_MODAL_FOOTER_SELF_ENTRY.searchHint,
        undefined,
        effectivePromptVerbosity,
      );
      const resolved = `${prefix}\n${transcript.trim()}`;
      navigator.clipboard?.writeText(resolved).catch(() => {});
      setChromeFooterUpdateCopied(true);
      window.setTimeout(() => setChromeFooterUpdateCopied(false), 1200);
      toast.success(transcript.trim() ? "Update prompt copied" : "Update template copied");
    },
    [pathname, effectivePromptVerbosity],
  );

  const {
    listening: listeningChrome,
    interim: interimChrome,
    toggle: toggleChromeSpeech,
  } = useDictatedPromptCopy({
    onFinalize: finalizeModalChromeSelfPrompt,
    listeningMessage: "Listening for modal VC chrome…",
  });

  const copyDelete = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!current) return;
      const outer = e.altKey;
      const resolved = outer
        ? buildOuterDeletePrompt(
            absolutePageUrl(pathname),
            current.label,
            current.cid,
            current.componentTag ?? "Identified",
            current.searchHint,
            effectivePromptVerbosity,
          )
        : buildDeletePrompt(
            absolutePageUrl(pathname),
            current.label,
            current.cid,
            current.componentTag ?? "Identified",
            current.searchHint,
            undefined,
            effectivePromptVerbosity,
          );
      navigator.clipboard?.writeText(resolved).catch(() => {});
      setHeaderCopied("delete");
      window.setTimeout(() => setHeaderCopied(null), 1200);
      toast.success(outer ? "Outer-delete prompt copied" : "Delete prompt copied");
    },
    [current, pathname, effectivePromptVerbosity],
  );

  const go = (nextIdx: number) => {
    if (!entries.length) return;
    const i = ((nextIdx % entries.length) + entries.length) % entries.length;
    setIdx(i);
    const e = entries[i];
    if (e) {
      setHighlightCid(e.cid);
      locateInTree(e.cid, scanRootRef.current, flashComponent);
    }
  };

  const onLocate = () => {
    if (!current) return;
    locateInTree(current.cid, scanRootRef.current, flashComponent);
  };

  const copyCid = () => {
    if (!current) return;
    navigator.clipboard?.writeText(current.searchHint ?? current.cid).catch(() => {});
    setHeaderCopied("cid");
    window.setTimeout(() => setHeaderCopied(null), 900);
  };

  /** Short toolbar label (full product name: same as main dev panel). */
  const modalLabel = "VC · modal";

  if (!enabled || !open) return null;

  const modalTitleChrome = (
    <div className="group/modalvc relative z-10 h-6 min-w-[6.5rem] shrink-0">
      <span className="absolute inset-0 flex items-center font-semibold uppercase tracking-wide text-accent transition-opacity group-hover/modalvc:pointer-events-none group-hover/modalvc:opacity-0">
        {modalLabel}
      </span>
      <div className="absolute inset-0 flex h-6 items-center gap-0.5 opacity-0 transition-opacity group-hover/modalvc:pointer-events-auto group-hover/modalvc:opacity-100">
        <DevPanelHoverPromptActions
          selfEntry={DEV_MODAL_FOOTER_SELF_ENTRY}
          pathname={pathname}
          promptVerbosity={effectivePromptVerbosity}
          onAgentPrompt={onChromeAgentPrompt}
          size="modal"
          externalDictation={{
            listening: listeningChrome,
            interim: interimChrome,
            toggle: toggleChromeSpeech,
          }}
          updateJustCopied={chromeFooterUpdateCopied}
        />
      </div>
    </div>
  );

  const anyListening = listening || listeningChrome;
  const activeInterim = listening ? interim : interimChrome;
  const listeningOuter = listening && lastUpdateLane === "outer";
  const activeLabel = listeningOuter ? "Outer · live" : "Live";
  const liveDictationLine = anyListening ? (
    <p
      className={cn(
        "mt-1 max-w-full truncate border-t border-border/40 pt-1 text-[9px]",
        listeningOuter ? "text-amber-300/95" : "text-emerald-400/95",
      )}
    >
      <span className="font-semibold">{activeLabel} — </span>
      {activeInterim || "\u00a0"}
    </p>
  ) : null;

  if (!entries.length) {
    return (
      <Identified
        as="DevIdModalContextFooter"
        cid="visual-context-modal-footer"
        register={false}
        className={cn(
          "shrink-0 border-t border-border/60 bg-muted/20 px-2 py-1 text-[9px] leading-tight text-muted-foreground",
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {modalTitleChrome}
          <span className="flex-1">
            — no <code className="rounded bg-muted px-0.5 font-mono text-[8px]">data-cid</code> in this modal.
          </span>
        </div>
        {liveDictationLine}
      </Identified>
    );
  }

  return (
    <Identified
      as="DevIdModalContextFooter"
      cid="visual-context-modal-footer"
      register={false}
      className={cn(
        "shrink-0 border-t border-border/60 bg-muted/25 px-2 py-1",
        className,
      )}
    >
        <DevChromeHoverHint
          body={
            <p>
              Alt+click a landmark toggles a persistent highlight. Esc clears. Chevrons change the active target in
              this modal footer. <strong>Ctrl+Upd</strong> switches the update prompt to the <em>outer</em> lane
              (neighborhood refactor + identification around this anchor). <strong>Alt+Del</strong> switches the
              delete prompt to the outer lane (remove unidentified surrounding sections).
            </p>
          }
        >
          <div className="flex min-h-7 flex-nowrap items-center gap-x-1.5 gap-y-0 text-[9px] leading-none">
          {modalTitleChrome}
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {idx + 1}/{entries.length}
          </span>
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Previous landmark"
              onClick={() => go(idx - 1)}
            >
              <ChevronLeft size={11} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Next landmark"
              onClick={() => go(idx + 1)}
            >
              <ChevronRight size={11} />
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-6 shrink-0 px-1.5 text-[9px]"
            onClick={onLocate}
          >
            Locate
          </Button>
          {current ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden border-l border-border/50 pl-1.5">
              <span className="min-w-0 truncate font-medium text-foreground">{current.label}</span>
              <span className="min-w-0 shrink truncate font-mono text-[8px] text-muted-foreground">
                {current.searchHint ?? current.cid}
              </span>
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          <div className="flex shrink-0 items-center gap-0.5">
            <DevChromeHoverHint
              body={
                <p>
                  Dictate additions to the update prompt for this target.
                  <br />
                  <strong>Ctrl/Cmd+click</strong> to record in the outer lane — prompt uses this target as an anchor
                  and asks the agent to identify + refactor surrounding unidentified components first.
                </p>
              }
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label={
                  listening
                    ? lastUpdateLane === "outer"
                      ? "Stop outer-update recording and copy"
                      : "Stop update recording and copy"
                    : outerUpdateHeld
                      ? "Start outer-update recording (Ctrl held)"
                      : "Start update recording (hold Ctrl for outer lane)"
                }
                className={cn(
                  "h-6 gap-0.5 px-1.5 text-[9px] transition-colors",
                  (listening && lastUpdateLane === "outer") ||
                    (!listening && outerUpdateHeld)
                    ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/50"
                    : undefined,
                )}
                onClick={onUpdateClick}
              >
                {headerCopied === "update" ? (
                  <Check size={10} />
                ) : listening ? (
                  <MicOff size={10} />
                ) : (
                  <Mic size={10} />
                )}
                {(listening && lastUpdateLane === "outer") ||
                (!listening && outerUpdateHeld)
                  ? "Upd·out"
                  : "Upd"}
              </Button>
            </DevChromeHoverHint>
            <DevChromeHoverHint
              body={
                <p>
                  Copy a delete prompt for this target.
                  <br />
                  <strong>Alt+click</strong> to copy the outer-delete prompt instead — instructs the agent to remove
                  the unidentified surrounding section(s) around this anchor.
                </p>
              }
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label={
                  outerDeleteHeld
                    ? "Copy outer-delete prompt (Alt held — removes surrounding unidentified sections)"
                    : "Copy delete prompt (hold Alt for outer-delete)"
                }
                className={cn(
                  "h-6 gap-0.5 px-1.5 text-[9px] transition-colors",
                  outerDeleteHeld &&
                    "bg-destructive/15 text-destructive ring-1 ring-destructive/50",
                )}
                onClick={copyDelete}
              >
                {headerCopied === "delete" ? <Check size={10} /> : <Trash2 size={10} />}
                {outerDeleteHeld ? "Del·out" : "Del"}
              </Button>
            </DevChromeHoverHint>
            <Button type="button" variant="secondary" size="icon" className="size-6" onClick={copyCid}>
              {headerCopied === "cid" ? <Check size={10} /> : <Copy size={10} />}
            </Button>
            <DevChromeHoverHint
              body={
                effectivePromptVerbosity === "full" ? (
                  <p>Prompts include full context. Click to switch to compact templates.</p>
                ) : (
                  <p>Prompts use compact templates. Click to include full context.</p>
                )
              }
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-[9px] font-semibold uppercase tracking-wide"
                onClick={() => {
                  const next = effectivePromptVerbosity === "full" ? "compact" : "full";
                  if (onPromptVerbosityChange) onPromptVerbosityChange(next);
                  else setSharedPromptVerbosity(next);
                }}
              >
                {effectivePromptVerbosity === "compact" ? "Short" : "Full"}
              </Button>
            </DevChromeHoverHint>
          </div>
          </div>
        </DevChromeHoverHint>
        {liveDictationLine}
    </Identified>
  );
}
