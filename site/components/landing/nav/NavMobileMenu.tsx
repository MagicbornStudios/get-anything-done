import Link from "next/link";
import { Github } from "lucide-react";
import { NAV_GROUPS, NAV_TOP_LEVEL, NAV_GITHUB_HREF } from "@/components/landing/nav/nav-shared";

type Props = {
  onNavigate: () => void;
};

export function NavMobileMenu({ onNavigate }: Props) {
  return (
    <div className="border-t border-border/60 bg-background/95 md:hidden">
      <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.links.map((link) => (
                <li key={`mobile-${group.label}-${link.label}`}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    className="block rounded-md px-2 py-2 text-sm text-foreground hover:bg-card/60"
                  >
                    {link.label}
                    {link.note && (
                      <span className="ml-2 text-[10px] text-muted-foreground">{link.note}</span>
                    )}
                  </Link>
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
            <Link
              key={`mobile-top-${link.href}`}
              href={link.href}
              onClick={onNavigate}
              className={`block rounded-md border px-3 py-2 text-sm font-semibold ${link.tint ?? ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <a
          href={NAV_GITHUB_HREF}
          rel="noopener noreferrer"
          target="_blank"
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-4 py-2 text-xs font-medium text-foreground"
        >
          <Github size={14} aria-hidden />
          GitHub
        </a>
      </div>
    </div>
  );
}
