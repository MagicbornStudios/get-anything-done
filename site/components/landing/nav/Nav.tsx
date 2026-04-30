"use client";

import { useState } from "react";
import { NavActions } from "@/components/landing/nav/NavActions";
import { NavBrand } from "@/components/landing/nav/NavBrand";
import { NavDesktop } from "@/components/landing/nav/NavDesktop";
import { NavMobileMenu } from "@/components/landing/nav/NavMobileMenu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Identified } from "gad-visual-context";

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Identified as="NavBrand">
          <NavBrand />
        </Identified>

        <NavDesktop />

        <Identified as="NavActions">
          <NavActions
            mobileOpen={mobileOpen}
            onToggleMobile={() => setMobileOpen(!mobileOpen)}
          />
        </Identified>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(100vw-1.5rem,22rem)] max-w-[22rem] flex-col gap-0 border-border/60 bg-background/95 p-0 sm:max-w-sm"
        >
          <SheetTitle className="sr-only">Site navigation</SheetTitle>
          <Identified as="NavMobileMenu">
            <NavMobileMenu onNavigate={() => setMobileOpen(false)} />
          </Identified>
        </SheetContent>
      </Sheet>
    </header>
  );
}
