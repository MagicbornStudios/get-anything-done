import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold tracking-tight text-foreground">get-anything-done</p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Planning + evaluation framework for AI coding agents. Open source. Measured, not vibed.
            </p>
          </div>
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
              <li>
                <Button
                  variant="ghost"
                  className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  asChild
                >
                  <a href="https://github.com/gsd-build/get-shit-done" rel="noopener noreferrer" target="_blank">
                    Upstream: gsd-build / get-shit-done
                  </a>
                </Button>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jump to</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <li>
                <Button
                  variant="ghost"
                  className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  asChild
                >
                  <a href="/#what">What it is</a>
                </Button>
              </li>
              <li>
                <Button
                  variant="ghost"
                  className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  asChild
                >
                  <a href="/#lineage">Lineage</a>
                </Button>
              </li>
              <li>
                <Button
                  variant="ghost"
                  className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  asChild
                >
                  <a href="/#framework">Framework</a>
                </Button>
              </li>
              <li>
                <Button
                  variant="ghost"
                  className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  asChild
                >
                  <a href="/#results">Results</a>
                </Button>
              </li>
              <li>
                <Button
                  variant="ghost"
                  className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  asChild
                >
                  <a href="/#play">Play</a>
                </Button>
              </li>
              <li>
                <Button
                  variant="ghost"
                  className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  asChild
                >
                  <a href="/#templates">Downloads</a>
                </Button>
              </li>
              <li>
                <Button
                  variant="ghost"
                  className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  asChild
                >
                  <a href="/#run">Run it</a>
                </Button>
              </li>
            </ul>
          </div>
        </div>
        <Separator className="my-8" />
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} get-anything-done · MIT licensed · Built with Next.js &amp; shadcn primitives.
        </p>
      </div>
    </footer>
  );
}
