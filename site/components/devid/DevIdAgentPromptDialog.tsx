"use client";

/**
 * Handoff dialog for coding agents: Update (dictation + template) and Delete (static template).
 * Copy targets Claude Code, Codex, Cursor, etc.
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
  onresult: ((ev: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; [0]: { transcript: string } } } }) => void) | null;
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
  const [requestNotes, setRequestNotes] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);
  const recRef = useRef<SpeechRecInstance | null>(null);
  const [copied, setCopied] = useState<"update" | "delete" | null>(null);

  const label = entry?.label ?? "";
  const cid = entry?.cid ?? "";

  useEffect(() => {
    if (!open) {
      setRequestNotes("");
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
    }
  }, [open]);

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
      if (hasFinal) {
        setRequestNotes((prev) => (prev ? `${prev.trim()} ${piece.trim()}` : piece.trim()));
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

  const updateText = buildUpdatePrompt(pathname, label, cid, requestNotes);
  const deleteText = buildDeletePrompt(pathname, label, cid);

  const copy = (which: "update" | "delete") => {
    const text = which === "update" ? updateText : deleteText;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1200);
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agent handoff · {label}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {pathname} · <span className="text-accent">{cid}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "update" | "delete")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="update">Update</TabsTrigger>
            <TabsTrigger value="delete">Delete</TabsTrigger>
          </TabsList>

          <TabsContent value="update" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Dictate or type what should change. The prompt below includes route, dev id, and your
              notes—copy it into your coding agent.
            </p>
            <div className="flex flex-wrap gap-2">
              {!listening ? (
                <Button
                  type="button"
                  size="sm"
                  variant={speechOk ? "secondary" : "outline"}
                  className="gap-1.5"
                  onClick={startRecognition}
                >
                  <Mic size={14} aria-hidden />
                  Dictate
                </Button>
              ) : (
                <Button type="button" size="sm" variant="destructive" className="gap-1.5" onClick={stopRecognition}>
                  <MicOff size={14} aria-hidden />
                  Stop
                </Button>
              )}
              {!speechOk && (
                <span className="text-xs text-amber-500">Speech recognition not supported in this browser.</span>
              )}
            </div>
            {(listening || interim) && (
              <p className="rounded-md border border-border/60 bg-card/40 px-2 py-1.5 text-xs text-muted-foreground">
                {listening ? <span className="text-accent">Listening… </span> : null}
                {interim || "…"}
              </p>
            )}
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your notes (typed or from dictation)
            </label>
            <textarea
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              rows={4}
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
              placeholder="Example: tighten the subhead copy; add a second CTA; reduce vertical padding…"
            />
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Full prompt
                </span>
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => copy("update")}>
                  {copied === "update" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  Copy
                </Button>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground">
                {updateText}
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="delete" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Static prompt to remove this <code className="rounded bg-card/60 px-1">Identified</code> band. Copy and
              paste into your agent.
            </p>
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => copy("delete")}>
                {copied === "delete" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                Copy delete prompt
              </Button>
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground">
              {deleteText}
            </pre>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
