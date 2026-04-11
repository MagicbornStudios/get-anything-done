import Link from "next/link";
import { ArrowRight, Gauge, Github, FileText, ClipboardCheck } from "lucide-react";

export function HeroCtaRow() {
  return (
    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a
        href="#play"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
      >
        <Gauge size={18} aria-hidden />
        Play an eval
        <ArrowRight size={16} aria-hidden />
      </a>

      <Link
        href="/methodology"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
      >
        <ClipboardCheck size={16} aria-hidden />
        Methodology
      </Link>

      <Link
        href="/findings"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
      >
        <FileText size={16} aria-hidden />
        Latest findings
      </Link>

      <Link
        href="/gad"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        The hypothesis
      </Link>

      <a
        href="https://github.com/MagicbornStudios/get-anything-done"
        rel="noopener noreferrer"
        target="_blank"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Github size={14} aria-hidden />
        Fork on GitHub
      </a>
    </div>
  );
}
