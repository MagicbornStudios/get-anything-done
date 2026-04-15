"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, Mic, MicOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDevId } from "./DevIdProvider";
import { buildDeletePrompt, buildUpdateLockedPrefix, type PromptVerbosity } from "./DevIdPromptTemplates";
import { absolutePageUrl } from "./absolutePageUrl";
import { collectScopedEntries, escapeCidSelector, sortRegistryEntries } from "./devid-dom-scan";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import type { RegistryEntry } from "./SectionRegistry";
import { Identified } from "./Identified";
import { DevPanelHoverPromptActions } from "./DevPanelHoverPromptActions";
import { DEV_MODAL_FOOTER_SELF_ENTRY } from "./dev-modal-footer-constants";
import { Button } from "@/components/ui/button";
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
  const { enabled, highlightCid, setHighlightCid, flashComponent } = useDevId();
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [headerCopied, setHeaderCopied] = useState<"update" | "delete" | "cid" | null>(null);
  const [localPromptVerbosity, setLocalPromptVerbosity] = useState<PromptVerbosity>("full");
  const effectivePromptVerbosity = promptVerbosity ?? localPromptVerbosity;

  useEffect(() => {
    if (promptVerbosity) return;
    const raw = window.localStorage.getItem("devid.prompt.verbosity");
    if (raw === "compact" || raw === "full") setLocalPromptVerbosity(raw);
  }, [promptVerbosity]);

  useEffect(() => {
    window.localStorage.setItem("devid.prompt.verbosity", effectivePromptVerbosity);
  }, [effectivePromptVerbosity]);

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
      const prefix = buildUpdateLockedPrefix(
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
      toast.success(transcript.trim() ? "Update prompt copied" : "Update template copied");
    },
    [current, pathname, effectivePromptVerbosity],
  );

  const { listening, interim, toggle: toggleSpeech } = useDictatedPromptCopy({
    onFinalize: finalizeUpdate,
  });

  const copyDelete = useCallback(() => {
    if (!current) return;
    const resolved = buildDeletePrompt(
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
    toast.success("Delete prompt copied");
  }, [current, pathname, effectivePromptVerbosity]);

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

  const chromeTitle = (
    <div className="group/modalvc flex shrink-0 items-center gap-0.5">
      <span className="shrink-0 font-semibold uppercase tracking-wide text-accent">{modalLabel}</span>
      <DevPanelHoverPromptActions
        selfEntry={DEV_MODAL_FOOTER_SELF_ENTRY}
        pathname={pathname}
        promptVerbosity={effectivePromptVerbosity}
        onAgentPrompt={onChromeAgentPrompt}
        size="modal"
        className="pointer-events-none opacity-0 transition-opacity group-hover/modalvc:pointer-events-auto group-hover/modalvc:opacity-100"
      />
    </div>
  );

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
          {chromeTitle}
          <span>
            — no <code className="rounded bg-muted px-0.5 font-mono text-[8px]">data-cid</code> in this modal.
          </span>
        </div>
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
        <div
          title="Alt+click landmark toggles highlight · Esc clears · arrows change target"
          className="flex min-h-7 flex-nowrap items-center gap-x-1.5 gap-y-0 text-[9px] leading-none"
        >
          {chromeTitle}
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-6 gap-0.5 px-1.5 text-[9px]"
              onClick={toggleSpeech}
            >
              {headerCopied === "update" ? (
                <Check size={10} />
              ) : listening ? (
                <MicOff size={10} />
              ) : (
                <Mic size={10} />
              )}
              Upd
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-6 gap-0.5 px-1.5 text-[9px]"
              onClick={copyDelete}
            >
              {headerCopied === "delete" ? <Check size={10} /> : <Trash2 size={10} />}
              Del
            </Button>
            <Button type="button" variant="secondary" size="icon" className="size-6" onClick={copyCid}>
              {headerCopied === "cid" ? <Check size={10} /> : <Copy size={10} />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1 text-[9px] font-semibold uppercase tracking-wide"
              title="Toggle prompt verbosity"
              onClick={() => {
                const next = effectivePromptVerbosity === "full" ? "compact" : "full";
                if (onPromptVerbosityChange) onPromptVerbosityChange(next);
                else setLocalPromptVerbosity(next);
              }}
            >
              {effectivePromptVerbosity === "compact" ? "Short" : "Full"}
            </Button>
          </div>
        </div>
        {listening && interim ? (
          <p className="mt-1 max-w-full truncate border-t border-border/40 pt-1 text-[9px] text-emerald-400/95">
            <span className="font-semibold">Live — </span>
            {interim}
          </p>
        ) : null}
    </Identified>
  );
}
