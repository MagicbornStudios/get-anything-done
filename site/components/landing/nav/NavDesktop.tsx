import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NAV_GROUPS,
  NAV_TOP_LEVEL,
  type NavGroup,
} from "@/components/landing/nav/nav-shared";

export function NavDesktop() {
  return (
    <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
      {NAV_GROUPS.map((group) => (
        <NavDesktopGroup key={group.label} group={group} />
      ))}

      {NAV_TOP_LEVEL.map((link) => (
        <Button
          key={`${link.href}-${link.label}`}
          variant="outline"
          size="sm"
          className={link.tint}
          asChild
        >
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </nav>
  );
}

function NavDesktopGroup({ group }: { group: NavGroup }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group gap-1 text-muted-foreground data-[state=open]:bg-card/60 data-[state=open]:text-foreground"
        >
          {group.label}
          <ChevronDown
            size={13}
            className="transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72 divide-y divide-border/40 rounded-xl border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40 backdrop-blur-md"
      >
        {group.links.map((link) => (
          <DropdownMenuItem key={`${group.label}-${link.label}`} className="p-0" asChild>
            <Link
              href={link.href}
              className="block cursor-pointer rounded-none px-4 py-3 text-sm transition-colors hover:bg-card/60 hover:text-foreground focus:bg-card/60 focus:text-foreground data-[highlighted]:bg-card/60"
            >
              <div className="font-medium text-foreground">{link.label}</div>
              {link.note && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">{link.note}</div>
              )}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
