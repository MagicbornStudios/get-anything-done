"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Identified } from "./Identified";
import { DevIdModalContextFooter } from "./DevIdModalContextFooter";

type HitKind = "cid" | "as" | "stableCid" | "stableBandCid" | "id";

type SearchHit = {
  kind: HitKind;
  value: string;
  file: string;
  line: number;
  routePattern: string | null;
};

function resolveRoute(routePattern: string | null, currentPath: string): string | null {
  if (!routePattern) return null;
  if (!routePattern.includes("[")) return routePattern;
  if (routePattern.startsWith("/projects/") && currentPath.startsWith("/projects/")) return currentPath;
  if (routePattern.startsWith("/runs/") && currentPath.startsWith("/runs/")) return currentPath;
  return null;
}

export function DevIdSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const scanRootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dev/devid-search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const json = (await res.json()) as { hits?: SearchHit[] };
        setHits(Array.isArray(json.hits) ? json.hits : []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [open, query]);

  const grouped = useMemo(() => hits.slice(0, 80), [hits]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[42rem] w-[56rem] max-h-[42rem] max-w-[56rem] p-0">
        <div ref={scanRootRef} className="flex h-full min-h-0 flex-col overflow-hidden">
          <Identified as="DevIdSearchDialogHeader" cid="devid-search-dialog-header" register={false} depth={1}>
            <DialogHeader className="border-b border-border/60 px-4 py-3">
              <DialogTitle className="text-sm">Component ID search (dev)</DialogTitle>
              <DialogDescription className="text-xs">
                Search `cid` / `as` / `id`. Jump to route and auto-highlight target.
              </DialogDescription>
            </DialogHeader>
          </Identified>
          <Identified as="DevIdSearchDialogInput" cid="devid-search-dialog-input" register={false} depth={1}>
            <div className="border-b border-border/50 px-4 py-3">
              <label className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Search ids (e.g. "project-skills-scope")'
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/80"
                />
              </label>
            </div>
          </Identified>
          <Identified as="DevIdSearchDialogResults" cid="devid-search-dialog-results" register={false} depth={1} className="min-h-0 flex-1 overflow-auto px-2 py-2">
            {loading ? <p className="px-2 py-3 text-xs text-muted-foreground">Searching…</p> : null}
            {!loading && grouped.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">No hits.</p>
            ) : null}
            <ul className="space-y-1">
              {grouped.map((hit, idx) => {
                const route = resolveRoute(hit.routePattern, pathname);
                return (
                  <li
                    key={`${hit.file}:${hit.line}:${hit.kind}:${hit.value}:${idx}`}
                    className={cn(
                      "cursor-pointer rounded-md border border-border/50 bg-card/40 p-2 transition-colors",
                      "hover:border-border/80 hover:bg-card/60",
                      copiedValue === hit.value && "border-emerald-500/50 bg-emerald-500/10",
                    )}
                    onClick={() => {
                      navigator.clipboard?.writeText(hit.value).catch(() => {});
                      setCopiedValue(hit.value);
                      window.setTimeout(() => {
                        setCopiedValue((v) => (v === hit.value ? null : v));
                      }, 700);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11px] text-foreground">{hit.value}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {hit.kind} · {hit.file}:{hit.line}
                        </p>
                      </div>
                      {copiedValue === hit.value ? (
                        <span className="shrink-0 text-[10px] font-semibold text-emerald-400">Copied</span>
                      ) : null}
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          className="h-6 gap-1 px-2 text-[10px]"
                          disabled={!route}
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              localStorage.setItem("devIds", "1");
                              sessionStorage.setItem("devid.pending.highlight", hit.value);
                            } catch {}
                            if (route) router.push(route);
                            onOpenChange(false);
                          }}
                        >
                          <ExternalLink className="size-3" />
                          Go to component
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Identified>
          <DevIdModalContextFooter open={open} scanRootRef={scanRootRef} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
