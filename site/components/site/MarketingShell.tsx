import type { ReactNode } from "react";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { Identified } from "@/components/devid/Identified";
import { BandDevPanel } from "@/components/devid/BandDevPanel";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="group/site-band relative">
        <Identified as="SiteNav" stableCid="site-nav">
          <Nav />
        </Identified>
        <BandDevPanel cid="site-nav" label="SiteNav" edge="top" />
      </div>
      {children}
      <div className="group/site-band relative">
        <Identified as="SiteFooter" stableCid="site-footer">
          <Footer />
        </Identified>
        <BandDevPanel cid="site-footer" label="SiteFooter" edge="bottom" />
      </div>
    </main>
  );
}
