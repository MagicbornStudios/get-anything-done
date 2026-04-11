import Link from "next/link";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import VideoEmbed from "@/components/video/VideoEmbed";
import { COMPOSITIONS } from "@/remotion/registry";

export const metadata = {
  title: "Videos — GAD",
  description:
    "Remotion compositions from the site registry — embeddable explainers up to 30s, built as TypeScript + React.",
};

export default function VideosPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Videos</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            30-second explainers.{" "}
            <span className="gradient-text">Built by agents, rendered by Remotion.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Each embed below is a row in{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-sm">
              remotion/registry.ts
            </code>
            — same metadata the per-run pages use when a composition is tied to a preserved
            eval. Add a composition there and it appears here automatically.
          </p>
        </div>
      </section>

      {COMPOSITIONS.length === 0 ? (
        <section className="border-b border-border/60 bg-card/20">
          <div className="section-shell">
            <p className="text-sm text-muted-foreground">
              No compositions in the registry yet. Follow the checklist in{" "}
              <code className="rounded bg-card/60 px-1 py-0.5 text-xs">registry.ts</code>{" "}
              to add one.
            </p>
          </div>
        </section>
      ) : (
        COMPOSITIONS.map((c, i) => (
          <section
            key={c.slug}
            id={c.slug}
            className={
              i % 2 === 0
                ? "border-b border-border/60 bg-card/20"
                : "border-b border-border/60"
            }
          >
            <div className="section-shell">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <Badge variant="default" className="inline-flex items-center gap-1.5">
                  <Play size={11} aria-hidden />
                  {c.slug}
                </Badge>
                <Badge variant="outline">
                  {Math.round(c.durationInFrames / c.fps)}s · {c.width}×{c.height} · {c.fps}fps
                </Badge>
                <Badge variant="outline">{c.status}</Badge>
              </div>
              <VideoEmbed composition={c} />
            </div>
          </section>
        ))
      )}

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/hypotheses"
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-4 py-2 font-semibold transition-colors hover:border-accent hover:text-accent"
            >
              What this explains
            </Link>
            <Link
              href="/skeptic"
              className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
            >
              Skeptic critique
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
