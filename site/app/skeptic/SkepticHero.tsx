import { ShieldQuestion } from "lucide-react";
import { REPO } from "./skeptic-shared";

export default function SkepticHero() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <div className="mb-6 flex items-center gap-2">
          <ShieldQuestion size={18} className="text-rose-400" aria-hidden />
          <p className="section-kicker !mb-0">Skeptic</p>
        </div>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          Every claim we&apos;ve made,{" "}
          <span className="gradient-text">held to its strongest critique.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          Research that doesn&apos;t critique itself isn&apos;t research. This page
          is the public commitment to taking our own claims apart. For every
          hypothesis the project has named &mdash; freedom, compound-skills,
          emergent-evolution, pressure, GAD&apos;s value prop &mdash; we state
          the steelman, then the strongest available critique, then the
          alternatives, then what would falsify it. Then we list concrete moves
          that would make us more credible.
        </p>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          Source:{" "}
          <a
            href={`${REPO}/blob/main/.planning/docs/SKEPTIC.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-dotted"
          >
            .planning/docs/SKEPTIC.md
          </a>
          . This document gets updated as the critique deepens, not as the
          hypotheses get more confident.
        </p>

        <div className="mt-8 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm leading-6 text-rose-200">
          <strong className="text-rose-100">The thesis of this page:</strong>{" "}
          confidence in early-stage research is the most dangerous failure
          mode. We have N=2-5 runs per condition across a single task domain
          with one human reviewer. Anything we&apos;ve claimed about
          &quot;monotonic improvement&quot; or &quot;hypothesis confirmed&quot; is
          premature. The right word for what we&apos;re doing is{" "}
          <em>exploratory analysis</em>, not <em>hypothesis testing</em>.
        </div>
      </div>
    </section>
  );
}
