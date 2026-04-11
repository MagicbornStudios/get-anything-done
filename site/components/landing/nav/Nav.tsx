"use client";

import { useState, useEffect, useRef } from "react";
import { NavActions } from "@/components/landing/nav/NavActions";
import { NavBrand } from "@/components/landing/nav/NavBrand";
import { NavDesktop } from "@/components/landing/nav/NavDesktop";
import { NavMobileMenu } from "@/components/landing/nav/NavMobileMenu";

export default function Nav() {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div
        ref={navRef}
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4"
      >
        <NavBrand />

        <NavDesktop openGroup={openGroup} setOpenGroup={setOpenGroup} />

        <NavActions
          mobileOpen={mobileOpen}
          onToggleMobile={() => setMobileOpen(!mobileOpen)}
        />
      </div>

      {mobileOpen && <NavMobileMenu onNavigate={() => setMobileOpen(false)} />}
    </header>
  );
}
