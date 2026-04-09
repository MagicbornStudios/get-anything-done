import Link from "next/link";
import { Github } from "lucide-react";

const NAV_LINKS = [
  { href: "/gad", label: "GAD" },
  { href: "/lineage", label: "Lineage" },
  { href: "/methodology", label: "Methodology" },
  { href: "/rubric", label: "Rubric" },
  { href: "/questions", label: "Questions" },
  { href: "/glossary", label: "Glossary" },
  { href: "/#results", label: "Results" },
  { href: "/#graphs", label: "Graphs" },
  { href: "/videos", label: "Videos" },
  { href: "/#catalog", label: "Catalog" },
  { href: "/findings", label: "Findings" },
  { href: "/decisions", label: "Decisions" },
  { href: "/planning", label: "Planning" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block size-2 rounded-full bg-accent shadow-[0_0_12px_2px] shadow-accent/60" />
          <span>get-anything-done</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="https://github.com/MagicbornStudios/get-anything-done"
          rel="noopener noreferrer"
          target="_blank"
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <Github size={14} aria-hidden />
          GitHub
        </a>
      </div>
    </header>
  );
}
