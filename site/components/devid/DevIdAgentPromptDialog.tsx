"use client";

/**
 * Handoff dialog for coding agents: Update and Delete — one large editable prompt
 * per tab. Dictate inserts at the textarea caret; Dictate + Copy sit on one row
 * at the bottom of the editor and appear on hover of the prompt surface.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Copy, Check } from "lucide-react";
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

function buildUpdatePrompt(pathname: string, label: string, cid: string, request: string) {
  const req = request.trim() || "(Describe the change you want.)";
  return `You are editing the GAD marketing site (Next.js) in the monorepo.

Code root: ${SITE_ROOT}

## Target block
- **App URL:** \`${pathname}\`
- **data-cid:** \`${cid}\`
- **Identified \`as\` prop:** \`${label}\`

## Request
${req}

## How to find it
Search under \`${SITE_ROOT}/\` for \`<Identified as="${label}"\` or for \`data-cid="${cid}"\`.

## Conventions
- Section dev IDs must register **inside** \`<SiteSection>\` (under \`SectionRegistryProvider\`), not from the parent page wrapping the section component.
- Match existing patterns in neighboring sections; keep shadcn-style primitives in \`components/ui/\`.

Implement the change, run \`pnpm exec tsc --noEmit\` from \`${SITE_ROOT}\`, then commit with a clear message.`;
}

function buildDeletePrompt(pathname: string, label: string, cid: string) {
  return `Remove the UI block for this dev ID from the GAD marketing site.

Code root: ${SITE_ROOT}

## Target
- **App URL:** \`${pathname}\`
- **data-cid:** \`${cid}\`
- **Identified \`as\` prop:** \`${label}\`

## What to do
1. Search \`${SITE_ROOT}/\` for \`<Identified as="${label}"\` and remove that band (wrapper + content the product owner wants gone), or remove the owning section from the page if the whole section should go.
2. Remove any now-unused imports or components.
3. Run \`pnpm exec tsc --noEmit\` from \`${SITE_ROOT}\` and fix issues.
4. Commit with a message that names the removed block (\`${label}\`).`;
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

function insertTranscriptAtCaret(
  textarea: HTMLTextAreaElement | null,
  transcript: string,
  setText: (fn: (prev: string) => string) => void,
) {
  if (!textarea || !transcript.trim()) return;
  const chunk = transcript.trim() + (transcript.trim().endsWith(" ") ? "" : " ");
  setText((prev) => {
    const start = textarea.selectionStart ?? prev.length;
    const end = textarea.selectionEnd ?? prev.length;
    const before = prev.slice(0, start);
    const after = prev.slice(end);
    const next = before + chunk + after;
    const caret = start + chunk.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
    return next;
  });
}

function PromptContextStrip({
  pathname,
  cid,
  label,
}: {
  pathname: string;
  cid: string;
  label: string;
}) {
  return (
    <div className="grid gap-2 border-b border-border/60 bg-muted/20 px-4 py-2.5 sm:grid-cols-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">App route</p>
        <p className="mt-1 break-all font-mono text-[11px] text-foreground">{pathname || "—"}</p>
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
        "bg-gradient-to-t from-background via-background/98 to-transparent pb-2 pt-14 pl-3 pr-3",
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
            title={speechOk ? "Dictate at cursor — place caret in the prompt first" : "Speech recognition not available"}
            className={cn(
              "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600/80",
              "bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-900/40",
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
              "bg-gradient-to-br from-red-600 to-rose-800 text-white shadow-md",
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
          className="h-9 gap-1.5 px-3 text-xs font-semibold shadow-sm"
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
  const updateEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const deleteEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const tabRef = useRef<"update" | "delete">(tab);
  const [copied, setCopied] = useState<"update" | "delete" | null>(null);

  const label = entry?.label ?? "";
  const cid = entry?.cid ?? "";

  tabRef.current = tab;

  useEffect(() => {
    if (!open || !entry) return;
    setUpdateDraft(buildUpdatePrompt(pathname, label, cid, "(Describe the change you want.)"));
    setDeleteDraft(buildDeletePrompt(pathname, label, cid));
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
  }, [open, entry, pathname, label, cid]);

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
        const setDraft = t === "update" ? setUpdateDraft : setDeleteDraft;
        insertTranscriptAtCaret(el, piece, setDraft);
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
          "fixed z-[210] flex max-h-[88vh] w-[min(96vw,38rem)] max-w-none flex-col gap-0 overflow-hidden p-0",
          "translate-x-[-50%] translate-y-[-50%] sm:rounded-lg",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0.5 border-b border-border/60 px-4 py-3 text-left">
          <DialogTitle className="text-base font-semibold tracking-tight">Agent handoff</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Hover the prompt for <strong className="text-foreground">Dictate</strong> + <strong className="text-foreground">Copy</strong>.
          </DialogDescription>
        </DialogHeader>

        <PromptContextStrip pathname={pathname} cid={cid} label={label} />

        <Tabs
          value={tab}
          onValueChange={(v) => {
            stopRecognition();
            setTab(v as "update" | "delete");
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 px-4 pt-2">
            <TabsList className="grid h-8 w-full max-w-xs grid-cols-2">
              <TabsTrigger value="update">Update</TabsTrigger>
              <TabsTrigger value="delete">Delete</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="update" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
              <p className="mb-1.5 text-[10px] text-muted-foreground">Edit the full prompt; hover the box for dictation + copy.</p>
              <div className="group/prompt relative min-h-0 flex-1 rounded-md border border-border/70 bg-muted/15 shadow-inner">
                <textarea
                  ref={updateEditorRef}
                  value={updateDraft}
                  onChange={(e) => setUpdateDraft(e.target.value)}
                  spellCheck
                  className={cn(
                    "box-border min-h-[min(42vh,16rem)] w-full flex-1 resize-y rounded-md bg-transparent px-3 py-3",
                    "font-mono text-[12px] leading-relaxed text-foreground",
                    "placeholder:text-muted-foreground/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                  )}
                  aria-label="Full update prompt for your agent"
                />
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
              </div>
              {!speechOk && (
                <p className="mt-2 text-xs text-amber-500">Speech recognition is not supported in this browser.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="delete" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
              <p className="mb-1.5 text-[10px] text-muted-foreground">Delete instruction; hover the box for dictation + copy.</p>
              <div className="group/prompt relative min-h-0 flex-1 rounded-md border border-border/70 bg-muted/15 shadow-inner">
                <textarea
                  ref={deleteEditorRef}
                  value={deleteDraft}
                  onChange={(e) => setDeleteDraft(e.target.value)}
                  spellCheck
                  className={cn(
                    "box-border min-h-[min(42vh,16rem)] w-full flex-1 resize-y rounded-md bg-transparent px-3 py-3",
                    "font-mono text-[12px] leading-relaxed text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                  )}
                  aria-label="Full delete prompt for your agent"
                />
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
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
