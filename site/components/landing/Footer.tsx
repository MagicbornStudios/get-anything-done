import { Github } from "lucide-react";
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
                <a
                  href="https://github.com/MagicbornStudios/get-anything-done"
                  rel="noopener noreferrer"
                  target="_blank"
                  className="inline-flex items-center gap-2 text-foreground transition-colors hover:text-accent"
                >
                  <Github size={14} aria-hidden />
                  MagicbornStudios / get-anything-done
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/gsd-build/get-shit-done"
                  rel="noopener noreferrer"
                  target="_blank"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Upstream: gsd-build / get-shit-done
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jump to</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <li><a href="/#what" className="text-muted-foreground transition-colors hover:text-foreground">What it is</a></li>
              <li><a href="/#lineage" className="text-muted-foreground transition-colors hover:text-foreground">Lineage</a></li>
              <li><a href="/#framework" className="text-muted-foreground transition-colors hover:text-foreground">Framework</a></li>
              <li><a href="/#results" className="text-muted-foreground transition-colors hover:text-foreground">Results</a></li>
              <li><a href="/#play" className="text-muted-foreground transition-colors hover:text-foreground">Play</a></li>
              <li><a href="/#templates" className="text-muted-foreground transition-colors hover:text-foreground">Downloads</a></li>
              <li><a href="/#run" className="text-muted-foreground transition-colors hover:text-foreground">Run it</a></li>
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
