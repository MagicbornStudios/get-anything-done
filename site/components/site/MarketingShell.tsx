import type { ReactNode } from "react";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { Identified } from "gad-visual-context";
import { ShellBandDevPanelSlot } from "gad-visual-context";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ShellBandDevPanelSlot cid="site-nav" label="SiteNav" edge="bottom">
        <Identified as="SiteNav" stableCid="site-nav">
          <Nav />
        </Identified>
      </ShellBandDevPanelSlot>
      {children}
      <ShellBandDevPanelSlot cid="site-footer" label="SiteFooter" edge="top">
        <Identified as="SiteFooter" stableCid="site-footer">
          <Footer />
        </Identified>
      </ShellBandDevPanelSlot>
    </main>
  );
}
