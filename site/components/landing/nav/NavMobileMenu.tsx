import Link from "next/link";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS, NAV_TOP_LEVEL, NAV_GITHUB_HREF } from "@/components/landing/nav/nav-shared";

type Props = {
  onNavigate: () => void;
};

export function NavMobileMenu({ onNavigate }: Props) {
  return (
    <div className="flex max-h-[85vh] flex-col overflow-y-auto px-6 pb-8 pt-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-6 last:mb-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.links.map((link) => (
              <li key={`mobile-${group.label}-${link.label}`}>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start px-2 py-2 text-sm font-normal text-foreground hover:bg-card/60"
                  asChild
                >
                  <Link href={link.href} onClick={onNavigate}>
                    {link.label}
                    {link.note && (
                      <span className="ml-2 text-[10px] text-muted-foreground">{link.note}</span>
                    )}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mb-4 space-y-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Highlights
        </p>
        {NAV_TOP_LEVEL.map((link) => (
          <Button
            key={`mobile-top-${link.href}-${link.label}`}
            variant="outline"
            className={`h-auto w-full justify-center py-2 text-sm font-semibold ${link.tint ?? ""}`}
            asChild
          >
            <Link href={link.href} onClick={onNavigate}>
              {link.label}
            </Link>
          </Button>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-2 gap-2 rounded-full" asChild>
        <a href={NAV_GITHUB_HREF} rel="noopener noreferrer" target="_blank" onClick={onNavigate}>
          <Github className="size-3.5" aria-hidden />
          GitHub
        </a>
      </Button>
    </div>
  );
}
