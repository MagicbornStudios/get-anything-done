"use client";

/**
 * Handoff dialog for coding agents: Update and Delete — one large editable prompt
 * per tab. **CodeMirror 6** markdown mode with syntax highlighting, line numbers, and
 * wrapping; dictate/copy hover chrome on the editor surface.
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
import type { RegistryEntry } from "./SectionRegistry";

const SITE_ROOT = "vendor/get-anything-done/site";

/** Must match the `## …` line in `buildUpdatePrompt` (no newline). */
const HANDOFF_MAKE_CHANGES_HEADING = "## Make these changes";

function absolutePageUrl(pathname: string): string {
  if (typeof window === "undefined") return pathname || "/";
  const path = pathname.startsWith("/") ? pathname : `/${pathname || ""}`;
  return `${window.location.origin}${path}`;
}

function HandoffPromptPane({
  draft,
  onDraftChange,
  editorRef,
  editorKey,
  variant,
  focusEmptyLineUnderHeading,
  hoverChrome,
  speechFooter,
  ariaLabel,
}: {
  draft: string;
  onDraftChange: (next: string) => void;
  editorRef: RefObject<HandoffEditorHandle | null>;
  editorKey: string;
  variant: "update" | "delete";
  focusEmptyLineUnderHeading?: string;
  hoverChrome: ReactNode;
  speechFooter?: ReactNode;
  ariaLabel: string;
}) {
  const hint =
    variant === "update" ? (
      <>
        Caret opens on the empty line under <strong className="text-foreground/90">Make these changes</strong>.{" "}
        <strong className="text-foreground/90">Hover the bottom edge</strong> for Mic + Copy.
      </>
    ) : (
      <>
        Edit the prompt if you need to. <strong className="text-foreground/90">Hover the bottom edge</strong> of the
        editor for Mic + Copy.
      </>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-3 pt-1 sm:px-4 sm:pb-4 sm:pt-1.5">
      <p className="mb-1.5 max-w-[min(100%,40rem)] text-[10px] leading-snug text-muted-foreground sm:mb-2">{hint}</p>

      <div className="group/prompt relative flex min-h-0 flex-1 flex-col rounded-md border border-border/70 bg-muted/15 shadow-inner">
        <HandoffMarkdownEditor
          key={editorKey}
          ref={editorRef}
          initialDoc={draft}
          onChange={onDraftChange}
          ariaLabel={ariaLabel}
          focusEmptyLineUnderHeading={focusEmptyLineUnderHeading}
        />
        {hoverChrome}
      </div>
      {speechFooter}
    </div>
  );
}

function buildUpdatePrompt(pageUrl: string, label: string, cid: string) {
  return `GAD marketing site (Next.js).

## This page
${pageUrl}

## Block
- \`data-cid\`: \`${cid}\`
- \`<Identified as="${label}" />\`

${HANDOFF_MAKE_CHANGES_HEADING}

Find in repo \`${SITE_ROOT}/\`: search \`as="${label}"\` or \`data-cid="${cid}"\`.

Keep \`<Identified>\` inside \`<SiteSection>\`; match nearby sections; primitives in \`components/ui/\`.

\`pnpm exec tsc --noEmit\` in that folder, then commit.`;
}

function buildDeletePrompt(pageUrl: string, label: string, cid: string) {
  return `GAD marketing site (Next.js).

## This page
${pageUrl}

## Block
- \`data-cid\`: \`${cid}\`
- \`<Identified as="${label}" />\`

## Do this
1. Under \`${SITE_ROOT}/\`, find that \`Identified\` band and remove it (or remove the whole section if it should all go).
2. Drop unused imports/components.
3. \`pnpm exec tsc --noEmit\` in that folder, commit (message should name \`${label}\`).`;
}

type SpeechRecInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((
        ev: {
          resultIndex: number;
          results: { length: number; [i: number]: { isFinal: boolean; [0]: { transcript: string } } };
        },
      ) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechCtor = new () => SpeechRecInstance;

function getSpeechRecognition(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitSpeechRecognition?: SpeechCtor; SpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function insertTranscriptAtEditor(api: HandoffEditorHandle | null, transcript: string) {
  api?.insertAtCaret(transcript);
}

function PromptContextStrip({
  pageUrl,
  cid,
  label,
}: {
  pageUrl: string;
  cid: string;
  label: string;
}) {
  return (
    <div className="grid gap-2 border-b border-border/60 bg-muted/20 px-4 py-2.5 sm:grid-cols-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Page URL</p>
        <p className="mt-1 break-all font-mono text-[11px] text-foreground">{pageUrl || "—"}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">data-cid</p>
        <p className="mt-1 break-all font-mono text-[11px] text-accent">{cid}</p>
      </div>
      <div className="sm:col-span-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Identified as</p>
        <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      </div>
    </div>
  );
}

function HoverPromptChrome({
  listening,
  interim,
  speechOk,
  onStartDictation,
  onStopDictation,
  onCopy,
  copied,
  copyDisabled,
}: {
  listening: boolean;
  interim: string;
  speechOk: boolean;
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
      {listening && interim ? (
        <p className="pointer-events-none mb-2 max-h-16 overflow-y-auto rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
          <span className="font-semibold text-emerald-300">Live · </span>
          {interim}
        </p>
      ) : null}
      <div className="pointer-events-auto flex flex-row items-center justify-end gap-3">
        {!listening ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onStartDictation();
            }}
            disabled={!speechOk}
            title={
              speechOk
                ? "Speech inserts at the caret. Upd opens with the caret on the empty line under Make these changes."
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
        )}

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: RegistryEntry | null;
  pathname: string;
}) {
  const [tab, setTab] = useState<"update" | "delete">("update");
  const [updateDraft, setUpdateDraft] = useState("");
  const [deleteDraft, setDeleteDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);
  const recRef = useRef<SpeechRecInstance | null>(null);
  const updateEditorRef = useRef<HandoffEditorHandle | null>(null);
  const deleteEditorRef = useRef<HandoffEditorHandle | null>(null);
  const tabRef = useRef<"update" | "delete">(tab);
  const [copied, setCopied] = useState<"update" | "delete" | null>(null);
  const [handoffEpoch, setHandoffEpoch] = useState(0);

  const label = entry?.label ?? "";
  const cid = entry?.cid ?? "";
  const pageUrl = useMemo(() => absolutePageUrl(pathname), [pathname]);

  tabRef.current = tab;

  useEffect(() => {
    if (!open || !entry) return;
    setUpdateDraft(buildUpdatePrompt(pageUrl, label, cid));
    setDeleteDraft(buildDeletePrompt(pageUrl, label, cid));
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
  }, [open, entry, pageUrl, label, cid]);

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
        const el = t === "update" ? updateEditorRef.current : deleteEditorRef.current;
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
    const text = tab === "update" ? updateDraft : deleteDraft;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(tab);
    window.setTimeout(() => setCopied(null), 1400);
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[200] bg-black/85"
        className={cn(
          "fixed z-[210] flex w-[calc(100vw-0.5rem)] max-w-none flex-col gap-0 overflow-hidden border bg-background p-0 shadow-xl",
          // Mobile: near-edge sheet; desktop: wide editor surface
          "left-1/2 top-1 max-h-[min(98dvh,calc(100dvh-0.5rem))] -translate-x-1/2 translate-y-0 rounded-lg",
          "sm:top-1/2 sm:max-h-[min(96vh,100dvh)] sm:w-[min(98vw,72rem)] sm:-translate-y-1/2 sm:rounded-xl",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0.5 border-b border-border/60 px-4 py-3 text-left">
          <DialogTitle className="text-base font-semibold tracking-tight">Agent handoff</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            <strong className="text-foreground">Upd</strong> — copy for the agent; type on the empty line under{" "}
            <strong className="text-foreground">Make these changes</strong>. <strong className="text-foreground">Del</strong>{" "}
            — removal checklist. Mic + Copy:{" "}
            <strong className="text-foreground">hover the bottom</strong> of the editor.
          </DialogDescription>
        </DialogHeader>

        <PromptContextStrip pageUrl={pageUrl} cid={cid} label={label} />

        <Tabs
          value={tab}
          onValueChange={(v) => {
            stopRecognition();
            setTab(v as "update" | "delete");
          }}
          className="flex min-h-0 flex-1 flex-col"
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

          <TabsContent value="update" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <HandoffPromptPane
              draft={updateDraft}
              onDraftChange={setUpdateDraft}
              editorRef={updateEditorRef}
              editorKey={`${handoffEpoch}-update`}
              variant="update"
              focusEmptyLineUnderHeading={HANDOFF_MAKE_CHANGES_HEADING}
              ariaLabel="Update handoff prompt for your agent"
              hoverChrome={
                <HoverPromptChrome
                  listening={listening}
                  interim={interim}
                  speechOk={speechOk}
                  onStartDictation={startRecognition}
                  onStopDictation={stopRecognition}
                  onCopy={copyActive}
                  copied={copied === "update"}
                  copyDisabled={!updateDraft.trim()}
                />
              }
              speechFooter={
                !speechOk ? (
                  <p className="mt-2 text-xs text-amber-500">Speech recognition is not supported in this browser.</p>
                ) : null
              }
            />
          </TabsContent>

          <TabsContent value="delete" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <HandoffPromptPane
              draft={deleteDraft}
              onDraftChange={setDeleteDraft}
              editorRef={deleteEditorRef}
              editorKey={`${handoffEpoch}-delete`}
              variant="delete"
              ariaLabel="Delete handoff prompt for your agent"
              hoverChrome={
                <HoverPromptChrome
                  listening={listening}
                  interim={interim}
                  speechOk={speechOk}
                  onStartDictation={startRecognition}
                  onStopDictation={stopRecognition}
                  onCopy={copyActive}
                  copied={copied === "delete"}
                  copyDisabled={!deleteDraft.trim()}
                />
              }
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
