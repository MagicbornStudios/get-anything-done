import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  NAV_GROUPS,
  NAV_TOP_LEVEL,
  type NavGroup,
} from "@/components/landing/nav/nav-shared";

type Props = {
  openGroup: string | null;
  setOpenGroup: (label: string | null) => void;
};

export function NavDesktop({ openGroup, setOpenGroup }: Props) {
  return (
    <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
      {NAV_GROUPS.map((group) => (
        <NavDesktopGroup
          key={group.label}
          group={group}
          isOpen={openGroup === group.label}
          onToggle={() => setOpenGroup(openGroup === group.label ? null : group.label)}
          onPickLink={() => setOpenGroup(null)}
        />
      ))}

      {NAV_TOP_LEVEL.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${link.tint ?? ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function NavDesktopGroup({
  group,
  isOpen,
  onToggle,
  onPickLink,
}: {
  group: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  onPickLink: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors ${
          isOpen ? "bg-card/60 text-foreground" : "hover:bg-card/40 hover:text-foreground"
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
              onClick={onPickLink}
              className="block border-b border-border/40 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-card/60 hover:text-foreground"
              role="menuitem"
            >
              <div className="font-medium text-foreground">{link.label}</div>
              {link.note && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">{link.note}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
