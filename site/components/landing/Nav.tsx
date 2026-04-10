"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Github, ChevronDown, Menu, X } from "lucide-react";
import { GlobalSearch } from "@/components/search/GlobalSearch";

/**
 * IA refactor (decision gad-76 / ASSUMPTIONS.md): 14 flat nav items were
 * breaking on mobile and confusing on desktop. Grouped into five dropdowns
 * plus top-level Emergent + GitHub. Primary user is the researcher (target A),
 * secondary is the indie dev (target C); nav prioritizes scanning clarity.
 */

type NavLink = { href: string; label: string; note?: string };

type NavGroup = { label: string; links: NavLink[] };

const GROUPS: NavGroup[] = [
  {
    label: "Theory",
    links: [
      { href: "/gad", label: "GAD", note: "what the framework is" },
      { href: "/lineage", label: "Lineage", note: "GSD → RepoPlanner → GAD" },
      { href: "/methodology", label: "Methodology", note: "rubric, gates, rounds" },
      { href: "/hypotheses", label: "Hypotheses", note: "every claim wired to its eval track" },
      { href: "/skeptic", label: "Skeptic", note: "devils advocate against our claims" },
      { href: "/glossary", label: "Glossary", note: "every domain term" },
    ],
  },
  {
    label: "Evaluation",
    links: [
      { href: "/findings", label: "Findings", note: "per-round writeups" },
      { href: "/rubric", label: "Rubric", note: "how we score" },
      { href: "/#results", label: "Results", note: "run comparison grid" },
      { href: "/#graphs", label: "Graphs", note: "quality + pressure scatters" },
      { href: "/decisions", label: "Decisions", note: "DECISIONS.xml rendered" },
      { href: "/questions", label: "Questions", note: "open research questions" },
      { href: "/roadmap", label: "Roadmap", note: "round timeline" },
      { href: "/data", label: "Data provenance", note: "every number's source" },
    ],
  },
  {
    label: "Catalog",
    links: [
      { href: "/skills", label: "Skills", note: "every authored skill + provenance" },
      { href: "/#catalog", label: "Agents", note: "subagents" },
      { href: "/#catalog", label: "Commands", note: "gad CLI" },
      { href: "/#catalog", label: "Templates", note: "eval starting points" },
    ],
  },
  {
    label: "Play",
    links: [
      { href: "/#play", label: "Playable Archive", note: "play every scored build" },
      { href: "/videos", label: "Videos", note: "walkthroughs" },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/planning", label: "Planning", note: "in-repo state + tasks" },
      { href: "/tasks", label: "Tasks", note: "every task in TASK-REGISTRY" },
      { href: "/phases", label: "Phases", note: "ROADMAP.xml rendered" },
      { href: "/bugs", label: "Bugs", note: "tracked across runs" },
      { href: "/requirements", label: "Requirements", note: "v5 + history" },
      { href: "/security", label: "Security", note: "skill risks + certification" },
      { href: "/contribute", label: "Contribute", note: "clone and run your own" },
    ],
  },
];

const TOP_LEVEL: NavLink[] = [{ href: "/emergent", label: "Emergent" }];

export default function Nav() {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Click outside closes the desktop dropdown
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div
        ref={navRef}
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <span className="inline-block size-2 rounded-full bg-accent shadow-[0_0_12px_2px] shadow-accent/60" />
          <span>get-anything-done</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
          {GROUPS.map((group) => {
            const isOpen = openGroup === group.label;
            return (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : group.label)}
                  aria-expanded={isOpen}
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors ${
                    isOpen
                      ? "bg-card/60 text-foreground"
                      : "hover:bg-card/40 hover:text-foreground"
                  }`}
                >
                  {group.label}
                  <ChevronDown
                    size={13}
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <div
                    className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-2xl shadow-black/40 backdrop-blur-md"
                    role="menu"
                  >
                    {group.links.map((link) => (
                      <Link
                        key={`${group.label}-${link.label}`}
                        href={link.href}
                        onClick={() => setOpenGroup(null)}
                        className="block border-b border-border/40 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-card/60 hover:text-foreground"
                        role="menuitem"
                      >
                        <div className="font-medium text-foreground">{link.label}</div>
                        {link.note && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {link.note}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {TOP_LEVEL.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/20"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden md:block">
            <GlobalSearch />
          </div>
          <a
            href="https://github.com/MagicbornStudios/get-anything-done"
            rel="noopener noreferrer"
            target="_blank"
            className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/40 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent md:inline-flex"
          >
            <Github size={14} aria-hidden />
            GitHub
          </a>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md border border-border/70 bg-card/40 p-2 text-foreground md:hidden"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border/60 bg-background/95 md:hidden">
          <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
            {GROUPS.map((group) => (
              <div key={group.label} className="mb-6 last:mb-0">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.links.map((link) => (
                    <li key={`mobile-${group.label}-${link.label}`}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-md px-2 py-2 text-sm text-foreground hover:bg-card/60"
                      >
                        {link.label}
                        {link.note && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            {link.note}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Compound-skills hypothesis
              </p>
              {TOP_LEVEL.map((link) => (
                <Link
                  key={`mobile-top-${link.href}`}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <a
              href="https://github.com/MagicbornStudios/get-anything-done"
              rel="noopener noreferrer"
              target="_blank"
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-4 py-2 text-xs font-medium text-foreground"
            >
              <Github size={14} aria-hidden />
              GitHub
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
