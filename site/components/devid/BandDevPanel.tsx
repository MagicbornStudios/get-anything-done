"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  MessageSquare,
  Mic,
  MicOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { buildDeletePrompt, buildUpdateLockedPrefix, DevIdAgentPromptDialog } from "./DevIdAgentPromptDialog";
import type { RegistryEntry } from "./SectionRegistry";
import { absolutePageUrl } from "./absolutePageUrl";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function collectScopedEntries(scope: HTMLElement | null): RegistryEntry[] {
  if (!scope) return [];
  const nodes = Array.from(scope.querySelectorAll<HTMLElement>("[data-cid]"));
  const withDepth = nodes.map((node) => {
    let depth = 0;
    let current: HTMLElement | null = node.parentElement;
    while (current) {
      if (scope.contains(current) && current.hasAttribute("data-cid")) depth += 1;
      if (current === scope) break;
      current = current.parentElement;
    }
    const cid = node.getAttribute("data-cid") ?? "";
    const label = node.getAttribute("data-cid-label") ?? cid;
    return { cid, label, depth };
  });
  const minDepth = withDepth.length > 0 ? Math.min(...withDepth.map((e) => e.depth)) : 0;
  const dedup = new Map<string, RegistryEntry>();
  for (const entry of withDepth) {
    if (!entry.cid || dedup.has(entry.cid)) continue;
    dedup.set(entry.cid, { ...entry, depth: Math.max(0, entry.depth - minDepth) });
  }
  return Array.from(dedup.values());
}

export function BandDevPanel({
  cid,
  label,
  edge = "top",
}: {
  cid: string;
  label: string;
  edge?: "top" | "bottom";
}) {
  const pathname = usePathname() ?? "";
  const [promptEntry, setPromptEntry] = useState<RegistryEntry | null>(null);
  const [copied, setCopied] = useState<"update" | "delete" | "cid" | null>(null);
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [depthIndex, setDepthIndex] = useState(0);
  const [activeCid, setActiveCid] = useState<string>(cid);

  useEffect(() => {
    const scope = document.querySelector(`[data-cid="${cid}"]`)?.parentElement as HTMLElement | null;
    setEntries(collectScopedEntries(scope));
  }, [cid, pathname]);

  const depths = useMemo(() => Array.from(new Set(entries.map((e) => e.depth))).sort((a, b) => a - b), [entries]);
  const currentDepth = depths[depthIndex] ?? 0;
  const visibleEntries = entries.filter((e) => e.depth === currentDepth);
  const activeEntry = entries.find((e) => e.cid === activeCid) ?? { cid, label, depth: 0 };

  useEffect(() => {
    if (depthIndex >= depths.length) setDepthIndex(0);
  }, [depthIndex, depths.length]);

  const finalizeUpdatePromptCopy = (transcript: string) => {
    const prefix = buildUpdateLockedPrefix(
      absolutePageUrl(pathname),
      activeEntry.label,
      activeEntry.cid,
      "Identified",
    );
    const resolved = `${prefix}\n${transcript.trim()}`;
    navigator.clipboard?.writeText(resolved).catch(() => {});
    setCopied("update");
    window.setTimeout(() => setCopied(null), 1200);
    toast.success("Update prompt copied");
  };

  const { listening, interim, toggle: toggleUpdate } = useDictatedPromptCopy({
    onFinalize: finalizeUpdatePromptCopy,
  });

  const copyDelete = () => {
    const resolved = buildDeletePrompt(
      absolutePageUrl(pathname),
      activeEntry.label,
      activeEntry.cid,
      "Identified",
    );
    navigator.clipboard?.writeText(resolved).catch(() => {});
    setCopied("delete");
    window.setTimeout(() => setCopied(null), 1200);
    toast.success("Delete prompt copied");
  };

  const copyCid = () => {
    navigator.clipboard?.writeText(activeEntry.cid).catch(() => {});
    setCopied("cid");
    window.setTimeout(() => setCopied(null), 900);
  };

  return (
    <>
      <DevIdAgentPromptDialog
        open={promptEntry != null}
        onOpenChange={(v) => !v && setPromptEntry(null)}
        entry={promptEntry}
        pathname={pathname}
      />

      <div
        className={[
          "pointer-events-none absolute right-2 z-40 opacity-0 transition-opacity duration-200",
          edge === "top" ? "top-2" : "bottom-2",
          "group-hover/site-band:pointer-events-auto group-hover/site-band:opacity-100",
          "group-focus-within/site-band:pointer-events-auto group-focus-within/site-band:opacity-100",
        ].join(" ")}
      >
        <div className="pointer-events-auto w-72 rounded-md border border-accent/40 bg-background/95 px-2 py-1 shadow-lg backdrop-blur">
          <div className="flex items-center gap-1.5 text-[10px]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleUpdate}
              className="h-6 gap-1 px-1.5 text-[10px]"
              title={listening ? "Stop dictation and copy" : "Dictate update prompt"}
            >
              {copied === "update" ? <Check size={11} /> : listening ? <MicOff size={11} /> : <Mic size={11} />}
              Update
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyDelete}
              className="h-6 gap-1 px-1.5 text-[10px]"
              title="Copy delete prompt"
            >
              {copied === "delete" ? <Check size={11} /> : <Trash2 size={11} />}
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPromptEntry(activeEntry)}
              className="size-6"
              title="Open handoff modal"
            >
              <MessageSquare size={11} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyCid}
              className="size-6"
              title="Copy id"
            >
              {copied === "cid" ? <Check size={11} /> : <Copy size={11} />}
            </Button>
          </div>

          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="truncate font-mono" title={activeEntry.cid}>
              {activeEntry.cid}
            </span>
            <div className="ml-2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5"
                disabled={depthIndex <= 0}
                onClick={() => setDepthIndex((v) => Math.max(0, v - 1))}
                title="Previous depth"
              >
                <ChevronLeft size={10} />
              </Button>
              <span className="w-16 text-center">
                d{currentDepth} · {visibleEntries.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5"
                disabled={depthIndex >= depths.length - 1}
                onClick={() => setDepthIndex((v) => Math.min(depths.length - 1, v + 1))}
                title="Next depth"
              >
                <ChevronRight size={10} />
              </Button>
            </div>
          </div>

          <div className="mt-1 max-h-24 space-y-1 overflow-auto pr-1">
            {visibleEntries.map((entry) => (
              <button
                key={entry.cid}
                type="button"
                onClick={() => setActiveCid(entry.cid)}
                className={cn(
                  "w-full truncate rounded border px-1.5 py-1 text-left text-[10px] font-mono",
                  activeEntry.cid === entry.cid
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground",
                )}
                title={`${entry.label} (${entry.cid})`}
              >
                {entry.cid}
              </button>
            ))}
          </div>

          {listening && interim ? (
            <p className="mt-1 max-w-56 truncate text-[10px] text-emerald-300">
              <span className="font-semibold">Live · </span>
              {interim}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
