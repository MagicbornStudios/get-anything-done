"use client";

/**
 * Handoff dialog for coding agents. **Update**: fixed template (read-only `pre`) from
 * `buildUpdateLockedPrefix`; CodeMirror edits the user message only; copy joins both.
 * **Delete**: fixed template from `buildDeletePrompt` (read-only); copy only. Mic on **Upd** only.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Mic, MicOff, Copy, Check, FilePenLine, FileX2 } from "lucide-react";
import { HandoffMarkdownEditor, type HandoffEditorHandle } from "./HandoffMarkdownEditor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Identified } from "./Identified";
import type { RegistryEntry } from "./SectionRegistry";
import { absolutePageUrl } from "./absolutePageUrl";
import { getSpeechRecognition, type SpeechRecInstance } from "./speechRecognition";
import { DevIdModalContextFooter } from "./DevIdModalContextFooter";
import {
  buildDeletePrompt,
  buildUpdateLockedPrefix,
  DEFAULT_DELETE_TEMPLATE,
  DEFAULT_UPDATE_TEMPLATE,
  type HandoffComponentTag,
  type PromptVerbosity,
} from "./DevIdPromptTemplates";


function HandoffPromptPane({
  draft,
  onDraftChange,
  editorRef,
  editorKey,
  lockedHeader,
  /** Full read-only body (delete tab); no editor below. */
  readOnlyBody,
  hoverChrome,
  speechFooter,
  ariaLabel,
}: {
  draft: string;
  onDraftChange: (next: string) => void;
  editorRef: RefObject<HandoffEditorHandle | null>;
  editorKey: string;
  /** When set, shown read-only above the editor (update tab). */
  lockedHeader?: string;
  readOnlyBody?: string;
  hoverChrome: ReactNode;
  speechFooter?: ReactNode;
  ariaLabel: string;
}) {
  if (readOnlyBody) {
    return (
      <div className="flex h-full min-h-0 flex-1 basis-0 flex-col px-2 pb-3 pt-1 sm:px-4 sm:pb-4 sm:pt-1.5">
        <div className="group/prompt relative flex h-full min-h-[12rem] flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/15 shadow-inner">
          <pre
            className="min-h-0 flex-1 select-text overflow-y-auto bg-muted/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground sm:text-[12px]"
            aria-label="Delete handoff prompt (not editable)"
          >
            {readOnlyBody}
          </pre>
          {hoverChrome}
        </div>
        {speechFooter}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 basis-0 flex-col px-2 pb-3 pt-1 sm:px-4 sm:pb-4 sm:pt-1.5">
      <div className="group/prompt flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-muted/15 shadow-inner">
        {lockedHeader ? (
          <pre
            className="max-h-[min(32vh,14rem)] shrink-0 select-text overflow-y-auto border-b border-border/60 bg-muted/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground sm:text-[12px]"
            aria-label="Locked handoff template (not editable)"
          >
            {lockedHeader}
          </pre>
        ) : null}
        <div className="relative flex min-h-0 flex-1 basis-0 flex-col">
          <HandoffMarkdownEditor
            key={editorKey}
            ref={editorRef}
            initialDoc={draft}
            onChange={onDraftChange}
            ariaLabel={ariaLabel}
            autoFocus={Boolean(lockedHeader)}
          />
          {hoverChrome}
        </div>
      </div>
      {speechFooter}
    </div>
  );
}


function insertTranscriptAtEditor(api: HandoffEditorHandle | null, transcript: string) {
  api?.insertAtCaret(transcript);
}

type StripCopyKey = "pageUrl" | "cid" | "label";

function CopyableContextField({
  value,
  copyKey,
  activeKey,
  onCopy,
}: {
  value: string;
  copyKey: StripCopyKey;
  activeKey: StripCopyKey | null;
  onCopy: (key: StripCopyKey, text: string) => void;
}) {
  const text = value || "—";
  const empty = !value.trim();
  const justCopied = activeKey === copyKey;

  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        disabled={empty}
        title={empty ? "Nothing to copy" : "Copy to clipboard"}
        aria-label={empty ? "Empty value" : "Copy to clipboard"}
        onClick={() => {
          if (!empty) onCopy(copyKey, value);
        }}
        className={cn(
          "group flex w-full min-w-0 items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left",
          "border-border/60 bg-muted/35 text-foreground transition-colors hover:bg-muted/55",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1",
          justCopied && "border-emerald-500/40 bg-emerald-500/10",
          empty && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className="min-w-0 truncate font-mono text-[11px] leading-snug"
        >
          {text}
        </span>
        {justCopied ? <Check className="size-3 shrink-0 text-emerald-400" aria-hidden /> : null}
        {justCopied ? (
          <span className="sr-only">Copied to clipboard</span>
        ) : null}
      </button>
    </div>
  );
}

function PromptContextStrip({ pageUrl, cid, label }: { pageUrl: string; cid: string; label: string }) {
  const [copiedKey, setCopiedKey] = useState<StripCopyKey | null>(null);
  const clearTimer = useRef<number | null>(null);

  const flashCopied = useCallback((key: StripCopyKey) => {
    if (clearTimer.current != null) window.clearTimeout(clearTimer.current);
    setCopiedKey(key);
    clearTimer.current = window.setTimeout(() => {
      setCopiedKey(null);
      clearTimer.current = null;
    }, 1600);
  }, []);

  const copyStripValue = useCallback(
    (key: StripCopyKey, text: string) => {
      navigator.clipboard?.writeText(text).catch(() => {});
      flashCopied(key);
    },
    [flashCopied],
  );

  useEffect(() => {
    return () => {
      if (clearTimer.current != null) window.clearTimeout(clearTimer.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "grid shrink-0 grid-cols-3 gap-2 overflow-hidden border-b border-border/50 bg-muted/20 px-3 py-2",
      )}
    >
      <CopyableContextField
        value={pageUrl}
        copyKey="pageUrl"
        activeKey={copiedKey}
        onCopy={copyStripValue}
      />
      <CopyableContextField
        value={cid}
        copyKey="cid"
        activeKey={copiedKey}
        onCopy={copyStripValue}
      />
      <CopyableContextField
        value={label}
        copyKey="label"
        activeKey={copiedKey}
        onCopy={copyStripValue}
      />
    </div>
  );
}

function HoverPromptChrome({
  listening,
  interim,
  speechOk,
  showDictation = true,
  onStartDictation,
  onStopDictation,
  onCopy,
  copied,
  copyDisabled,
}: {
  listening: boolean;
  interim: string;
  speechOk: boolean;
  /** When false, only Copy is shown (frozen delete prompt). */
  showDictation?: boolean;
  onStartDictation: () => void;
  onStopDictation: () => void;
  onCopy: () => void;
  copied: boolean;
  copyDisabled: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-stretch justify-end",
        "bg-transparent pb-2 pt-6 pl-3 pr-3",
        "opacity-0 transition-opacity duration-200",
        "group-hover/prompt:pointer-events-auto group-hover/prompt:opacity-100",
      )}
    >
      {showDictation && listening && interim ? (
        <p className="pointer-events-none mb-2 max-h-16 overflow-y-auto rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
          <span className="font-semibold text-emerald-300">Live · </span>
          {interim}
        </p>
      ) : null}
      <div className="pointer-events-auto flex flex-row items-center justify-end gap-3">
        {showDictation ? (
          !listening ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onStartDictation();
              }}
              disabled={!speechOk}
              title={
                speechOk
                  ? "Speech inserts at the caret in the editable editor (below the fixed header on Upd)."
                  : "Speech recognition not available"
              }
              className={cn(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600/80",
                "bg-gradient-to-br from-emerald-500 to-teal-700 text-white",
                "transition-transform hover:scale-105 active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                !speechOk && "cursor-not-allowed opacity-40",
              )}
              aria-label="Start dictation at cursor"
            >
              <Mic className="size-4" strokeWidth={2} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onStopDictation();
              }}
              title="Stop dictation"
              className={cn(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-red-500/80",
                "bg-gradient-to-br from-red-600 to-rose-800 text-white",
                "ring-2 ring-red-400/50",
                "animate-[pulse_1.1s_ease-in-out_infinite]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2",
              )}
              aria-label="Stop dictation"
              aria-pressed="true"
            >
              <MicOff className="size-4" strokeWidth={2} aria-hidden />
            </button>
          )
        ) : null}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={copyDisabled}
          className="h-9 gap-1.5 px-3 text-xs font-semibold"
          onClick={(e) => {
            e.preventDefault();
            onCopy();
          }}
        >
          {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          Copy
        </Button>
      </div>
    </div>
  );
}

export function DevIdAgentPromptDialog({
  open,
  onOpenChange,
  entry,
  pathname,
  /** Component kind: SiteSection band vs in-section Identified row. */
  componentTag = "Identified",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: RegistryEntry | null;
  pathname: string;
  componentTag?: HandoffComponentTag;
}) {
  const [tab, setTab] = useState<"update" | "delete">("update");
  const [updateLockedPrefix, setUpdateLockedPrefix] = useState("");
  const [updateUserDraft, setUpdateUserDraft] = useState("");
  const [deleteLockedText, setDeleteLockedText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);
  const recRef = useRef<SpeechRecInstance | null>(null);
  const updateEditorRef = useRef<HandoffEditorHandle | null>(null);
  /** Satisfies `HandoffPromptPane` when delete tab uses `readOnlyBody` only (editor not mounted). */
  const deleteEditorRef = useRef<HandoffEditorHandle | null>(null);
  const tabRef = useRef<"update" | "delete">(tab);
  const [copied, setCopied] = useState<"update" | "delete" | null>(null);
  const [handoffEpoch, setHandoffEpoch] = useState(0);
  const [updateTemplate, setUpdateTemplate] = useState(DEFAULT_UPDATE_TEMPLATE);
  const [deleteTemplate, setDeleteTemplate] = useState(DEFAULT_DELETE_TEMPLATE);
  const [promptVerbosity, setPromptVerbosity] = useState<PromptVerbosity>("full");
  const [activeEntry, setActiveEntry] = useState<RegistryEntry | null>(entry);
  const modalScanRef = useRef<HTMLDivElement | null>(null);

  const label = activeEntry?.label ?? "";
  const cid = activeEntry?.cid ?? "";
  const pageUrl = useMemo(() => absolutePageUrl(pathname), [pathname]);

  tabRef.current = tab;

  useEffect(() => {
    let alive = true;
    async function loadTemplates() {
      try {
        const [u, d] = await Promise.all([
          fetch("/devid-prompts/update.md").then((r) => (r.ok ? r.text() : DEFAULT_UPDATE_TEMPLATE)),
          fetch("/devid-prompts/delete.md").then((r) => (r.ok ? r.text() : DEFAULT_DELETE_TEMPLATE)),
        ]);
        if (!alive) return;
        setUpdateTemplate(u || DEFAULT_UPDATE_TEMPLATE);
        setDeleteTemplate(d || DEFAULT_DELETE_TEMPLATE);
      } catch {
        if (!alive) return;
        setUpdateTemplate(DEFAULT_UPDATE_TEMPLATE);
        setDeleteTemplate(DEFAULT_DELETE_TEMPLATE);
      }
    }
    loadTemplates();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("devid.prompt.verbosity");
    if (raw === "compact" || raw === "full") setPromptVerbosity(raw);
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveEntry(entry);
    setUpdateUserDraft("");
    setInterim("");
    setTab("update");
    setCopied(null);
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
      recRef.current = null;
    }
    setListening(false);
    setHandoffEpoch((e) => e + 1);
  }, [open, entry]);

  useEffect(() => {
    if (!open || !activeEntry) return;
    const resolvedComponentTag = activeEntry.componentTag ?? componentTag;
    const updateTemplateForMode = promptVerbosity === "full" ? updateTemplate : undefined;
    const deleteTemplateForMode = promptVerbosity === "full" ? deleteTemplate : undefined;
    setUpdateLockedPrefix(
      buildUpdateLockedPrefix(
        pageUrl,
        label,
        cid,
        resolvedComponentTag,
        activeEntry.searchHint,
        updateTemplateForMode,
        promptVerbosity,
      ),
    );
    setDeleteLockedText(
      buildDeletePrompt(
        pageUrl,
        label,
        cid,
        resolvedComponentTag,
        activeEntry.searchHint,
        deleteTemplateForMode,
        promptVerbosity,
      ),
    );
  }, [open, activeEntry, pageUrl, label, cid, componentTag, updateTemplate, deleteTemplate, promptVerbosity]);

  useEffect(() => {
    return () => {
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          /* noop */
        }
        recRef.current = null;
      }
    };
  }, []);

  const stopRecognition = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
      recRef.current = null;
    }
    setListening(false);
    setInterim("");
  }, []);

  const startRecognition = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setSpeechOk(false);
      return;
    }
    setSpeechOk(true);
    stopRecognition();
    const r = new SR();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event) => {
      let piece = "";
      let hasFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        piece += res[0]?.transcript ?? "";
        if (res.isFinal) hasFinal = true;
      }
      if (hasFinal && piece.trim()) {
        const t = tabRef.current;
        const el = t === "update" ? updateEditorRef.current : null;
        insertTranscriptAtEditor(el, piece);
        setInterim("");
      } else {
        setInterim(piece);
      }
    };
    r.onerror = () => {
      setListening(false);
      setInterim("");
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
    };
    try {
      r.start();
      recRef.current = r;
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [stopRecognition]);

  const copyActive = () => {
    const text = tab === "update" ? `${updateLockedPrefix}\n${updateUserDraft}` : deleteLockedText;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(tab);
    window.setTimeout(() => setCopied(null), 1400);
  };

  if (!activeEntry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[200] bg-black/85"
        className={cn(
          "fixed z-[210] flex w-[calc(100vw-0.5rem)] max-w-none flex-col gap-0 overflow-hidden border bg-background p-0 shadow-xl",
          // Explicit height + floor: modal size stays stable; editor scrolls inside flex-1 slot.
          "h-[min(88dvh,calc(100dvh-1.5rem))] min-h-[28rem] max-h-[min(98dvh,calc(100dvh-0.5rem))]",
          "left-1/2 top-1 -translate-x-1/2 translate-y-0 rounded-lg",
          "sm:top-1/2 sm:h-[min(82vh,calc(100dvh-2rem))] sm:min-h-[32rem] sm:max-h-[min(96vh,100dvh)] sm:w-[min(98vw,72rem)] sm:-translate-y-1/2 sm:rounded-xl",
        )}
      >
        <div ref={modalScanRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Identified as="DevIdAgentPromptHeader" cid="devid-agent-prompt-header" register={false} depth={1}>
            <DialogHeader className="shrink-0 space-y-0.5 border-b border-border/60 px-4 py-3 text-left">
              <DialogTitle className="text-base font-semibold tracking-tight">Agent handoff</DialogTitle>
            </DialogHeader>
          </Identified>

          <Identified as="DevIdAgentPromptContextStrip" cid="devid-agent-prompt-context-strip" register={false} depth={1}>
            <PromptContextStrip pageUrl={pageUrl} cid={cid} label={label} />
          </Identified>

          <Tabs
            value={tab}
            onValueChange={(v) => {
              stopRecognition();
              setTab(v as "update" | "delete");
            }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="shrink-0 px-3 pt-1 sm:px-4">
              <TabsList className="inline-flex h-6 w-fit gap-px rounded border border-border/40 bg-muted/30 p-px">
              <TabsTrigger
                value="update"
                title="Update prompt"
                aria-label="Update handoff prompt"
                className="flex h-[1.375rem] items-center gap-0.5 rounded-sm px-1.5 py-0 text-[9px] font-semibold leading-none data-[state=active]:bg-background data-[state=active]:shadow-sm [&_svg]:shrink-0"
              >
                <FilePenLine className="size-2.5" strokeWidth={2} aria-hidden />
                <span aria-hidden>Upd</span>
              </TabsTrigger>
              <TabsTrigger
                value="delete"
                title="Delete prompt"
                aria-label="Delete handoff prompt"
                className="flex h-[1.375rem] items-center gap-0.5 rounded-sm px-1.5 py-0 text-[9px] font-semibold leading-none data-[state=active]:bg-background data-[state=active]:shadow-sm [&_svg]:shrink-0"
              >
                <FileX2 className="size-2.5" strokeWidth={2} aria-hidden />
                <span aria-hidden>Del</span>
              </TabsTrigger>
            </TabsList>
          </div>

            <Identified as="DevIdAgentPromptTabsBody" cid="devid-agent-prompt-tabs-body" register={false} depth={1} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <TabsContent
                value="update"
                className="mt-0 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden data-[state=inactive]:hidden"
              >
                <HandoffPromptPane
                  draft={updateUserDraft}
                  onDraftChange={setUpdateUserDraft}
                  editorRef={updateEditorRef}
                  editorKey={`${handoffEpoch}-update`}
                  lockedHeader={updateLockedPrefix}
                  ariaLabel="Your instructions for the agent (editable)"
                  hoverChrome={
                    <HoverPromptChrome
                      listening={listening}
                      interim={interim}
                      speechOk={speechOk}
                      onStartDictation={startRecognition}
                      onStopDictation={stopRecognition}
                      onCopy={copyActive}
                      copied={copied === "update"}
                      copyDisabled={false}
                    />
                  }
                  speechFooter={
                    !speechOk ? (
                      <p className="mt-2 text-xs text-amber-500">Speech recognition is not supported in this browser.</p>
                    ) : null
                  }
                />
              </TabsContent>

              <TabsContent
                value="delete"
                className="mt-0 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden data-[state=inactive]:hidden"
              >
                <HandoffPromptPane
                  draft=""
                  onDraftChange={() => {}}
                  editorRef={deleteEditorRef}
                  editorKey={`${handoffEpoch}-delete`}
                  readOnlyBody={deleteLockedText}
                  ariaLabel="Delete handoff prompt (read-only)"
                  hoverChrome={
                    <HoverPromptChrome
                      listening={listening}
                      interim={interim}
                      speechOk={speechOk}
                      showDictation={false}
                      onStartDictation={startRecognition}
                      onStopDictation={stopRecognition}
                      onCopy={copyActive}
                      copied={copied === "delete"}
                      copyDisabled={!deleteLockedText.trim()}
                    />
                  }
                />
              </TabsContent>
            </Identified>
          </Tabs>
          <DevIdModalContextFooter
            open={open}
            scanRootRef={modalScanRef}
            promptVerbosity={promptVerbosity}
            onPromptVerbosityChange={setPromptVerbosity}
            onActiveEntryChange={(next) => {
              if (next) setActiveEntry(next);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}



