import Link from "next/link";
import { Github } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Button } from "@/components/ui/button";
import {
  NAV_GROUPS,
  NAV_TOP_LEVEL,
  NAV_GITHUB_HREF,
  type NavLink,
} from "@/components/landing/nav/nav-shared";

type Props = {
  onNavigate: () => void;
};

function mobileNavSlug(label: string) {
  return label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function MobileNavLink({ link, prefix, onNavigate }: { link: NavLink; prefix: string; onNavigate: () => void }) {
  return (
    <li key={`${prefix}-${link.label}`}>
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
  );
}

export function NavMobileMenu({ onNavigate }: Props) {
  return (
    <Identified as="NavMobileMenuScroll" className="flex max-h-[85vh] flex-col overflow-y-auto px-6 pb-8 pt-4">
      {NAV_GROUPS.map((group) => (
        <Identified key={group.label} as={`NavMobileGroup-${mobileNavSlug(group.label)}`} className="mb-6 last:mb-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          {group.links ? (
            <ul className="space-y-1">
              {group.links.map((link) => (
                <MobileNavLink
                  key={`mobile-${group.label}-${link.label}`}
                  link={link}
                  prefix={`mobile-${group.label}`}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          ) : (
            <div className="space-y-3 pl-2">
              {group.subGroups.map((sub) => (
                <div key={`mobile-${group.label}-${sub.label}`}>
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {sub.label}
                  </p>
                  <ul className="space-y-1">
                    {sub.links.map((link) => (
                      <MobileNavLink
                        key={`mobile-${group.label}-${sub.label}-${link.label}`}
                        link={link}
                        prefix={`mobile-${group.label}-${sub.label}`}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Identified>
      ))}
      <Identified as="NavMobileHighlights" className="mb-4 space-y-2">
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
      </Identified>
      <Identified as="NavMobileGithub">
        <Button variant="outline" size="sm" className="mt-2 gap-2 rounded-full" asChild>
          <a href={NAV_GITHUB_HREF} rel="noopener noreferrer" target="_blank" onClick={onNavigate}>
            <Github className="size-3.5" aria-hidden />
            GitHub
          </a>
        </Button>
      </Identified>
    </Identified>
  );
}
