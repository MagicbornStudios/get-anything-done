"use client";

import { useEffect, useState } from "react";
import { EVAL_RUNS } from "@/lib/eval-data";

/**
 * Task 44-09: live project-market data sync in dev.
 *
 * Renders only when `process.env.NODE_ENV === "development"` (Next.js
 * inlines this at build time, so the banner is tree-shaken in
 * production). Polls /api/dev/projects/scan on mount + every 30s,
 * compares the live generation list against compile-time EVAL_RUNS,
 * and surfaces any drift with a one-click refresh that re-runs
 * scripts/build-site-data.mjs via /api/dev/projects/refresh.
 *
 * Conscious non-goals: does not auto-reload the page on refresh
 * completion (operator may have unsaved filter state); does not show
 * deletions (rare and not the staleness pattern this fixes).
 */

interface ScannedGeneration {
  id: string;
  project: string;
  species: string;
  version: string;
  status: string;
  hasBuild: boolean;
}

interface ScanResponse {
  generations: ScannedGeneration[];
  generatedAt: string;
}

const POLL_MS = 30_000;

export function DevCatalogBanner() {
  const [missing, setMissing] = useState<ScannedGeneration[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const knownIds = new Set(EVAL_RUNS.map((r) => r.id));
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/dev/projects/scan", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ScanResponse;
        if (cancelled) return;
        const drift = data.generations.filter((g) => !knownIds.has(g.id));
        setMissing(drift);
      } catch {
        // Silent fail — dev-only convenience, never block UI on it
      }
    };

    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (process.env.NODE_ENV !== "development") return null;
  if (missing.length === 0) return null;

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/projects/refresh", { method: "POST" });
      if (!res.ok || !res.body) {
        throw new Error(`refresh failed (${res.status})`);
      }
      // SSE stream — just drain it; build-site-data.mjs prints heaps of
      // progress lines and we're not surfacing them in the banner. The
      // stream closes on child exit which is our success signal.
      const reader = res.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      setLastRefresh(new Date().toISOString());
      // Hard reload — eval-data.generated.ts is a static import, only a
      // full page load picks up the new bundle.
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-100">
            dev
          </span>
          <span>
            Catalog stale: {missing.length} generation
            {missing.length === 1 ? "" : "s"} on disk not in compile-time
            bundle
            {missing.length <= 3 ? (
              <span className="ml-1 text-amber-200/60">
                ({missing.map((g) => g.id).join(", ")})
              </span>
            ) : null}
            .
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error ? (
            <span className="text-rose-300">{error}</span>
          ) : null}
          {lastRefresh ? (
            <span className="text-amber-200/50">
              last refresh {new Date(lastRefresh).toLocaleTimeString()}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded border border-amber-400/50 px-2 py-0.5 font-mono text-[11px] text-amber-100 transition-colors hover:bg-amber-500/15 disabled:cursor-wait disabled:opacity-60"
          >
            {refreshing ? "refreshing…" : "refresh catalog"}
          </button>
        </div>
      </div>
    </div>
  );
}
