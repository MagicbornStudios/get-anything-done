import { Suspense } from "react";
import { Github, Menu, X } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { GlobalSearch } from "@/components/search/global-search/GlobalSearch";
import { Button } from "@/components/ui/button";
import { NAV_GITHUB_HREF } from "@/components/landing/nav/nav-shared";
import { NavProjectPicker } from "@/components/landing/nav/NavProjectPicker";

type Props = {
  mobileOpen: boolean;
  onToggleMobile: () => void;
};

export function NavActions({ mobileOpen, onToggleMobile }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Suspense fallback={null}>
        <NavProjectPicker />
      </Suspense>
      <Identified as="NavGlobalSearch" className="hidden md:block">
        <GlobalSearch />
      </Identified>
      <Identified as="NavGithubLink">
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 rounded-full border-border/70 bg-card/40 text-xs font-medium md:inline-flex"
          asChild
        >
          <a href={NAV_GITHUB_HREF} rel="noopener noreferrer" target="_blank">
            <Github className="size-3.5" aria-hidden />
            GitHub
          </a>
        </Button>
      </Identified>

      <Identified as="NavMobileMenuToggle">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onToggleMobile}
          className="border-border/70 bg-card/40 md:hidden"
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
      </Identified>
    </div>
  );
}
