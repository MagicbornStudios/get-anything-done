"use client";

// Task 44-30 (decision gad-188): project picker for the marketing nav.
// Writes ?projectid=<id> into the URL; the rest of the site picks that up
// via ProjectContext (client) or searchParams (server routes).

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Identified } from "gad-visual-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentProject } from "@/components/ProjectContext";
import {
  REGISTERED_PROJECTS,
} from "@/lib/project-config";

export function NavProjectPicker() {
  const currentId = useCurrentProject();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("projectid", id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <Identified as="NavProjectPicker" className="hidden md:block">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 rounded-full border-border/70 bg-card/40 text-xs font-medium"
            aria-label={`Current project: ${currentId}`}
          >
            <span className="max-w-[10rem] truncate">{currentId}</span>
            <ChevronDown className="size-3" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          {REGISTERED_PROJECTS.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => select(p.id)}
              className="flex items-center justify-between gap-3"
            >
              <span className="truncate">{p.id}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {p.kind}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </Identified>
  );
}
