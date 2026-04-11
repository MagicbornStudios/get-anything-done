"use client";

import { Player } from "@remotion/player";
import Link from "next/link";
import { Play, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { GadExplainer } from "@/remotion/GadExplainer";

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
            Each video is a Remotion composition — TypeScript + React, rendered
            deterministically, embeddable in-browser. The composition below is
            a placeholder showing the 4 mandatory gate frames. The round 1
            eval agent will replace it with a production version.
          </p>
        </div>
      </section>
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Badge variant="default" className="inline-flex items-center gap-1.5">
              <Play size={11} aria-hidden />
              gad-explainer
            </Badge>
            <Badge variant="outline">30s · 1920×1080 · 30fps</Badge>
            <Badge variant="outline">placeholder</Badge>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-black shadow-2xl shadow-black/40">
            <Player
              component={GadExplainer}
              compositionWidth={1920}
              compositionHeight={1080}
              durationInFrames={900}
              fps={30}
              style={{ width: "100%" }}
              controls
              autoPlay={false}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/hypotheses" className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-4 py-2 font-semibold transition-colors hover:border-accent hover:text-accent">
              What this explains
            </Link>
            <Link href="/skeptic" className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 font-semibold text-rose-300 transition-colors hover:bg-rose-500/20">
              Skeptic critique
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
