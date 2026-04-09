"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Film, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import VideoEmbed from "@/components/video/VideoEmbed";
import { COMPOSITIONS } from "@/remotion/registry";

export default function VideosIndexPage() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of COMPOSITIONS) c.tags.forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    return COMPOSITIONS.filter((c) => {
      if (tag && !c.tags.includes(tag)) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, tag]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Videos</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Compositions, <span className="gradient-text">not MP4s.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Every video on this site is a Remotion React composition rendered live in the browser.
            No compilation, no upload, no file management. Each one is 30 seconds or less,
            cinematic passthrough, with play/pause controls. Compositions reuse the same React
            components as the rest of the site — the video stays in sync with the live data by
            construction. Same videos also embed inline on relevant per-run pages under "watch
            this dissection".
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-4 py-2 text-xs font-semibold text-accent">
            <Film size={12} aria-hidden />
            {COMPOSITIONS.length} composition{COMPOSITIONS.length === 1 ? "" : "s"} registered
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1 min-w-52">
              <Search
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Filter videos…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-full border border-border/70 bg-background/50 py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-accent/60 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTag(null)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  tag === null
                    ? "border border-accent bg-accent/10 text-accent"
                    : "border border-border/70 bg-card/40 text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                all
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(tag === t ? null : t)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    tag === t
                      ? "border border-accent bg-accent/10 text-accent"
                      : "border border-border/70 bg-card/40 text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-border/60 bg-card/30 p-12 text-center text-sm text-muted-foreground">
              No compositions match.
            </p>
          ) : (
            <div className="grid gap-10 lg:grid-cols-2">
              {filtered.map((c) => (
                <div key={c.slug}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {c.slug}
                    </Badge>
                    {c.status === "placeholder" && (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                        placeholder
                      </Badge>
                    )}
                    {c.relatedRun && (
                      <Link
                        href={`/runs/${c.relatedRun.project}/${c.relatedRun.version}`}
                        className="text-[10px] font-semibold uppercase tracking-wider text-accent hover:underline"
                      >
                        → {c.relatedRun.project}/{c.relatedRun.version}
                      </Link>
                    )}
                  </div>
                  <VideoEmbed composition={c} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
