import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { Identified } from "@/components/devid/Identified";

/**
 * Header block that introduces the featured SKILL.md tiles below it:
 * kicker + heading + CTA pair (full installer, browse all). Kept separate
 * from the grid so copy edits don't churn the grid diff, and the two
 * regions get distinct dev-id landmarks for targeted handoffs.
 */
export function LandingEvolutionLoopFeaturedSkillsHeader() {
  return (
    <Identified as="LandingEvolutionLoopFeaturedSkillsHeader" className="block">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Try one now</p>
          <h3 className="mt-1 max-w-2xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Featured skills, shown the way an agent reads them.
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Each card is a real <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-xs">SKILL.md</code>{" "}
            from this repo. Copy the raw file into your project&apos;s skills directory, or
            let the installer drop the full catalog.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/downloads"
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
          >
            <PackageCheck size={14} aria-hidden />
            Full installer
          </Link>
          <Link
            href="/library"
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
          >
            Browse all skills
          </Link>
        </div>
      </div>
    </Identified>
  );
}
