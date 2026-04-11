import { Github, Menu, X } from "lucide-react";
import { GlobalSearch } from "@/components/search/global-search/GlobalSearch";
import { NAV_GITHUB_HREF } from "@/components/landing/nav/nav-shared";

type Props = {
  mobileOpen: boolean;
  onToggleMobile: () => void;
};

export function NavActions({ mobileOpen, onToggleMobile }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="hidden md:block">
        <GlobalSearch />
      </div>
      <a
        href={NAV_GITHUB_HREF}
        rel="noopener noreferrer"
        target="_blank"
        className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/40 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent md:inline-flex"
      >
        <Github size={14} aria-hidden />
        GitHub
      </a>

      <button
        type="button"
        onClick={onToggleMobile}
        className="rounded-md border border-border/70 bg-card/40 p-2 text-foreground md:hidden"
        aria-expanded={mobileOpen}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X size={16} /> : <Menu size={16} />}
      </button>
    </div>
  );
}
