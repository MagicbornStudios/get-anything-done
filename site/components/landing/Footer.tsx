import { Github } from "lucide-react";
import { Identified } from "@portfolio/visual-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <Identified as="FooterBlurb">
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">get-anything-done</p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Evolutionary framework for AI coding agents — species, generations, and measurable pressure. Open source. Measured, not vibed.
              </p>
            </div>
          </Identified>

          <Identified as="FooterSourceLinks">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Button
                    variant="ghost"
                    className="h-auto gap-2 p-0 text-foreground hover:bg-transparent hover:text-accent"
                    asChild
                  >
                    <a href="https://github.com/MagicbornStudios/get-anything-done" rel="noopener noreferrer" target="_blank">
                      <Github size={14} aria-hidden />
                      MagicbornStudios / get-anything-done
                    </a>
                  </Button>
                </li>
              </ul>
            </div>
          </Identified>

          <Identified as="FooterJumpTo">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jump to</p>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <li>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    asChild
                  >
                    <a href="/#agent-handoff-cycle">Agent Handoff</a>
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    asChild
                  >
                    <a href="/#visual-context">Visual Context</a>
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    asChild
                  >
                    <a href="/project-market">Project Market</a>
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    asChild
                  >
                    <a href="/downloads">Downloads</a>
                  </Button>
                </li>
              </ul>
            </div>
          </Identified>
        </div>

        <Separator className="my-8" />

        <Identified as="FooterCopyright" tag="p" className="text-xs text-muted-foreground">
          (c) {new Date().getFullYear()} get-anything-done - MIT licensed - Built with Next.js &amp; shadcn primitives.
        </Identified>
      </div>
    </footer>
  );
}
