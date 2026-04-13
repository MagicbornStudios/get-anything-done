"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Identified } from "@/components/devid/Identified";
import {
  NAV_GROUPS,
  NAV_TOP_LEVEL,
  type NavGroup,
  type NavLink,
} from "@/components/landing/nav/nav-shared";

function navGroupSlug(label: string) {
  return label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function NavDesktop() {
  return (
    <Identified
      as="NavDesktopRoot"
      tag="nav"
      className="hidden items-center gap-1 text-sm text-muted-foreground md:flex"
    >
      {NAV_GROUPS.map((group) => (
        <NavDesktopGroup key={group.label} group={group} />
      ))}

      {NAV_TOP_LEVEL.map((link) => (
        <Identified key={`${link.href}-${link.label}`} as={`NavDesktopHighlight-${navGroupSlug(link.label)}`}>
          <Button variant="outline" size="sm" className={link.tint} asChild>
            <Link href={link.href}>{link.label}</Link>
          </Button>
        </Identified>
      ))}
    </Identified>
  );
}

function NavDesktopGroup({ group }: { group: NavGroup }) {
  const router = useRouter();
  const navigate = (href: string) => {
    if (href.startsWith("#") || href.startsWith("/#")) {
      window.location.href = href;
    } else {
      router.push(href);
    }
  };
  const renderItem = (link: NavLink, prefix: string) => (
    <DropdownMenuItem
      key={`${prefix}-${link.label}`}
      className="block cursor-pointer rounded-none px-4 py-3 text-sm transition-colors focus:bg-card/60 focus:text-foreground data-[highlighted]:bg-card/60"
      onSelect={(e) => {
        e.preventDefault();
        navigate(link.href);
      }}
    >
      <div className="font-medium text-foreground">{link.label}</div>
      {link.note && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{link.note}</div>
      )}
    </DropdownMenuItem>
  );

  return (
    <Identified as={`NavDesktopDropdown-${navGroupSlug(group.label)}`}>
    <DropdownMenu modal={false}>
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
        {group.links
          ? group.links.map((link) => renderItem(link, group.label))
          : group.subGroups.map((sub) => (
              <DropdownMenuSub key={`${group.label}-${sub.label}`}>
                <DropdownMenuSubTrigger className="cursor-pointer rounded-none px-4 py-3 text-sm transition-colors focus:bg-card/60 focus:text-foreground data-[state=open]:bg-card/60 data-[highlighted]:bg-card/60">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-muted-foreground">
                    {sub.label}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-72 divide-y divide-border/40 rounded-xl border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40 backdrop-blur-md">
                  {sub.links.map((link) =>
                    renderItem(link, `${group.label}-${sub.label}`),
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
      </DropdownMenuContent>
    </DropdownMenu>
    </Identified>
  );
}
