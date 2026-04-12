import Link from "next/link";
import { FileText, Gauge, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { GITHUB_REPO } from "@/lib/catalog.generated";

export function GadHeroSection() {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="The framework"
        as="h1"
        preset="hero"
        title={
          <>
            <span className="text-foreground">GAD is</span>{" "}
            <span className="gradient-text">planning + evaluation</span>{" "}
            <span className="text-foreground">for AI coding agents.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        A small CLI, a strict five-step loop, and an experiment harness stapled to the side. The CLI re-hydrates context
        in one command. Skills tell the agent <em>what</em> to do. Subagents do the expensive work off the main thread.
        Templates scaffold new projects. Runtime-specific command wrappers are generated only when a coding agent needs
        them. Evals measure whether any of this actually helps. Read the{" "}
        <Link href="/#workflow" className="text-accent hover:underline">
          loop diagram
        </Link>{" "}
        for how it fits together.
      </SiteProse>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button
          size="lg"
          className="gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 hover:bg-accent/90"
          asChild
        >
          <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">
            <Terminal size={16} aria-hidden />
            Source on GitHub
          </a>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="gap-2 rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
          asChild
        >
          <Link href="/methodology">
            <Gauge size={16} aria-hidden />
            How we score
          </Link>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="gap-2 rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
          asChild
        >
          <Link href="/planning">
            <FileText size={16} aria-hidden />
            Current planning state
          </Link>
        </Button>
      </div>
    </SiteSection>
  );
}
