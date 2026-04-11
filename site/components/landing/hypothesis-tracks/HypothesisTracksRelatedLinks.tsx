import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HypothesisTracksRelatedLinks() {
  return (
    <div className="mt-6 flex flex-wrap gap-3 text-sm">
      <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-card/40 font-semibold hover:border-accent hover:text-accent" asChild>
        <Link href="/hypotheses">
          All hypotheses
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full border-amber-500/40 bg-amber-500/10 font-semibold text-amber-300 hover:bg-amber-500/20"
        asChild
      >
        <Link href="/emergent">
          CSH evidence
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-300 hover:bg-emerald-500/20"
        asChild
      >
        <Link href="/freedom">
          Freedom evidence
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-card/40 font-semibold hover:border-accent hover:text-accent" asChild>
        <Link href="/roadmap">
          Full roadmap
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
