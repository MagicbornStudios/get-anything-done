import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HypothesisTracksRelatedLinks() {
  return (
    <div className="mt-6 flex flex-wrap gap-3 text-sm">
      <Link
        href="/hypotheses"
        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-4 py-2 font-semibold transition-colors hover:border-accent hover:text-accent"
      >
        All hypotheses
        <ArrowRight size={13} aria-hidden />
      </Link>
      <Link
        href="/emergent"
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
      >
        CSH evidence
        <ArrowRight size={13} aria-hidden />
      </Link>
      <Link
        href="/freedom"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
      >
        Freedom evidence
        <ArrowRight size={13} aria-hidden />
      </Link>
      <Link
        href="/roadmap"
        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-4 py-2 font-semibold transition-colors hover:border-accent hover:text-accent"
      >
        Full roadmap
        <ArrowRight size={13} aria-hidden />
      </Link>
    </div>
  );
}
