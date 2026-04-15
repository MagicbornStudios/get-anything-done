import Link from "next/link";
import { ArrowRight, Gauge, Github, ClipboardCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroCtaRow() {
  return (
    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Button
        size="lg"
        className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 hover:bg-accent/90"
        asChild
      >
        <Link href="/project-market">
          <Gauge size={18} aria-hidden />
          Project market
          <ArrowRight size={16} aria-hidden />
        </Link>
      </Button>

      <Button
        variant="outline"
        size="lg"
        className="rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold"
        asChild
      >
        <Link href="/downloads">
          <Download size={16} aria-hidden />
          Installer &amp; packs
        </Link>
      </Button>

      <Button
        variant="outline"
        size="lg"
        className="rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold"
        asChild
      >
        <Link href="/methodology">
          <ClipboardCheck size={16} aria-hidden />
          Methodology
        </Link>
      </Button>

      <Button variant="ghost" size="lg" className="rounded-full px-6 py-3 text-sm font-medium text-muted-foreground" asChild>
        <Link href="/gad">The hypothesis</Link>
      </Button>

      <Button variant="ghost" size="lg" className="rounded-full px-6 py-3 text-sm font-medium text-muted-foreground" asChild>
        <a href="https://github.com/MagicbornStudios/get-anything-done" rel="noopener noreferrer" target="_blank">
          <Github size={14} aria-hidden />
          Fork on GitHub
        </a>
      </Button>
    </div>
  );
}
