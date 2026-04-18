/**
 * Task 44-44: species detail page.
 *
 * Lists every published generation for a single species across every project,
 * sourced from MARKETPLACE_INDEX (built by scripts/build-site-data.mjs at
 * predev / prebuild time). Linked from ProjectMarketSpeciesBand chips on
 * /project-market.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/site";
import { MARKETPLACE_INDEX, PROJECT_LABELS } from "@/lib/eval-data";

type RouteParams = Promise<{ species: string }>;

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { species } = await params;
  const decoded = decodeURIComponent(species);
  return {
    title: `Species: ${decoded} - GAD`,
    description: `All published generations attempted by the ${decoded} species.`,
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function SpeciesDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const { species } = await params;
  const decoded = decodeURIComponent(species);

  const summary = MARKETPLACE_INDEX.species.find((s) => s.species === decoded);
  if (!summary) notFound();

  const generations = MARKETPLACE_INDEX.generations
    .filter((g) => g.species === decoded)
    .sort((a, b) => {
      const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bt - at;
    });

  // Group by project so the operator can see "this species attempted these
  // worlds N times each" at a glance.
  const byProject = new Map<string, typeof generations>();
  for (const g of generations) {
    const arr = byProject.get(g.project) ?? [];
    arr.push(g);
    byProject.set(g.project, arr);
  }
  const projectGroups = [...byProject.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <nav className="text-xs text-muted-foreground">
          <Link href="/project-market" className="hover:text-foreground">
            ← Project Market
          </Link>
          <span className="mx-2">/</span>
          <span>species</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">{decoded}</span>
        </nav>

        <header className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-4">
          <h1 className="font-mono text-2xl">{decoded}</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
            <span>
              {summary.publishedCount} generation
              {summary.publishedCount === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>
              {summary.projects.length} project
              {summary.projects.length === 1 ? "" : "s"}
            </span>
            {summary.latestPublishedAt && (
              <>
                <span>·</span>
                <span>latest {fmtDate(summary.latestPublishedAt)}</span>
              </>
            )}
          </div>
        </header>

        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          A species is a GAD project that generates other GAD projects. Each row
          below is a generation: an attempt by{" "}
          <span className="font-mono text-foreground">{decoded}</span> to
          implement a world&apos;s requirements. Multiple generations per
          project are expected and welcome — they show the species iterating.
        </p>

        <div className="mt-8 space-y-8">
          {projectGroups.map(([projectId, gens]) => {
            const projectLabel = PROJECT_LABELS[projectId] ?? projectId;
            return (
              <section key={projectId}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    <Link
                      href={`/project-market?projectid=${encodeURIComponent(projectId)}`}
                      className="hover:underline"
                    >
                      {projectLabel}
                    </Link>
                  </h2>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {gens.length} generation{gens.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="divide-y divide-border/30 rounded border border-border/40 bg-card/30">
                  {gens.map((g) => (
                    <li
                      key={g.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-foreground">
                          {g.version}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {fmtDate(g.publishedAt)}
                        </span>
                        {g.publishedBy && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            by {g.publishedBy}
                          </span>
                        )}
                        {g.score !== null && (
                          <span className="text-muted-foreground tabular-nums">
                            score {g.score.toFixed(2)}
                          </span>
                        )}
                        {g.contextFramework && (
                          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {g.contextFramework}
                          </span>
                        )}
                      </div>
                      <Link
                        href={g.playableUrl}
                        className="text-accent hover:underline"
                      >
                        play →
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </MarketingShell>
  );
}
